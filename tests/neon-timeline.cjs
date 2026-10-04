// Render sampled frames of the real three-minute composition. This checks
// timeline endpoints, not the encoding of a full-length MP4 or live providers.
const {bundle} = require('@remotion/bundler');
const {ensureBrowser,selectComposition,renderStill} = require('@remotion/renderer');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

(async()=>{
  const output=process.env.WALVR_RENDER_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(),'walvr-timeline-'));
  fs.mkdirSync(output,{recursive:true});
  const browser=await ensureBrowser();
  const serveUrl=await bundle({entryPoint:path.join(__dirname,'../src/remotion/index.ts')});
  const report={kind:'sampled three-minute composition frames; not full-length encoding',variants:[]};
  const cases=[
    {name:'intro',frame:0,visible:false,active:false},
    {name:'opening',frame:33,visible:true,active:true},
    {name:'gap',frame:900,visible:false,active:false},
    {name:'middle',frame:2703,visible:true,active:true},
    {name:'outro',frame:5300,visible:false,active:false},
    {name:'final-frame',frame:5402,visible:true,active:true},
    {name:'empty',frame:5402,visible:false,active:false,empty:true},
    {name:'malformed',frame:33,visible:true,active:true,malformed:true},
  ];
  for(const captionStyle of ['clean-neon','pixel-neon']) {
    for(const sample of cases){
      const captions=sample.empty?[]:[
        {word:'opening',start:1,end:1.5},
        {word:'middle',start:90,end:90.5},
        {word:'ending',start:179.9,end:180.3},
        {word:'beyond',start:181,end:182},
      ];
      if(sample.malformed) captions.unshift(null,{word:null,start:0,end:2});
      const inputProps={captionStyle,captions,songDuration:180.1,beats:[]};
      const composition=await selectComposition({serveUrl,id:'DarkLyrics',inputProps,browserExecutable:browser.path});
      assert.equal(composition.durationInFrames,5403); assert.equal(composition.fps,30);
      const file=path.join(output,captionStyle+'-'+sample.name+'.png');
      await renderStill({serveUrl,composition,inputProps,browserExecutable:browser.path,frame:sample.frame,output:file,imageFormat:'png'});
      const image=execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:10*1024*1024});
      assert.equal(image.length,1080*1920*3);
      let bright=0,cyan=0;
      for(let y=1050;y<1560;y++)for(let x=0;x<1080;x++){
        const i=(y*1080+x)*3;
        if(image[i+1]>170&&image[i+2]>170){bright++;if(image[i]<150)cyan++;}
      }
      assert.ok(sample.visible?bright>100:bright===0,`${captionStyle}: unexpected caption visibility in ${sample.name}`);
      assert.ok(sample.active?cyan>100:cyan===0,`${captionStyle}: unexpected highlight in ${sample.name}`);
      report.variants.push({captionStyle,sample:sample.name,frame:sample.frame,durationInFrames:composition.durationInFrames,brightPixels:bright,cyanPixels:cyan});
      console.log('PASS '+captionStyle+' '+sample.name+' at frame '+sample.frame);
    }
  }
  fs.writeFileSync(path.join(output,'timeline-verification.json'),JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
