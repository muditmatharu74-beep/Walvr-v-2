const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mod = { exports: {} };
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/lib/rendering/submission-response.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: mod, exports: mod.exports });
const { confirmSubmission } = mod.exports;

test('upload accepts only a confirmed render with a tracking ID', async () => {
  await confirmSubmission(Response.json({ success: true, renderId: 'job' }));
  for (const body of [{}, {success: false}, {success: true}, {success: true, renderId: ' '}]) {
    await assert.rejects(confirmSubmission(Response.json(body)), /Check your dashboard/);
  }
  await assert.rejects(confirmSubmission(new Response('<html>gateway</html>')), /Check your dashboard/);
});

test('upload preserves permission and renderer errors instead of blaming the plan', async () => {
  for (const [status, error] of [[403, 'Template not available on your plan'], [403, 'Video or plan changed. Refresh and try again.'],
    [503, 'This template is temporarily unavailable. Your credits have not been charged.']]) {
    await assert.rejects(confirmSubmission(Response.json({error}, {status})), e => e.message === error);
  }
  await assert.rejects(confirmSubmission(Response.json({error: 'Not enough credits. Top up to continue.', required: 200, credits: 50}, {status: 403})), /200 credits but only have 50/);
});

test('non-JSON auth and timeout failures give actionable instructions', async () => {
  await assert.rejects(confirmSubmission(new Response('Unauthorized', {status: 401})), /Sign in again/);
  await assert.rejects(confirmSubmission(new Response('<html>timeout</html>', {status: 504})), /may still be processing/);
  await assert.rejects(confirmSubmission(new Response('', {status: 502})), /Check your dashboard/);
});
