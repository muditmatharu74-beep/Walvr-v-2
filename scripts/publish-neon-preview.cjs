// Run only as the reviewed neon preview's build command. Existing Vercel
// preview credentials stay in that environment; no keys are read back/exported.
const path = require('node:path');
const fs = require('node:fs');
const {bundle} = require('@remotion/bundler');
const {deploySiteFromBundle} = require('@remotion/lambda');
const bucketName = 'remotionlambda-useast1-xbb8d31mho';
const region = 'us-east-1';

async function publish(env=process.env) {
  if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='feature/neon-captions'){
    throw new Error('Neon site publishing is restricted to the feature/neon-captions preview');
  }
  const commit=env.VERCEL_GIT_COMMIT_SHA;
  if(!/^[a-f0-9]{40}$/.test(commit||''))throw new Error('Missing reviewed preview commit');
  const siteName='walvr-neon-preview-'+commit.slice(0,12);
  const serveUrl=`https://${bucketName}.s3.${region}.amazonaws.com/sites/${siteName}/index.html`;
  if(env.REMOTION_SERVE_URL!==serveUrl)throw new Error('Preview renderer URL does not match this commit');
  const markerUrl=new URL('walvr-build.json',serveUrl).href;
  const marker=await fetch(markerUrl,{signal:AbortSignal.timeout(30000)});
  if(marker.ok){
    const existing=await marker.json();
    if(existing.commit!==commit)throw new Error('Refusing to replace an existing site from another commit');
    console.log('Neon preview site already published: '+serveUrl);
    return serveUrl;
  }
  // S3 commonly returns 403 for an absent key when public list access is off.
  if(marker.status!==403&&marker.status!==404)throw new Error('Cannot verify the preview site destination');
  const bundleDir=await bundle({entryPoint:path.join(__dirname,'../src/remotion/index.ts'),publicDir:null});
  fs.writeFileSync(path.join(bundleDir,'walvr-build.json'),JSON.stringify({commit,captionStyles:['clean-neon','pixel-neon']}));
  const result=await deploySiteFromBundle({bucketName,region,siteName,bundleDir,throwIfSiteExists:true});
  if(result.serveUrl!==serveUrl)throw new Error('Published renderer URL differs from the preview configuration');
  console.log('Published neon preview site: '+serveUrl);
  return serveUrl;
}
module.exports={publish};
if(require.main===module)publish().catch(error=>{console.error(error.message);process.exitCode=1});
