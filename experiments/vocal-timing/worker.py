"""Pull worker for preview vocal jobs. Run separately from the Next.js app.

Durability lives in the app database; local audio and stems are temporary.
No Supabase service-role key or renderer credentials belong on this worker.
"""
import argparse
import hashlib
import json
import math
import os
import signal
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request

os.environ['ORT_DISABLE_TELEMETRY'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
MAX_BYTES = 25_000_000


class InputInvalid(ValueError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise InputInvalid('Redirects are not permitted')


def https_origin(value):
    # Validate before warming models or claiming a job. urlsplit strips some
    # control characters, so inspect the original configuration first.
    if (not isinstance(value, str) or any(c.isspace() or ord(c) < 32 for c in value)
            or any(c in value for c in ('?', '#', '\\'))):
        raise ValueError('Provide a valid HTTPS origin')
    url = urllib.parse.urlsplit(value)
    if (url.scheme != 'https' or not url.hostname or url.username is not None
            or url.password is not None or url.query or url.fragment
            or url.path not in ('', '/') or '%' in url.hostname):
        raise ValueError('Provide a valid HTTPS origin')
    # Accessing port also rejects nonnumeric and out-of-range values.
    if url.port == 0:
        raise ValueError('Provide a valid HTTPS origin')
    return value.rstrip('/')


def owned_source(url, user_id, storage_origin):
    source, origin = urllib.parse.urlsplit(url), urllib.parse.urlsplit(storage_origin)
    prefix = f'/storage/v1/object/public/uploads/{user_id}/'
    path = urllib.parse.unquote(source.path)
    name = path[len(prefix):]
    if (source.scheme != 'https' or source.netloc != origin.netloc or origin.scheme != 'https'
            or source.username or source.password or source.query or source.fragment
            or not path.startswith(prefix) or not name or '/' in name or '\\' in name
            or name.rsplit('.', 1)[-1].lower() not in ('mp3', 'mp4', 'm4a', 'wav')):
        raise InputInvalid('Source does not belong to this upload owner')
    return url


class Client:
    def __init__(self, app_url, secret, storage_origin, bypass=None):
        app_url = https_origin(app_url)
        storage_origin = https_origin(storage_origin)
        if len(secret) < 32:
            raise ValueError('Worker secret must have at least 32 characters')
        self.endpoint = app_url.rstrip('/') + '/api/internal/vocal-jobs'
        self.headers = {'Authorization': f'Bearer {secret}', 'Content-Type': 'application/json'}
        if bypass:
            self.headers['x-vercel-protection-bypass'] = bypass
        self.storage_origin = storage_origin
        self.opener = urllib.request.build_opener(NoRedirect())

    def send(self, action, **payload):
        request = urllib.request.Request(self.endpoint, json.dumps(dict(action=action, **payload)).encode(), self.headers)
        with self.opener.open(request, timeout=60) as response:
            return json.loads(response.read(2_000_001))

    def download(self, job, target):
        url = owned_source(job['sourceUrl'], job['userId'], self.storage_origin)
        digest, size = hashlib.sha256(), 0
        # Do not send worker credentials or deployment bypass to Storage.
        with self.opener.open(url, timeout=60) as response, target.open('xb') as output:
            if int(response.headers.get('Content-Length', 0)) > MAX_BYTES:
                raise InputInvalid('Audio exceeds 25 MB')
            while chunk := response.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise InputInvalid('Audio exceeds 25 MB')
                digest.update(chunk)
                output.write(chunk)
        if not size or digest.hexdigest() != job['sourceSha256']:
            raise InputInvalid('Original audio changed or is empty')


def run_analysis_command(command, log, timeout=1100):
    """A timed-out pipeline must not leave separation/model children running."""
    process = subprocess.Popen(command, stdout=log, stderr=log, start_new_session=True)
    try:
        return_code = process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        # The pipeline may be waiting on Demucs. Stop the entire private group.
        for sig in (signal.SIGTERM, signal.SIGKILL):
            try:
                os.killpg(process.pid, sig)
            except ProcessLookupError:
                pass
            if sig == signal.SIGTERM:
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    pass
        process.wait()
        raise
    if return_code:
        raise subprocess.CalledProcessError(return_code, command)


def analyze(audio, result, log):
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration', '-of', 'json', str(audio)], timeout=30))
    duration = float(probe['format']['duration'])
    if not math.isfinite(duration) or not 0 < duration <= 600:
        raise InputInvalid('Use audio up to ten minutes long')
    # Default language detection; do not constrain every uploaded song to English.
    run_analysis_command([sys.executable, str(Path(__file__).with_name('pipeline.py')), str(audio),
        '--output', str(result), '--asr-model', os.environ.get('WALVR_ASR_MODEL', 'small')],
        log)
    return json.loads(result.read_text()), duration


def run_once(client, analyzer=analyze):
    job = client.send('claim').get('job')
    if not job:
        return False
    lease = dict(videoId=job['videoId'], token=job['token'])
    stop, stale = threading.Event(), threading.Event()

    def heartbeat():
        while not stop.wait(60):
            try:
                if client.send('heartbeat', **lease).get('status') == 'stale':
                    stale.set()
                    return
            except Exception:
                # The database lease is authoritative; transient failures aren't a refund.
                pass

    thread = threading.Thread(target=heartbeat, daemon=True)
    thread.start()
    reporting_result = False
    try:
        with tempfile.TemporaryDirectory(prefix='walvr-job-') as work:
            os.chmod(work, 0o700)
            root = Path(work)
            audio, result = root / 'original.audio', root / 'analysis.json'
            client.download(job, audio)
            with (root / 'analysis.log').open('w') as log:
                output, duration = analyzer(audio, result, log)
            if stale.is_set():
                return True
            reporting_result = True
            # HTTP retries repeat a fenced completion only, never the paid render.
            for attempt in range(3):
                try:
                    client.send('complete', **lease, result=output, originalDuration=duration)
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    stop.wait(2)
    except InputInvalid:
        if not stale.is_set() and not reporting_result:
            client.send('fail', **lease, reason='input_invalid')
    except Exception:
        # A completion request can have persisted even if every response was lost.
        # Leave uncertain reports to the fenced database state / lease recovery.
        # Do not turn a reporting outage into an analysis failure and refund.
        if not stale.is_set() and not reporting_result:
            client.send('fail', **lease, reason='analysis_failed')
    finally:
        stop.set()
        thread.join(timeout=2)
    return True


def prepare_models(asr_model, language):
    # Bound startup downloads and reclaim the model-loading process's memory.
    with tempfile.TemporaryFile(mode='w+') as log:
        run_analysis_command([sys.executable, str(Path(__file__).with_name('preflight.py')),
                              '--warm-models', '--asr-model', asr_model, '--language', language],
                             log, timeout=600)
        log.seek(0)
        result = json.loads(log.read().strip().splitlines()[-1])
    if result.get('modelsWarmed') is not True:
        raise RuntimeError('Model warmup did not confirm readiness')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    # Check runtime and models in a bounded child before claiming any job.
    # A native crash is then reported as startup failure, not a worker crash.
    try:
        client = Client(os.environ['WALVR_APP_URL'], os.environ['WALVR_VOCAL_WORKER_SECRET'],
                        os.environ['WALVR_STORAGE_ORIGIN'], os.environ.get('WALVR_PREVIEW_BYPASS_TOKEN'))
        readiness = prepare_models(os.environ.get('WALVR_ASR_MODEL', 'small'),
                                   os.environ.get('WALVR_WARM_LANGUAGE', 'en'))
        print(json.dumps({'worker': 'vocal-timing', 'readiness': readiness}), flush=True)
    except Exception:
        print(json.dumps({'worker': 'vocal-timing', 'startupFailed': True,
                          'reason': 'configuration_runtime_cache_or_model_unavailable'}), flush=True)
        raise SystemExit(1)
    while True:
        try:
            handled = run_once(client)
            print(json.dumps({'worker': 'vocal-timing', 'handled': handled}), flush=True)
        except Exception:
            print(json.dumps({'worker': 'vocal-timing', 'retry': True}), flush=True)
        if args.once:
            return
        time.sleep(5)


if __name__ == '__main__':
    main()

