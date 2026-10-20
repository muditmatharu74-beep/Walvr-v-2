// Original Walvr artwork. No downloaded sprites, footage or external assets.
// Quantized to 15 fps inside the 30 fps export for a deliberate pixel-art feel.
export const PIXEL_RIDE_SECONDS = 12;

export function PixelRideScene({time}: {time: number}) {
  const tick = Math.floor((Number.isFinite(time) ? Math.max(0, time) : 0) * 15 + 0.000001) % 180;
  const phase = tick / 180;
  const lean = Math.round(Math.sin(phase * Math.PI * 4) * 2);
  const palms = Array.from({length: 8}, (_, i) => ({
    side: i % 2 ? 1 : -1,
    depth: ((Math.floor(i / 2) / 4 + phase) % 1),
  })).sort((a, b) => a.depth - b.depth);
  return <svg data-pixel-ride="true" aria-hidden="true" viewBox="0 0 270 480"
    preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges"
    style={{position:"absolute",inset:0,width:"100%",height:"100%",display:"block",imageRendering:"pixelated"}}>
    <rect width="270" height="480" fill="#090b21" />
    {[["#100e2b",45],["#171032",85],["#211337",125],["#30173f",165]].map(([color,y]) =>
      <rect key={y} y={Number(y)} width="270" height="70" fill={String(color)} />)}
    {Array.from({length:36},(_,i)=><rect key={i} x={(i*73+17)%270} y={(i*31+11)%150}
      width={i%7===0?2:1} height="1" fill={i%3?"#746487":"#91b6c6"} opacity=".65" />)}
    {/* A banded pixel sun, drawn from rectangles rather than a borrowed image. */}
    {Array.from({length:20},(_,i)=>{
      const half = Math.round(40*Math.sqrt(Math.max(0,1-Math.pow((i-9.5)/10,2))));
      return <rect key={i} x={135-half} y={83+i*4} width={half*2} height={i>10?2:4}
        fill={i<6?"#ffb87a":i<12?"#fb719a":"#d449a4"} />;
    })}
    {[0,1,2].map(layer=><g key={layer} fill={["#221334","#19132d","#111326"][layer]}>
      {Array.from({length:14},(_,i)=>{
        const h=18+(i*17+layer*23)%55;
        const x=i*22-15+layer*4;
        return <g key={i}>
          <rect x={x} y={218-h+layer*4} width={15+i%4} height={h} />
          {i%3===0?<rect x={x+7} y={208-h+layer*4} width="2" height="14" />:null}
          {layer===2?Array.from({length:4},(_,w)=><rect key={w} x={x+3+(w%2)*6}
            y={221-h+Math.floor(w/2)*8} width="2" height="3" fill={i%2?"#4b3665":"#306170"} />):null}
        </g>;
      })}
    </g>)}
    <rect y="216" width="270" height="264" fill="#100e22" />
    <polygon points="122,216 148,216 292,480 -22,480" fill="#0b1020" />
    <path d="M122 216L-22 480M148 216L292 480" stroke="#d5469d" strokeWidth="2" fill="none" />
    {[-3,-2,-1,0,1,2,3].map(i=><path key={i}
      d={`M135 216L${135+i*75} 480`} stroke="#2d2c57" strokeWidth="1" />)}
    {Array.from({length:12},(_,i)=>{
      const depth=((i/12+phase*2)%1);
      const y=Math.round(216+depth*depth*280);
      const half=13+(y-216)*.55;
      return <path key={i} d={`M${135-half} ${y}H${135+half}`}
        stroke="#6d285b" strokeWidth="1" opacity={Math.min(.65,depth*3)} />;
    })}
    {palms.map(({side,depth},i)=>{
      const x=Math.round(135+side*(19+depth*depth*195));
      const y=Math.round(220+depth*depth*450);
      const scale=(.08+depth*2.5).toFixed(3);
      return <g key={i} transform={`translate(${x} ${y}) scale(${scale})`} opacity={Math.min(1,depth*8)}>
        <path d="M-2 0H2V-18H4V-38H2V-51H-2V-31H-4V-14H-2Z" fill="#1f1534" />
        <path d="M0-51H-8V-55H-19V-52H-25V-49H-16V-47H-6V-43H0Z
          M0-51H8V-55H19V-52H25V-49H16V-47H6V-43H0Z
          M0-51V-58H-4V-64H-12V-61H-8V-55Z
          M0-51V-58H4V-64H12V-61H8V-55Z" fill="#452347" />
        <path d="M-22-51H-14V-52H-6M6-52H14V-51H22M2-47V-18" fill="none" stroke="#b54587" strokeWidth="1" />
      </g>;
    })}
    {/* Caption band stays dark; the rider sits above the 69% lyric baseline. */}
    <rect y="315" width="270" height="42" fill="#080d1b" opacity=".55" />
    <g data-rider="true" transform={`translate(${135+lean} ${268+(tick%30<15?0:1)})`}>
      <rect x="-19" y="28" width="38" height="6" fill="#292044" />
      <rect x="-8" y="14" width="16" height="25" fill="#050a13" />
      <rect x="-4" y="18" width="8" height="19" fill="#32364c" />
      {[0,1,2,3].map(i=><rect key={i} x="-3" y={19+i*5+(tick%3)} width="6" height="1" fill="#14182b" />)}
      <path d="M-14 11H-19V24H-13V15H-8V3H8V15H13V24H19V11H14V-4H-14Z" fill="#191a32" />
      <rect x="-19" y="12" width="4" height="13" fill="#58667c" />
      <rect x="15" y="12" width="4" height="13" fill="#58667c" />
      <path d="M-13-8H13V14H9V20H-9V14H-13Z" fill="#512343" />
      <rect x="-11" y="6" width="22" height="4" fill="#fa5991" />
      <rect x="-8" y="7" width="16" height="2" fill="#ffd2b2" />
      <path d="M-24-13H-17V-18H17V-13H24V-9H12V-15H-12V-9H-24Z" fill="#6b5d82" />
      <rect x="-28" y="-17" width="7" height="4" fill="#53bfd0" />
      <rect x="21" y="-17" width="7" height="4" fill="#53bfd0" />
      <path d="M-12-32H12V-28H17V-11H11V-3H-11V-11H-17V-28H-12Z" fill="#4c294a" />
      <path d="M-11-29H-7V-11H7V-29H11V-7H-11Z" fill="#8a4062" />
      <path d="M-8-49H8V-46H12V-34H8V-29H-8V-34H-12V-46H-8Z" fill="#161c35" />
      <rect x="-8" y="-46" width="16" height="3" fill="#405c73" />
      <rect x="-10" y="-36" width="20" height="2" fill="#62c9cf" />
    </g>
    {Array.from({length:24},(_,i)=>{
      const y=(i*41+phase*480)%480;
      return <path key={i} d={`M${(i*67)%270} ${Math.round(y)}l-2 6`}
        stroke="#829cb7" strokeWidth="1" opacity=".16" />;
    })}
    <rect width="270" height="480" fill="#080b18" opacity=".08" />
  </svg>;
}
