"""Offline vocal separation / forced-alignment pilot. Never submits a render.

The original audio is read-only. All analysis uses the same decoded sample clock;
excerpt offsets are restored before emitting Walvr caption and beat timestamps.
"""
import argparse
import gc
import hashlib
import json
import math
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# Disable runtime/model telemetry before any native or ML package initializes.
# ONNX's API opt-out alone can occur after its initialization telemetry event.
os.environ['ORT_DISABLE_TELEMETRY'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'


def private_output_path(audio, output, repo):
    destination = output.resolve()
    if destination == audio.resolve():
        raise ValueError('Analysis must not overwrite the original audio')
    if destination.is_relative_to(repo.resolve()):
        raise ValueError('Save private transcripts outside the repository')
    return destination


def checked_words(words, offset, duration):
    accepted, rejected = [], 0
    previous = -1.0
    for item in words:
        start, end, text = item.get('start'), item.get('end'), item.get('word')
        if (not isinstance(text, str) or not text.strip() or
            isinstance(start, bool) or isinstance(end, bool) or
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


def has_lyric_text(segments):
    """Empty/punctuation/music-marker output is not a usable recognition path."""
    return any(isinstance(s.get('text'), str) and any(c.isalpha() for c in s['text'])
               for s in segments)


def choose_recognition(vocals, original=None):
    """Prefer separated vocals. A mix fallback is a review candidate, not proof."""
    if has_lyric_text(vocals):
        return vocals, 'vocals', False
    # An empty separation plus a zero-length ASR word is not a recovered lyric.
    timed_original = original is not None and any(
        isinstance(w.get('word'), str) and any(c.isalpha() for c in w['word']) and
        isinstance(w.get('start'), (int, float)) and not isinstance(w['start'], bool) and
        isinstance(w.get('end'), (int, float)) and not isinstance(w['end'], bool) and
        math.isfinite(w['start']) and math.isfinite(w['end']) and
        0 <= w['start'] < w['end']
        for s in original for w in s.get('words', []))
    if timed_original and has_lyric_text(original):
        return original, 'original_mix', True
    return [], 'none', True


def review_reasons_for(words, rejected, coverage, source, excerpt_duration):
    reasons = []
    if not words:
        reasons.append('no_usable_lyrics')
    if source == 'original_mix':
        reasons.append('original_mix_fallback')
    if rejected:
        reasons.append('rejected_alignment_words')
    if words and coverage < 0.9:
        reasons.append('partial_alignment')
    # A long instrumental or failed recognizer can return a single "Music" word.
    # Flag sparsity, rather than deleting a word that might be a genuine lyric.
    # A few scattered phrases across a full song also exceed the old count gate.
    if words and excerpt_duration >= 15 and (len(words) < 3 or
            (excerpt_duration >= 30 and len(words) / excerpt_duration < 0.1)):
        reasons.append('sparse_recognition')
    return reasons


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('audio', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--start', type=float, default=0)
    parser.add_argument('--seconds', type=float)
    parser.add_argument('--language', default=None, help='Optional known vocal language, e.g. en; otherwise detect')
    parser.add_argument('--asr-model', default='small')
    parser.add_argument('--vad-filter', action='store_true',
                        help='Enable speech VAD for a comparison run; default off for sung vocals')
    parser.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    parser.add_argument('--baseline', action='store_true', help='Also recognize the original excerpt for comparison')
    args = parser.parse_args()
    if not args.audio.is_file() or args.start < 0 or not math.isfinite(args.start):
        parser.error('Provide a local audio file and finite nonnegative start')
    if args.seconds is not None and (not math.isfinite(args.seconds) or args.seconds <= 0):
        parser.error('seconds must be finite and positive')
    # Private results must not go into the public source repository.
    repo = Path(__file__).resolve().parents[2]
    try:
        private_output_path(args.audio, args.output, repo)
    except ValueError as error:
        parser.error(str(error))
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
                beam_size=5, vad_filter=args.vad_filter, word_timestamps=True,
                condition_on_previous_text=False)
            result = [{'start': s.start, 'end': s.end, 'text': s.text,
                       'words': [{'word': w.word, 'start': w.start, 'end': w.end} for w in s.words or []]}
                      for s in segments]
            return result, info.language, float(info.language_probability)
        original_result = recognize(original) if args.baseline else None
        vocal_result = recognize(vocals)
        # Separation can remove or distort vocals. Check the original once before
        # declaring recognition empty, without relaxing silence/hallucination guards.
        if not has_lyric_text(vocal_result[0]) and original_result is None:
            print(json.dumps({'stage': 'original_mix_check'}), flush=True)
            original_result = recognize(original)
        segments, recognition_source, fallback_review = choose_recognition(
            vocal_result[0], original_result[0] if original_result else None)
        selected_result = original_result if recognition_source == 'original_mix' else vocal_result
        language, language_probability = selected_result[1:]
        alignment_audio = original if recognition_source == 'original_mix' else vocals
        baseline = original_result[0] if args.baseline and original_result else None
        del model
        gc.collect()
        print(json.dumps({'stage': 'alignment', 'segments': len(segments), 'language': language}), flush=True)
        if segments:
            alignment_model, metadata = whisperx.load_align_model(language_code=language, device=args.device)
            aligned = whisperx.align(segments, alignment_model, metadata,
                whisperx.load_audio(str(alignment_audio)), args.device, interpolate_method='ignore',
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
        review_reasons = review_reasons_for(words, rejected, coverage, recognition_source,
                                           len(source_samples) / sr)
        output = {'schemaVersion': 1, 'experimental': True, 'sourceSha256': source_hash,
            'songDuration': duration, 'excerptStart': args.start,
            'excerptDuration': len(source_samples) / sr, 'language': language,
            'text': ' '.join(s['text'].strip() for s in segments), 'words': words, 'beats': beats,
            'reviewRequired': fallback_review or bool(review_reasons),
            'diagnostics': {'asrModel': args.asr_model, 'vadFilter': args.vad_filter,
                'separationModel': 'htdemucs', 'alignmentModel': 'whisperx',
                'humanVerified': False,
                'recognitionSource': recognition_source,
                'languageProbability': language_probability,
                'reviewReasons': review_reasons,
                'vocalSegmentCount': len(vocal_result[0]),
                'originalSegmentCount': len(original_result[0]) if original_result else None,
                'elapsedSeconds': round(time.monotonic() - started, 2),
                'rejectedWords': rejected, 'alignmentCoverage': round(coverage, 3),
                'baseline': baseline, 'separatedSegments': vocal_result[0],
                'originalSegments': original_result[0] if original_result else None}}
        if hashlib.sha256(args.audio.read_bytes()).hexdigest() != source_hash:
            raise RuntimeError('Source file changed during analysis')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # Failures never leave a partial result that could be consumed as a successful job.
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf8', dir=args.output.parent,
                                         prefix=args.output.name + '.', delete=False) as handle:
            temporary = Path(handle.name)
        try:
            with temporary.open('w', encoding='utf8') as handle:
                json.dump(output, handle, ensure_ascii=False, indent=2)
            temporary.replace(args.output)
        finally:
            temporary.unlink(missing_ok=True)
        print(json.dumps({'stage': 'done', 'words': len(words), 'beats': len(beats),
                          'reviewRequired': output['reviewRequired'],
                          'elapsedSeconds': output['diagnostics']['elapsedSeconds']}), flush=True)


if __name__ == '__main__':
    main()

