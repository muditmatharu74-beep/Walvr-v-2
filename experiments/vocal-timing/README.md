# Vocal timing pilot

Offline experiment for the proposed Walvr backend stages:

1. Decode an original audio file without changing its sample clock.
2. Separate vocals with Demucs htdemucs.
3. Recognize vocals with faster-whisper (small by default).
4. Force-align the recognized words with WhisperX's language-specific model.
5. Detect beats from the original mixture with librosa.
6. Return absolute caption/beat timestamps, analysis provenance and review flags.

The original file remains read-only and would be used unchanged in the final
render. This script does not submit renders, change billing, or connect to Create.
It is a pilot, not an enabled production feature. Recognition and alignment
models are speech models: successful execution is not proof of lyric accuracy.
The detected beats also require music-specific review before replacing cuts.

## CPU setup (Python 3.12, ffmpeg/ffprobe)

Use an isolated environment; the ML packages do not belong in the Next.js bundle.

```sh
python -m venv /tmp/walvr-audio
/tmp/walvr-audio/bin/pip install torch==2.8.0 torchaudio==2.8.0 --index-url https://download.pytorch.org/whl/cpu
/tmp/walvr-audio/bin/pip install -r experiments/vocal-timing/requirements-cpu.txt
/tmp/walvr-audio/bin/pip install whisperx==3.8.6 --no-deps
/tmp/walvr-audio/bin/python -c "import nltk; nltk.download('punkt_tab')"
```

WhisperX uses lazy imports. Only its alignment/audio modules are used; its separate
ASR, diarization, torchvision and CUDA dependencies are intentionally omitted.
The recognition step uses faster-whisper directly with VAD. Models are downloaded
on first use. No external service account or API key is required for this pilot.

```sh
OMP_NUM_THREADS=2 /tmp/walvr-audio/bin/python experiments/vocal-timing/pipeline.py \
  /private/song.mp3 --output /private/song-analysis.json \
  --start 10 --seconds 30 --baseline --language en
```

Omit the excerpt options to analyze a whole song. Omit `--language` for automatic
language detection. A supplied language is a constraint, not evidence that the
recording is in that language. The small model is a feasibility baseline; larger
models and separated-vs-original comparisons must be evaluated on music before
selecting a production configuration.

Outputs include private lyric text and must stay outside this public repository.
Normal stage logs contain counts only. Missing word timings are rejected rather
than interpolated or fabricated; excerpt offsets are restored to the full song.
An empty result or incomplete alignment sets `reviewRequired`. That flag does not
catch every semantic hallucination, and alignment scores are not calibrated
probabilities of lyric accuracy. Output is written atomically after success.

## Validation and rollout

```sh
python -m unittest discover -s experiments/vocal-timing -p 'test_*.py'
```

Before connecting to Create: compare complete songs against manually checked
lyrics/timings, measure cold/warm runtime and memory, and evaluate quiet vocals,
fast rap, held notes, repeated choruses and instrumental breaks. Choose a worker
runtime and durable job orchestration based on those measurements. A worker must
receive only owner-verified inputs, persist results privately, preserve the
original audio clock and return an explicit failure/review state. Keep the
existing atomic charge/refund rules and render submission uncertainty handling.
Do not put a long synchronous ML subprocess inside the current process route.

References: [Demucs](https://github.com/facebookresearch/demucs),
[WhisperX](https://github.com/m-bain/whisperX),
[faster-whisper](https://github.com/SYSTRAN/faster-whisper),
[librosa beat tracking](https://librosa.org/doc/latest/generated/librosa.beat.beat_track.html).
