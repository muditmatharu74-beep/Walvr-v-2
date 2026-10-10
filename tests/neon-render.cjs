// Render the actual composition with original sample words and a generated tone.
// No provider credentials, customer music, stock footage or database writes.
const { bundle } = require('@remotion/bundler');
const { ensureBrowser, selectComposition, renderMedia } = require('@remotion/renderer');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const edgeCaptions = require('./neon-edge-fixtures.cjs');

(async () => {
  const output = process.env.WALVR_RENDER_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'walvr-neon-exports-'));
  fs.mkdirSync(output, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'walvr-neon-audio-'));
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=220:sample_rate=44100','-t','4','-filter:a','volume=0.1',path.join(fixture,'tone.wav')]);
  const browser = await ensureBrowser();
  const serveUrl = await bundle({ entryPoint: path.join(__dirname,'../src/remotion/index.ts'), publicDir: fixture });
  const report = { kind: 'composition smoke test, not a live provider or footage test', duration: 4, variants: [] };
  for (const captionStyle of ['clean-neon','pixel-neon']) for(const scenario of ['standard','edges']) {
    const inputProps = { captionStyle, songDuration: 4, beats: [], audioUrl: '/public/tone.wav',
      captions: scenario==='edges'?edgeCaptions:['Late','night','ride','home'].map((word,i)=>({word,start:i*0.8,end:(i+1)*0.8})) };
    const composition = await selectComposition({serveUrl,id:'DarkLyrics',inputProps,browserExecutable:browser.path});
    const stem = captionStyle+(scenario==='edges'?'-edges':'');
    const file = path.join(output,stem+'.mp4');
    await renderMedia({serveUrl,composition,inputProps,browserExecutable:browser.path,outputLocation:file,
      codec:'h264',audioCodec:'aac',concurrency:2});
    const metadata = JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
    const video = metadata.streams.find(s=>s.codec_type==='video');
    const audio = metadata.streams.find(s=>s.codec_type==='audio');
    assert.equal(video.width,1080); assert.equal(video.height,1920); assert.equal(video.codec_name,'h264');
    assert.ok(audio,'MP4 must have audio'); assert.equal(audio.codec_name,'aac');
    assert.ok(Math.abs(Number(metadata.format.duration)-4)<0.1);
    const frameAt = time=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-ss',String(time),'-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:10*1024*1024});
    const samples = (scenario==='edges'?[0.16,0.55]:[0.4,1.2]).map(frameAt);
    let cyanPixels=0;
    const image=samples[0];for(let i=0;i<image.length;i+=3)if(image[i]<150&&image[i+1]>170&&image[i+2]>170)cyanPixels++;
    assert.ok(cyanPixels>100,'Current-word cyan highlight is missing');
    const hashes=samples.map(frame=>crypto.createHash('sha256').update(frame).digest('hex'));
    assert.notEqual(hashes[0],hashes[1],'Caption highlight did not advance');
    if(scenario==='edges'){
      const countText = image=>{
        let inside=0,outside=0;
        for(let y=1050;y<1560;y++) for(let x=0;x<1080;x++){
          const i=(y*1080+x)*3;
          if(image[i+1]>170 && image[i+2]>170) {if(x>=108&&x<972)inside++;else outside++;}
        }
        return {inside,outside};
      };
      assert.ok(countText(frameAt(1.6)).inside>100,'Tied words disappeared in the export');
      const longWord=countText(frameAt(2.15));
      assert.ok(longWord.inside>100,'Long word disappeared in the export');
      assert.equal(longWord.outside,0,'Long word extends beyond the caption safe area');
      assert.equal(countText(frameAt(3.6)).inside,0,'Caption remains visible during the pause');
    }
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-ss',scenario==='edges'?'2.15':'1.2','-i',file,'-frames:v','1',path.join(output,stem+'.png')]);
    report.variants.push({captionStyle,scenario,width:video.width,height:video.height,duration:Number(metadata.format.duration),audioCodec:audio.codec_name,cyanPixels,frameHash:hashes[0]});
    console.log('PASS '+stem+': H.264/AAC MP4, 1080x1920, 4s, visible cyan highlight and changing word sync');
  }
  assert.notEqual(report.variants[0].frameHash,report.variants[2].frameHash,'The two styles rendered identically');
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));
  fs.rmSync(fixture,{recursive:true,force:true});
  console.log('Exports: '+output);
})().catch(error=>{console.error(error);process.exitCode=1});
