const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
function load(file, resolve = require) {
  const mod = {exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
  }).outputText,{module:mod,exports:mod.exports,require:resolve});
  return mod.exports;
}
const helpers = load('src/lib/rendering/neon-captions.ts');
const timing = load('src/lib/rendering/timing.ts');
const {NeonCaptionOverlay} = load('src/components/NeonCaptionOverlay.tsx',
  name=>name.includes('neon-captions')?helpers:require(name));
let frame=0;
const {DarkLyrics} = load('src/remotion/DarkLyrics.tsx',name=>{
  if(name==='remotion') return {
    useCurrentFrame:()=>frame,useVideoConfig:()=>({fps:30}),delayRender:()=>1,
    continueRender(){},cancelRender(){},AbsoluteFill:({children,...props})=>React.createElement('div',props,children),
    Audio:()=>null,
  };
  if(name.includes('@fontsource/')) return {};
  if(name.includes('neon-captions')) return helpers;
  if(name.includes('NeonCaptionOverlay')) return {NeonCaptionOverlay};
  return require(name);
});

for(const style of ['clean-neon','pixel-neon']) {
  test(`${style}: three-minute timeline preserves lyrics, intro, gaps and outro`,()=>{
    const words=Array.from({length:600},(_,i)=>({word:`word${i}`,start:5+i*0.25,end:5+i*0.25+0.2}));
    const phrases=helpers.layoutNeonCaptions(words,style);
    assert.equal(phrases.flatMap(p=>p.words).length,600);
    assert.equal(timing.songDuration(180.1,words),180.1);
    assert.equal(timing.durationInFrames(180.1),5403);
    for(const time of [0,4.9,160,180.06666666666666]){
      const html=renderToStaticMarkup(React.createElement(NeonCaptionOverlay,{captions:words,style,time}));
      assert.ok(!html.includes('<span'),`Unexpected lyric during silence at ${time}`);
    }
    for(const i of [0,300,599]){
      const time=words[i].start+0.05;
      const html=renderToStaticMarkup(React.createElement(NeonCaptionOverlay,{captions:words,style,time}));
      assert.ok(html.includes(style==='pixel-neon'?words[i].word.toUpperCase():words[i].word));
      assert.equal((html.match(/data-active="true"/g)||[]).length,1);
    }
  });

  test(`${style}: actual composition tolerates empty and malformed captions`,()=>{
    frame=30;
    for(const captions of [[],[null,{word:null,start:0,end:2},{word:'valid',start:0,end:2}]]){
      const html=renderToStaticMarkup(React.createElement(DarkLyrics,{captionStyle:style,captions,songDuration:4,beats:[]}));
      assert.equal((html.match(/data-active="true"/g)||[]).length,captions.length?1:0);
    }
  });
}

test('existing caption choices retain their original Dark Lyrics word treatment',()=>{
  frame=30;
  for(const captionStyle of ['bold-overlay','word-highlight','frosted','minimal','karaoke']){
    const html=renderToStaticMarkup(React.createElement(DarkLyrics,{
      captionStyle,captions:[{word:'original',start:0,end:2}],songDuration:4,beats:[],
    }));
    assert.ok(html.includes('ORIGINAL'));
    assert.ok(html.includes('font-size:160px'));
    assert.ok(!html.includes('data-active='));
  }
});
