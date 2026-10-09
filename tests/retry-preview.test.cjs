const test = require('node:test');
const assert = require('node:assert/strict');
const {validate} = require('../scripts/retry-preview-upload.cjs');
const env = {VERCEL_ENV:'preview', VERCEL_GIT_COMMIT_REF:'feature/neon-captions', VERCEL_PROJECT_ID:'prj_kY2qEWWysNEfqRKzI7irzqRYs7eg'};
const args = ['a'.repeat(8)+'-aaaa-aaaa-aaaa-'+ 'a'.repeat(12), 'b'.repeat(8)+'-bbbb-bbbb-bbbb-'+ 'b'.repeat(12), 'c'.repeat(8)+'-cccc-cccc-cccc-'+ 'c'.repeat(12), '123456789.mp3'];
test('administrator retry rejects production, other projects and branches before access', () => {
  for (const change of [{VERCEL_ENV:'production'}, {VERCEL_GIT_COMMIT_REF:'main'}, {VERCEL_PROJECT_ID:'other'}]) {
    assert.throws(() => validate({...env, ...change}, args), /scope mismatch/);
  }
  assert.equal(validate(env,args).retryId, args[2]);
});
test('administrator retry requires distinct fixed IDs and an owned filename', () => {
  for (const bad of [args.slice(0,3), [...args.slice(0,3),'../123.mp3'], [args[0],args[1],args[1],args[3]], ['invalid',...args.slice(1)]]) {
    assert.throws(() => validate(env,bad), /Invalid retry/);
  }
});
