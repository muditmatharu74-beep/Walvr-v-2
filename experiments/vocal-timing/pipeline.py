"""Offline vocal separation / forced-alignment pilot. Never submits a render.

The original audio is read-only. All analysis uses the same decoded sample clock;
excerpt offsets are restored before emitting Walvr caption and beat timestamps.
"""
import argparse
import gc
import hashlib
import json
import math
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def checked_words(words, offset, duration):
    accepted, rejected = [], 0
    previous = -1.0
    for item in words:
        start, end, text = item.get('start'), item.get('end'), item.get('word')
        if (not isinstance(text, str) or not text.strip() or
            not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or
            not math.isfinite(start) or not math.isfinite(end) or
            start < 0 or end <= start or end + offset > duration + 0.05 or start < previous):
            rejected += 1
            continue
        score = item.get('score')
        accepted.append({'word': text.strip(), 'start': round(start + offset, 3),
                         'end': round(min(end + offset, duration), 3),
                         'alignmentScore': score if isinstance(score, (int, float)) and math.isfinite(score) else None})
        previous = start
    return accepted, rejected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('audio', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--start', type=float, default=0)
    parser.add_argument('--seconds', type=float)
    parser.add_argument('--language', default=None, help='Optional known vocal language, e.g. en; otherwise detect')
    parser.add_argument('--asr-model', default='small')
    parser.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    parser.add_argument('--baseline', action='store_true', help='Also recognize the original excerpt for comparison')
    args = parser.parse_args()
    if not args.audio.is_file() or args.start < 0 or not math.isfinite(args.start):
        parser.error('Provide a local audio file and finite nonnegative start')
    if args.seconds is not None and (not math.isfinite(args.seconds) or args.seconds <= 0):
        parser.error('seconds must be finite and positive')
    # Private results must not go into the public source repository.
    repo = Path(__file__).resolve().parents[2]
    if args.output.resolve().is_relative_to(repo):
        parser.error('Save private transcripts outside the repository')
    source_hash = hashlib.sha256(args.audio.read_bytes()).hexdigest()
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration', '-of', 'json', str(args.audio)]))
    duration = float(probe['format']['duration'])
    if args.start >= duration:
        parser.error('start must precede the end of the source')
    import torch
    torch.set_num_threads(2)
    import soundfile as sf
    import librosa
    import whisperx
    from faster_whisper import WhisperModel
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix='walvr-vocals-') as work:
        original = Path(work) / 'original.wav'
        command = ['ffmpeg', '-v', 'error', '-nostdin', '-i', str(args.audio), '-ss', str(args.start)]
        if args.seconds is not None:
            command += ['-t', str(args.seconds)]
        subprocess.run(command + ['-ar', '44100', '-ac', '2', str(original)], check=True)
        print(json.dumps({'stage': 'separation'}), flush=True)
        subprocess.run([sys.executable, '-m', 'demucs.separate', '--two-stems', 'vocals',
            '-n', 'htdemucs', '--shifts', '0', '-d', args.device, '-j', '1',
            '-o', work, str(original)], check=True)
        vocals = Path(work) / 'htdemucs' / 'original' / 'vocals.wav'
        source_samples, sr = sf.read(original)
        vocal_samples, vocal_sr = sf.read(vocals)
        if sr != vocal_sr or len(source_samples) != len(vocal_samples):
            raise RuntimeError('Separated vocals changed the source clock; refusing shifted captions')
        print(json.dumps({'stage': 'recognition'}), flush=True)
        model = WhisperModel(args.asr_model, device=args.device,
            compute_type='int8' if args.device == 'cpu' else 'float16', cpu_threads=2)
        def recognize(path):
            segments, info = model.transcribe(whisperx.load_audio(str(path)), language=args.language,
                beam_size=5, vad_filter=True, word_timestamps=True,
                condition_on_previous_text=False)
            result = [{'start': s.start, 'end': s.end, 'text': s.text,
                       'words': [{'word': w.word, 'start': w.start, 'end': w.end} for w in s.words or []]}
                      for s in segments]
            return result, info.language
        baseline = recognize(original)[0] if args.baseline else None
        segments, language = recognize(vocals)
        del model
        gc.collect()
        print(json.dumps({'stage': 'alignment', 'segments': len(segments), 'language': language}), flush=True)
        if segments:
            alignment_model, metadata = whisperx.load_align_model(language_code=language, device=args.device)
            aligned = whisperx.align(segments, alignment_model, metadata,
                whisperx.load_audio(str(vocals)), args.device, interpolate_method='ignore',
                return_char_alignments=False)
            words, rejected = checked_words(aligned['word_segments'], args.start, duration)
        else:
            words, rejected = [], 0
        # Beats use the original mixture, not the separated voice or estimated lyric sections.
        mixture, beat_sr = librosa.load(original, sr=22050)
        tempo, beat_frames = librosa.beat.beat_track(y=mixture, sr=beat_sr)
        beats = [round(float(t) + args.start, 3) for t in librosa.frames_to_time(beat_frames, sr=beat_sr)
                 if float(t) + args.start < duration]
        expected_words = sum(len(s['text'].split()) for s in segments)
        coverage = len(words) / max(1, expected_words)
        output = {'schemaVersion': 1, 'experimental': True, 'sourceSha256': source_hash,
            'songDuration': duration, 'excerptStart': args.start,
            'excerptDuration': len(source_samples) / sr, 'language': language,
            'text': ' '.join(s['text'].strip() for s in segments), 'words': words, 'beats': beats,
            'reviewRequired': not words or rejected > 0 or coverage < 0.9,
            'diagnostics': {'elapsedSeconds': round(time.monotonic() - started, 2),
                'rejectedWords': rejected, 'alignmentCoverage': round(coverage, 3),
                'baseline': baseline, 'separatedSegments': segments}}
        if hashlib.sha256(args.audio.read_bytes()).hexdigest() != source_hash:
            raise RuntimeError('Source file changed during analysis')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # Failures never leave a partial result that could be consumed as a successful job.
        temporary = args.output.with_suffix('.tmp')
        temporary.write_text(json.dumps(output, ensure_ascii=False, indent=2))
        temporary.chmod(0o600)
        temporary.replace(args.output)
        print(json.dumps({'stage': 'done', 'words': len(words), 'beats': len(beats),
                          'reviewRequired': output['reviewRequired'],
                          'elapsedSeconds': output['diagnostics']['elapsedSeconds']}), flush=True)


if __name__ == '__main__':
    main()
