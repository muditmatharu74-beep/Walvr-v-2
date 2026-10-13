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
The recognition step uses faster-whisper directly. Models are downloaded
on first use. No external service account or API key is required for this pilot.
The pipeline sets `ORT_DISABLE_TELEMETRY=1` and `HF_HUB_DISABLE_TELEMETRY=1`
before native/model imports. Model downloads are still required on a cold run;
runtime telemetry is not part of the audio-analysis workflow.

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

Speech VAD is now disabled by default for sung vocals. `--vad-filter` enables
it for an explicit comparison run; it must not silently remove sung passages.
This is a candidate configuration, not a verified accuracy improvement. Run
both configurations against the same excerpt and manually compare missing,
wrong, early, and late words before selecting it for the worker.

### Empty-separation recovery

The pipeline now checks the original mix once when the vocal-stem recognition
has no alphabetic lyric text. It retains the normal recognition thresholds;
silence is not forced into words. The mix must contain at least one ASR word
with a finite, positive-length timestamp before it becomes a candidate.
The alignment input follows the selected recognition source: vocals for the
normal path, original audio for a mix candidate. Both share the unchanged
source clock. A mix fallback always requires review, so it cannot automatically
pass the final-render adapter or become a paid worker render.

Private diagnostics include recognition source, language probability, original
and vocal segment counts, and review reasons. `--baseline` can compare the
original even when separation succeeds. More words alone do not choose the mix.

On 2026-10-12, the updated path aligned 73 words from a 25-second excerpt of
the working upload. A 45-second excerpt of the difficult upload returned no
vocal segments and only one zero-length original-mix word, which the new
candidate gate rejects. These are feasibility checks, not human lyric accuracy
measurements, and do not establish that the difficult upload is instrumental.

The medium-model comparison on the same difficult 25-second excerpt also
returned zero original-mix and vocal segments. On the working 25-second excerpt,
both small and medium produced 73 aligned words. These measurements alone do
not justify changing the default from small or declaring either model accurate.

Separate left/right recognition on the difficult excerpt returned only the
word "Music" in each channel. Results with fewer than three aligned words in
an excerpt of at least 15 seconds now require review. This is a conservative
screen, not a proof of hallucination: a real sparse lyric can also need review.

Pilot comparison (2026-10-11): the same 45-second music excerpt produced
104 aligned words without speech VAD and 103 with it after vocal separation.
Neither run rejected word timestamps; these counts do not establish lyric
accuracy. A separate 25-second excerpt produced no lyrics even with VAD off
and was rejected by the renderer handoff. Removing speech VAD therefore does
not resolve every failed upload. Both require listening and reference timing
checks before any production claim.

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

## Human timing review

For an analyzed song, generate a private excerpt with the original audio and
one word shown per aligned interval:

```sh
python experiments/vocal-timing/render_review.py /private/song.mp3 \
  /private/song-analysis.json /private/timing-review.mp4 --start 10 --seconds 30
```

This simple ffmpeg/libass clip checks timing, not the production Remotion layout
or final background design. It does not consume render credits. Review the
first word, fast passages, sustained notes and caption-free gaps against the
singer. A human review is still required even if all words receive timestamps.

## Checked renderer handoff

`src/lib/rendering/vocal-timing.ts` accepts analysis only when the original
upload hash and independently measured duration match. It checks every word
and beat against the original clock, refuses empty/invalid lyric timings,
and prevents a partial analysis from becoming a full-song render. Timestamp
offsets are already absolute and must never be applied a second time.

Rehearse the handoff without a provider submission or credit charge:

```sh
node scripts/prepare-vocal-render.cjs /private/song.mp3 \
  /private/song-analysis.json /private/render-input.json clean-neon
```

Use `--review` as a fifth argument for a partial or flagged result. This emits
private renderer props bound to the **original** audio file and original
duration, not the vocals stem. The renderer adapter is not called by Create
yet; output has `providerSubmissionAllowed: false`. Automated screening is
not human verification, including when `reviewRequired` is false.

The staged Create integration now lives in `src/lib/rendering/vocal-jobs.ts`,
the internal worker API and `worker.py`. It is disabled by default and requires
a reviewed preview database plus a supervised worker host before activation.
See [the rollout guide](../../docs/vocal-worker-rollout.md) for its queue, lease,
result validation and submission uncertainty handling. The browser must never
supply a trusted analysis or bypass a review flag.
