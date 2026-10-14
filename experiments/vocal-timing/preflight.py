"""Host readiness checks. No queue claims, credentials, or audio uploads."""
import importlib
import gc
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


def warm_models(asr_model='small', language='en'):
    """Load each model once. No customer audio, queue calls, or credentials."""
    import torch
    from demucs.pretrained import get_model
    from faster_whisper import WhisperModel
    import whisperx
    torch.set_num_threads(2)
    separation = get_model('htdemucs')
    del separation
    gc.collect()
    recognition = WhisperModel(asr_model, device='cpu', compute_type='int8', cpu_threads=2)
    del recognition
    gc.collect()
    alignment, metadata = whisperx.load_align_model(language_code=language, device='cpu')
    del alignment, metadata
    gc.collect()
    return {'runtimeReady': True, 'modelsWarmed': True, 'asrModel': asr_model,
            'separationModel': 'htdemucs', 'alignmentLanguages': [language], 'device': 'cpu'}


if __name__ == '__main__':
    import argparse
    import json
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--warm-models', action='store_true')
    parser.add_argument('--asr-model', default='small')
    parser.add_argument('--language', default='en')
    args = parser.parse_args()
    result = check_runtime()
    if args.warm_models:
        result = warm_models(args.asr_model, args.language)
    print(json.dumps(result), flush=True)
