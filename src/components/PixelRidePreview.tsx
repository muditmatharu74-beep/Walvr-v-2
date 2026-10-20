"use client";

import {useEffect, useState} from "react";
import {PixelRideScene, PIXEL_RIDE_SECONDS} from "../remotion/PixelRideScene";
import {NeonCaptionOverlay} from "./NeonCaptionOverlay";
import type {NeonStyle} from "../lib/rendering/neon-captions";
import "@fontsource/montserrat/latin-900.css";
import "@fontsource/press-start-2p/latin-400.css";

const SAMPLE = ["Late", "night", "ride", "home", "Under", "neon", "skies"].map((word,i)=>({
  word, start:.4+i*1.4, end:1.5+i*1.4,
}));

export function PixelRidePreview() {
  const [time,setTime] = useState(.8);
  const [playing,setPlaying] = useState(true);
  const [reduced,setReduced] = useState(false);
  const [captions,setCaptions] = useState(true);
  const [style,setStyle] = useState<NeonStyle>("pixel-neon");
  useEffect(()=>{
    const preference=window.matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>setReduced(preference.matches);
    update(); preference.addEventListener("change",update);
    return ()=>preference.removeEventListener("change",update);
  },[]);
  useEffect(()=>{
    if(!playing||reduced) return;
    const timer=window.setInterval(()=>setTime(t=>(t+1/15)%PIXEL_RIDE_SECONDS),1000/15);
    return ()=>window.clearInterval(timer);
  },[playing,reduced]);
  const buttonStyle={border:"1px solid #48506b",borderRadius:8,padding:"10px 14px",background:"#15182c",color:"#f5fbff",cursor:"pointer"} as const;
  return <section id="pixel-ride" style={{margin:"32px 0 48px"}}>
    <h2 style={{fontSize:24,marginBottom:8}}>Neon night ride</h2>
    <p style={{color:"#a8bdce",maxWidth:560,lineHeight:1.6}}>
      Our original pixel-art loop. Try it with either caption style, or view the artwork on its own. This preview is silent.
    </p>
    <div role="img" aria-label="Animated pixel-art motorcycle ride on a neon road with a skyline and passing palm trees"
      style={{position:"relative",aspectRatio:"9 / 16",width:"100%",maxWidth:360,overflow:"hidden",borderRadius:12,
        border:"1px solid #34334e",background:"#090b21",margin:"20px auto"}}>
      <PixelRideScene time={time} />
      {captions?<NeonCaptionOverlay captions={SAMPLE} style={style} time={time} />:null}
    </div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
      <button type="button" disabled={reduced} onClick={()=>setPlaying(p=>!p)} style={{...buttonStyle,opacity:reduced ? 0.5 : 1}}>
        {reduced?"Reduced motion enabled":playing?"Pause animation":"Play animation"}
      </button>
      <button type="button" aria-pressed={captions} onClick={()=>setCaptions(c=>!c)} style={buttonStyle}>
        {captions?"Hide sample captions":"Show sample captions"}
      </button>
      <label style={{display:"flex",alignItems:"center",gap:8,color:"#a8bdce"}}>
        Caption style
        <select value={style} onChange={e=>setStyle(e.target.value as NeonStyle)}
          style={{...buttonStyle,padding:"10px"}}>
          <option value="pixel-neon">Pixel Neon</option>
          <option value="clean-neon">Clean Neon</option>
        </select>
      </label>
    </div>
  </section>;
}
