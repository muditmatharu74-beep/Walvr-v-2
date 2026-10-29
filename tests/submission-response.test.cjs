const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mod = { exports: {} };
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/lib/rendering/submission-response.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: mod, exports: mod.exports });
const { confirmSubmission, submitAndConfirm, SubmissionUnconfirmedError } = mod.exports;

test('upload accepts only a confirmed render with a tracking ID', async () => {
  await confirmSubmission(Response.json({ success: true, renderId: 'job' }));
  for (const body of [{}, {success: false}, {success: true}, {success: true, renderId: ' '}]) {
    await assert.rejects(confirmSubmission(Response.json(body)), /Check your dashboard/);
  }
  await assert.rejects(confirmSubmission(new Response('<html>gateway</html>')), /Check your dashboard/);
});

test('upload accepts a durable queued receipt only with 202 and a valid video ID', async () => {
  const body={success:true,status:'queued',videoId:'22222222-2222-4222-8222-222222222222'};
  await confirmSubmission(Response.json(body,{status:202}));
  for(const response of [Response.json(body),Response.json({...body,videoId:''},{status:202}),
    Response.json({...body,status:'processing'},{status:202})]){
    await assert.rejects(confirmSubmission(response),/Check your dashboard/);
  }
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

test('a lost response after acceptance remains uncertain and does not repeat the POST', async () => {
  let accepted = 0;
  await assert.rejects(submitAndConfirm(async () => { accepted++; throw new TypeError('Failed to fetch'); }, {method:'POST'}),
    e => e instanceof SubmissionUnconfirmedError);
  assert.equal(accepted,1);
  for (const response of [Response.json({error:'Processing failed'},{status:500}),
    Response.json({error:'This video has already been submitted'},{status:409}), new Response('<html>gateway</html>')]) {
    await assert.rejects(confirmSubmission(response), e=>e instanceof SubmissionUnconfirmedError);
  }
});

test('confirmed pre-submission rejections permit correcting the request', async () => {
  for(const response of [Response.json({error:'Not enough credits'},{status:403}),
    Response.json({error:'Unavailable',code:'RENDERER_NOT_CONFIGURED'},{status:503}),
    Response.json({error:'Unusable transcription',creditsRefunded:true},{status:422})]) {
    await assert.rejects(confirmSubmission(response),e=>!(e instanceof SubmissionUnconfirmedError));
  }
});
