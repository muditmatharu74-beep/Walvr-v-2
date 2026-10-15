import hashlib
import os
import subprocess
import sys
import time
from pathlib import Path
import tempfile
import unittest
from worker import Client, InputInvalid, owned_source, run_once, run_analysis_command


class WorkerTests(unittest.TestCase):
    @unittest.skipUnless(os.name == 'posix', 'Worker host uses POSIX process groups')
    def test_analysis_timeout_stops_a_stubborn_descendant(self):
        with tempfile.TemporaryDirectory() as work:
            marker = Path(work) / 'heartbeat'
            child = ('import signal,time,pathlib; signal.signal(signal.SIGTERM,signal.SIG_IGN); '
                     'p=pathlib.Path(' + repr(str(marker)) + '); '
                     '\nwhile True:\n p.write_text(str(time.monotonic())); time.sleep(.02)')
            parent = ('import subprocess,sys,time; subprocess.Popen([sys.executable,"-c",' +
                      repr(child) + ']); time.sleep(30)')
            with (Path(work) / 'log').open('w') as log:
                with self.assertRaises(subprocess.TimeoutExpired):
                    run_analysis_command([sys.executable, '-c', parent], log, timeout=.5)
            self.assertTrue(marker.exists(), 'The descendant must start for this check')
            heartbeat = marker.read_text()
            time.sleep(.1)
            self.assertEqual(marker.read_text(), heartbeat, 'Descendant survived the timeout')

    def test_analysis_nonzero_exit_is_not_a_success(self):
        with tempfile.TemporaryFile(mode='w') as log:
            with self.assertRaises(subprocess.CalledProcessError):
                run_analysis_command([sys.executable, '-c', 'raise SystemExit(7)'], log)

    def test_worker_configuration_and_owned_uploads(self):
        origin = 'https://storage.example.test'
        good = origin + '/storage/v1/object/public/uploads/owner/song.mp3'
        self.assertEqual(owned_source(good, 'owner', origin), good)
        for bad in [good.replace('owner', 'other'), good.replace(origin, 'https://evil.test'),
                    good + '?redirect=evil', good.replace('song.mp3', 'nested%2Fsong.mp3')]:
            with self.assertRaises(InputInvalid):
                owned_source(bad, 'owner', origin)
        for url in ['http://localhost', 'https://app.test?key=secret', 'https://u:p@app.test']:
            with self.assertRaises(ValueError):
                Client(url, 'x' * 32, origin)

    def test_download_caps_and_hash_are_checked_without_sending_worker_secret(self):
        class Response:
            headers = {}
            def __init__(self, content): self.content = content
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, n):
                result, self.content = self.content[:n], self.content[n:]
                return result
        class Opener:
            def open(self, request, **kwargs):
                self.request = request
                return Response(b'original')
        client = Client('https://app.test', 'secret' * 6, 'https://storage.test', 'bypass')
        client.opener = Opener()
        job = dict(sourceUrl='https://storage.test/storage/v1/object/public/uploads/owner/song.mp3',
                   userId='owner', sourceSha256=hashlib.sha256(b'original').hexdigest())
        with tempfile.TemporaryDirectory() as work:
            client.download(job, Path(work) / 'audio')
            self.assertIsInstance(client.opener.request, str)
            job['sourceSha256'] = '0' * 64
            with self.assertRaises(InputInvalid):
                client.download(job, Path(work) / 'changed')

    def test_lost_completion_response_repeats_fenced_report_not_analysis(self):
        class Fake:
            calls = []
            completes = 0
            def send(self, action, **payload):
                self.calls.append((action, payload))
                if action == 'claim': return {'job': {'videoId': 'video', 'token': 'token'}}
                if action == 'complete':
                    self.completes += 1
                    if self.completes == 1: raise OSError('response lost')
                    return {'status': 'stale'}
                raise AssertionError(action)
            def download(self, job, target): target.write_bytes(b'original')
        analyzed = []
        def analyze(audio, result, log):
            analyzed.append(audio.read_bytes())
            return {'words': []}, 10
        fake = Fake()
        self.assertTrue(run_once(fake, analyze))
        self.assertEqual(analyzed, [b'original'])
        self.assertEqual([action for action, _ in fake.calls], ['claim', 'complete', 'complete'])
        self.assertEqual(fake.calls[1][1], fake.calls[2][1])

    def test_bad_input_fails_before_analysis(self):
        class Fake:
            calls = []
            def send(self, action, **payload):
                self.calls.append((action, payload))
                return {'job': {'videoId': 'video', 'token': 'token'}} if action == 'claim' else {'status': 'failed'}
            def download(self, job, target): raise InputInvalid('changed upload')
        fake = Fake()
        run_once(fake, lambda *args: self.fail('must not analyze bad input'))
        self.assertEqual(fake.calls[-1], ('fail', {'videoId': 'video', 'token': 'token', 'reason': 'input_invalid'}))

    def test_exhausted_completion_reports_do_not_fail_or_refund_the_job(self):
        class Fake:
            def __init__(self, error): self.calls, self.error = [], error
            def send(self, action, **payload):
                self.calls.append((action, payload))
                if action == 'claim':
                    return {'job': {'videoId': 'video', 'token': 'token'}}
                if action == 'complete':
                    raise self.error('completion response unavailable')
                raise AssertionError('Uncertain completion must not send ' + action)
            def download(self, job, target): target.write_bytes(b'original')
        analyzed, paths = [], []
        def analyze(audio, result, log):
            analyzed.append(audio.read_bytes())
            paths.append(audio.parent)
            return {'words': []}, 10
        for error in (OSError, InputInvalid):
            with self.subTest(error=error):
                fake = Fake(error)
                self.assertTrue(run_once(fake, analyze))
                self.assertEqual([action for action, _ in fake.calls],
                                 ['claim', 'complete', 'complete', 'complete'])
                self.assertEqual(fake.calls[1][1], fake.calls[3][1])
                self.assertFalse(paths[-1].exists(), 'Private audio must be removed after reporting failure')
        self.assertEqual(analyzed, [b'original', b'original'])

    def test_analysis_crash_still_reports_failure_and_cleans_audio(self):
        class Fake:
            def __init__(self): self.calls = []
            def send(self, action, **payload):
                self.calls.append((action, payload))
                return {'job': {'videoId': 'video', 'token': 'token'}} if action == 'claim' else {'status': 'failed'}
            def download(self, job, target): target.write_bytes(b'original')
        paths = []
        def analyze(audio, result, log):
            paths.append(audio.parent)
            raise RuntimeError('model crashed')
        fake = Fake()
        self.assertTrue(run_once(fake, analyze))
        self.assertEqual(fake.calls[-1], ('fail', {'videoId': 'video', 'token': 'token', 'reason': 'analysis_failed'}))
        self.assertFalse(paths[0].exists())


if __name__ == '__main__':
    unittest.main()

