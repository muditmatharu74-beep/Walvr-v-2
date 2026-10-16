const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const commit='a'.repeat(40);
const serveUrl='https://remotionlambda-useast1-xbb8d31mho.s3.us-east-1.amazonaws.com/sites/walvr-neon-preview-aaaaaaaaaaaa/index.html';
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/neon-captions',VERCEL_GIT_COMMIT_SHA:commit,REMOTION_SERVE_URL:serveUrl};
function load(marker){
  const calls=[];const mod={exports:{}};
  const mocks={
    'node:fs':{writeFileSync(){}},
    '@remotion/bundler':{bundle:async()=>{calls.push('bundle');return '/tmp/bundle'}},
    '@remotion/lambda':{deploySiteFromBundle:async args=>{calls.push(args);return {serveUrl}}},
  };
  vm.runInNewContext(fs.readFileSync('scripts/publish-neon-preview.cjs','utf8'),{
    module:mod,exports:mod.exports,__dirname:'/repo/scripts',process:{env:{}},console:{log(){}},URL,AbortSignal,
    require:name=>mocks[name]||require(name),fetch:async()=>marker,
  });
  return {publish:mod.exports.publish,calls};
}
test('publisher rejects production, other branches and mismatched destinations before AWS operations',async()=>{
  for(const override of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{REMOTION_SERVE_URL:'https://production.example/site'},{VERCEL_GIT_COMMIT_SHA:''}]){
    const s=load({ok:false,status:404});await assert.rejects(s.publish({...env,...override}));assert.equal(s.calls.length,0);
  }
});
test('publisher uploads only a new commit-specific site and cannot overwrite an existing site',async()=>{
  const s=load({ok:false,status:404});assert.equal(await s.publish(env),serveUrl);
  assert.equal(s.calls[1].siteName,'walvr-neon-preview-aaaaaaaaaaaa');
  assert.equal(s.calls[1].throwIfSiteExists,true);
});
test('retry reuses the exact published commit without an AWS write',async()=>{
  const s=load({ok:true,json:async()=>({commit})});assert.equal(await s.publish(env),serveUrl);assert.equal(s.calls.length,0);
});
test('publisher refuses an existing mismatched marker or failed destination check',async()=>{
  for(const marker of [{ok:true,json:async()=>({commit:'b'.repeat(40)})},{ok:false,status:500}]){
    const s=load(marker);await assert.rejects(s.publish(env));assert.equal(s.calls.length,0);
  }
});
