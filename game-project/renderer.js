(function(){
const TILE_RGB={stone:[46,48,46],soil:[36,28,20],water:[22,48,62],wood:[70,56,40],
  fungus:[26,36,22],tree:[24,38,20],plank:[62,48,36]};
const AMBER="#ffcc66";
const $=id=>document.getElementById(id);


let SNAP=null;

function draw(){
  const cv=$("board"),L=$("left");
  const dpr=window.devicePixelRatio||1;
  let W=L.clientWidth||L.getBoundingClientRect().width||0;
  let H=L.clientHeight||L.getBoundingClientRect().height||0;
  if(!W||!H){W=window.innerWidth;H=window.innerHeight;}
  cv.width=Math.max(1,W*dpr);cv.height=Math.max(1,H*dpr);
  cv.style.width=W+"px";cv.style.height=H+"px";
  const ctx=cv.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle="#05060a";ctx.fillRect(0,0,W,H);
  if(!SNAP)return;
  const ts=(SNAP.seed&&SNAP.seed.meta&&SNAP.seed.meta.tileSize)||32, p=SNAP.player;
  if(!p)return;
  const vw=Math.ceil(W/ts),vh=Math.ceil(H/ts);
  const ox=Math.floor(p.x-vw/2),oy=Math.floor(p.y-vh/2);
  const map=SNAP.seed.maps.find(m=>m.id===SNAP.mapId);
  if(!map)return;
  for(let sy=0;sy<vh;sy++)for(let sx=0;sx<vw;sx++){
    const x=ox+sx,y=oy+sy;
    if(!SNAP.lit[y]||SNAP.lit[y][x]===undefined)continue;
    const v=SNAP.lit[y][x], px=sx*ts, py=sy*ts;
    if(v===0){ctx.fillStyle="#040507";ctx.fillRect(px,py,ts,ts);continue;}
    const ch=map.ascii[y][x]||".";
    const mat=(SNAP.seed.legend[ch]||[".","stone"])[1];
    const base=TILE_RGB[mat]||TILE_RGB.stone;
    const L2=v===1?1:0.34;
    ctx.fillStyle="rgb("+((base[0]*L2)|0)+","+((base[1]*L2)|0)+","+((base[2]*L2)|0)+")";
    ctx.fillRect(px,py,ts,ts);
    if(ch==="#"){ctx.strokeStyle="rgba(0,0,0,.45)";ctx.strokeRect(px+.5,py+.5,ts-1,ts-1);}
    if(ch==="~"){ctx.fillStyle="rgba(120,200,255,"+(v===1?.10:.05)+")";ctx.fillRect(px,py,ts,ts);}
    if(mat==="tree"){ctx.fillStyle="rgb("+((30*L2)|0)+","+((58*L2)|0)+","+((26*L2)|0)+")";ctx.fillRect(px+2,py+2,ts-4,ts-4);}
    if(ch===">"){ctx.fillStyle=AMBER;ctx.fillRect(px+ts/2-2,py+ts/2-2,4,4);}
  }
  for(const e of SNAP.seed.entities){
    if(e.map!==SNAP.mapId)continue;
    const v=SNAP.lit[e.y]&&SNAP.lit[e.y][e.x];
    if(!v||v===0)continue;
    const px=(e.x-ox)*ts,py=(e.y-oy)*ts;
    ctx.font=(ts-8)+"px ui-monospace,monospace";ctx.textAlign="center";ctx.textBaseline="middle";
    if(e.emitsLight){ctx.fillStyle="rgba(157,255,157,.09)";
      ctx.fillRect(px-e.emitsLight*ts,py-e.emitsLight*ts,ts*(e.emitsLight*2+1),ts*(e.emitsLight*2+1));}
    ctx.fillStyle=e.color;ctx.fillText(e.glyph,px+ts/2,py+ts/2+1);
  }
  ctx.fillStyle="#fff";ctx.font="9px ui-monospace,monospace";
  ctx.fillText("FOV r"+SNAP.seed.meta.fov.radius+" - tile "+ts+"px - SHARED",12,H-6);
}
function syncHUD(){
  if(!SNAP)return;
  const p=SNAP.player;
  $("hp").textContent=p.hp+"/"+p.maxHp;
  $("mapName").textContent=(SNAP.seed.maps.find(m=>m.id===SNAP.mapId)||{}).name||"?";
  $("pos").textContent=p.x+","+p.y;
  $("turn").textContent=SNAP.turn;
  $("clients").textContent=SNAP.clients;
}

Gulch.register("renderer",{snapshot(s){SNAP=s; syncHUD();draw();},resize:draw});
})();