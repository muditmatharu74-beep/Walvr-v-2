# Original pixel-art night ride

Walvr's built-in `pixel-ride` background uses original code-drawn artwork:
a rear-view motorcyclist, banded sunset, skyline, neon perspective road,
passing palms and light rain. No stock footage, downloaded sprites, remote
images, music or video-generation service are used.

The 270 x 480 scene scales to portrait exports. Movement is computed from
absolute video time, quantized to 15 fps and repeats every 12 seconds.
The rider sits above the existing neon-caption baseline; the caption band is
darkened. Caption sizing, fades, lyric timestamps and original song audio
remain unchanged.

## Review

Open `/caption-preview#pixel-ride` for a silent animated preview. Pause/play,
caption visibility and Clean/Pixel Neon controls are available. The preview
respects reduced-motion preferences. It is a visual review, not a test of
lyric accuracy or live paid rendering.

The MP4 workflow exports `walvr-original-pixel-ride.mp4` (13 seconds, silent,
including a full 12-second repeat), a PNG and a four-second caption sample.
It checks portrait dimensions, duration, motion, repeat consistency and
visible caption pixels. Unit tests verify deterministic seeking, exact loop
periodicity, background precedence, original audio and preview-only selection.

## Preview activation

Set `WALVR_NEON_BACKGROUND_STYLE=pixel-ride` only for the
`feature/neon-captions` Vercel preview. It overrides the older configured
footage for Dark Lyrics, including the future vocal-worker path. Other
branches and production ignore this flag. Unsupported preview values fail
configuration checks before reservation.

Publish the matching Remotion bundle and pin the branch's
`REMOTION_SERVE_URL` to that commit-specific site before testing Create.
The browser preview alone does not update the Lambda bundle.
Removing the style flag restores the existing configured footage.
Railway is not required to draw or export this background; it is still
needed for the planned continuously running vocal-analysis worker.
