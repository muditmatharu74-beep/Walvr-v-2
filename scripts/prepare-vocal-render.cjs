// Offline adapter rehearsal. No provider submission, credits, or app auth bypass.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const ts = require('typescript');
function load(file) {
  const mod = {exports: {}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, {module: mod, exports: mod.exports});
  return mod.exports;
}
function run(args) {
  const [audio, analysis, output, style, mode] = args;
  if (![4, 5].includes(args.length) || !['clean-neon', 'pixel-neon'].includes(style) ||
      (mode !== undefined && mode !== '--review')) throw Error('Use: audio analysis output caption-style [--review]');
  const destination = path.resolve(output);
  const repo = path.resolve(__dirname, '..');
  if (destination === repo || destination.startsWith(repo + path.sep) ||
      [audio, analysis].some(input => path.resolve(input) === destination)) throw Error('Keep private render inputs outside the repository and do not overwrite a source');
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(audio)).digest('hex');
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', audio], {encoding: 'utf8'}));
  const timing = load('src/lib/rendering/vocal-timing.ts').vocalTimingForRender(
    JSON.parse(fs.readFileSync(analysis, 'utf8')), {sha256, duration: Number(probe.format.duration)}, {reviewOnly: mode === '--review'});
  load('src/lib/rendering/transcription-quality.ts').assertUsableTranscription(timing, true);
  const payload = {
    experimental: true, providerSubmissionAllowed: false,
    audioFile: path.resolve(audio), sourceSha256: sha256,
    reviewOnly: mode === '--review', needsReview: timing.needsReview, humanVerified: false,
    renderProps: {captions: timing.words, beats: timing.beats, songDuration: timing.duration, captionStyle: style},
  };
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, JSON.stringify(payload, null, 2), {flag: 'wx', mode: 0o600});
  console.log(JSON.stringify({prepared: true, words: timing.words.length, beats: timing.beats.length,
    reviewOnly: payload.reviewOnly, needsReview: payload.needsReview}));
}
module.exports = {run};
if (require.main === module) {try {run(process.argv.slice(2));} catch (error) {console.error(error.message); process.exitCode = 1;}}
