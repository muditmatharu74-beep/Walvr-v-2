const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mod = {exports: {}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/rendering/vocal-timing.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, {module: mod, exports: mod.exports});
const {vocalTimingForRender} = mod.exports;
const original = {sha256: 'a'.repeat(64), duration: 30};
const sample = () => ({schemaVersion: 1, sourceSha256: original.sha256, songDuration: 30,
  excerptStart: 0, excerptDuration: 30, text: 'hello',
  words: [{word: 'hello', start: 12, end: 13, alignmentScore: .8}], beats: [1, 2, 3], reviewRequired: false});

test('vocal analysis preserves intro/outro and exact absolute word/beat clocks without mutating source', () => {
  const input = sample(); const result = vocalTimingForRender(input, original);
  assert.equal(result.duration, 30); assert.equal(result.words[0].start, 12);
  result.words[0].start = 0; result.beats[0] = 99;
  assert.equal(input.words[0].start, 12); assert.equal(input.beats[0], 1);
});
test('mismatched upload hash or independently measured duration refuses a render', () => {
  for (const changed of [{...original, sha256: 'b'.repeat(64)}, {...original, duration: 31}]) {
    assert.throws(() => vocalTimingForRender(sample(), changed), /match/);
  }
});
test('partial or review-required analyses cannot silently become complete-song renders', () => {
  const partial = {...sample(), excerptStart: 10, excerptDuration: 10, beats: [11, 12]};
  assert.throws(() => vocalTimingForRender(partial, original), /partial/);
  assert.equal(vocalTimingForRender(partial, original, {reviewOnly: true}).words[0].start, 12);
  const flagged = {...sample(), reviewRequired: true};
  assert.throws(() => vocalTimingForRender(flagged, original), /review/);
  assert.equal(vocalTimingForRender(flagged, original, {reviewOnly: true}).needsReview, true);
});
test('empty lyrics, fabricated clocks, missing alignment, and out-of-bounds beats are rejected', () => {
  for (const input of [{...sample(), words: []}, {...sample(), reviewRequired: undefined},
    {...sample(), words: [{word: 'bad', start: true, end: 2, alignmentScore: .8}]},
    {...sample(), words: [{word: 'bad', start: 1, end: 31, alignmentScore: .8}]},
    {...sample(), words: [{word: 'bad', start: 1, end: 2}]},
    {...sample(), beats: [1, 1]}, {...sample(), beats: [30]}]) {
    assert.throws(() => vocalTimingForRender(input, original));
  }
});
