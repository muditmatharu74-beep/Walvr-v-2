"""Host readiness checks. No queue claims, credentials, or audio uploads."""
import importlib
import os
from pathlib import Path
import subprocess
import tempfile

os.environ['ORT_DISABLE_TELEMETRY'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'


def check_runtime():
    for binary in ('ffmpeg', 'ffprobe'):
        subprocess.run([binary, '-version'], stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, check=True, timeout=10)
    for module in ('torch', 'torchaudio', 'av', 'ctranslate2', 'faster_whisper',
                   'demucs', 'whisperx.alignment', 'whisperx.audio', 'librosa', 'soundfile'):
        importlib.import_module(module)
    for name, default in [('HF_HOME', '~/.cache/huggingface'), ('TORCH_HOME', '~/.cache/torch')]:
        directory = Path(os.environ.get(name, default)).expanduser()
        directory.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryFile(dir=directory) as probe:
            probe.write(b'cache-write-check')
    return {'runtimeReady': True, 'modelsWarmed': False}


if __name__ == '__main__':
    import json
    print(json.dumps(check_runtime()))
