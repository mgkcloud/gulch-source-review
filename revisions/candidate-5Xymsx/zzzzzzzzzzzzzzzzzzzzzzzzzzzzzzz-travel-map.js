(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
const baseCommit=Gulch.commit,KEY='travelCartography';
let latest=null,attempt=null,previousFocus=null,chosen='',follow=true;
const {epoch,shape,memory,read,seen,chart}=globalThis.GulchCartographyEffects;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
Gulch.commit=function(data,activity){return baseCommit(data?.seed?chart(data):data,activity);};
const style=el('style');style.textContent=`
#travelMapToggle{position:absolute;left:12px;top:198px;z-index:5;min-height:40px;padding:8px 12px;background:#bca273;color:#30291d;border:3px double #6c5735;border-radius:3px;font:12px monospace}
#travelMapPanel[hidden]{display:none!important}
#travelMapPanel{position:absolute;inset:18px;z-index:95;display:flex;flex-direction:column;max-width:1100px;max-height:850px;margin:auto;padding:16px;background:#c5aa78;color:#352d21;border:7px double #775633;box-shadow:0 10px 45px #0009,inset 0 0 50px #70502d55;font:12px/1.6 ui-monospace,monospace}
#travelMapPanel header{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:2px solid #80633c;padding-bottom:10px}
#travelMapPanel h2{margin:0;font:bold 24px Georgia,serif;letter-spacing:1px}#travelMapPanel header small{display:block;font-size:10px;letter-spacing:2px}
#travelMapPanel button,#travelMapPanel select{min-height:40px;padding:8px 10px;background:#e0c795;color:#32291e;border:1px solid #78613e;border-radius:2px;font:inherit;max-width:100%}
#travelMapPanel button[aria-pressed=true]{background:#655737;color:#fff0c4}
#travelMapPanel :focus-visible,#travelMapToggle:focus-visible{outline:3px solid #315f69;outline-offset:2px}
.travel-map-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}.travel-map-tools select{flex:1;min-width:100px}
#travelMapViewport{flex:1;min-height:100px;overflow:auto;background:#302e28;border:3px double #80633c;position:relative;text-align:center;scrollbar-color:#aa9062 #302e28}
#travelMapCanvas{display:block;image-rendering:pixelated;margin:auto;cursor:crosshair}
#travelMapCaption,#travelMapInspect{margin:7px 0;min-height:18px}#travelMapInspect{font-size:11px}
.travel-map-legend{display:flex;flex-wrap:wrap;gap:6px 16px;padding-top:8px;border-top:1px solid #80633c;font-size:11px}
.travel-map-legend span:before{content:'';display:inline-block;width:9px;height:9px;margin-right:6px;background:var(--swatch);border:1px solid #58452c}
@media(max-width:700px){#travelMapToggle{left:8px;top:190px}#travelMapPanel{inset:6px;padding:10px;border-width:5px}#travelMapPanel h2{font-size:19px}.travel-map-tools{gap:5px}#travelMapPanel button,#travelMapPanel select{padding:7px;font-size:11px}}
`;document.head.append(style);
const toggle=el('button','Map [M]');toggle.id='travelMapToggle';toggle.type='button';toggle.setAttribute('aria-controls','travelMapPanel');toggle.setAttribute('aria-expanded','false');
const panel=el('section');panel.id='travelMapPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','travelMapTitle');
const header=el('header'),heading=el('div'),title=el('h2','The Wayfarer’s Atlas');title.id='travelMapTitle';heading.append(title,el('small','A CHART OF THE SHARED EXPEDITION'));
const close=el('button','Close · M / Esc');close.type='button';header.append(heading,close);
const tools=el('div');tools.className='travel-map-tools';
const select=el('select');select.setAttribute('aria-label','Charted region');
const locate=el('button','Locate player');locate.type='button';
const zoom=el('select');zoom.setAttribute('aria-label','Map scale');
for(const [value,label] of [['fit','Fit region'],['8','Pixel scale ×1'],['16','Pixel scale ×2']]){const o=el('option',label);o.value=value;zoom.append(o);}
const followButton=el('button','Follow player');followButton.type='button';followButton.setAttribute('aria-pressed','true');
tools.append(select,locate,zoom,followButton);
const caption=el('p');caption.id='travelMapCaption';caption.setAttribute('aria-live','polite');
const viewport=el('div');viewport.id='travelMapViewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','Exploration map. Scroll to view enlarged terrain.');
const canvas=el('canvas');canvas.id='travelMapCanvas';canvas.setAttribute('role','img');viewport.append(canvas);
const inspect=el('p','Select a charted tile to read its coordinates.');inspect.id='travelMapInspect';inspect.setAttribute('role','status');
const legend=el('div');legend.className='travel-map-legend';
for(const [text,color] of [['You','#b54436'],['Woodland','#61734a'],['Water','#75a5a5'],['Stone','#aaa48a'],['Shelter / exit','#efcf84'],['Unknown','#302e28']]){const s=el('span',text);s.style.setProperty('--swatch',color);legend.append(s);}
panel.append(header,tools,caption,viewport,inspect,legend,el('small','North ↑ · Nearby explored ground is shared and remembered. Unvisited ground conceals its terrain and landmarks. Movement remains available while this chart is open.'));
host.append(toggle,panel);
let geometry=null;
function blocked(){return ['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function currentView(){
 if(!latest)return null;
 const data=chart(latest.gameState),maps=memory(data),map=latest.seed.maps.find(m=>m.id===chosen);
 if(!map)return null;
 return {map,record:maps[map.id],bits:read(map,maps[map.id]),...shape(map)};
}
function hash(x,y){return ((Math.imul(x+17,73856093)^Math.imul(y+29,19349663))>>>0);}
function draw(){
 if(panel.hidden||!latest)return;
 const data=chart(latest.gameState),records=memory(data);
 if(follow||!latest.seed.maps.some(m=>m.id===chosen&&records[m.id]))chosen=latest.mapId;
 const options=latest.seed.maps.filter(m=>m.id===latest.mapId||records[m.id]);
 const signature=options.map(m=>m.id+'\n'+m.name).join('\t');
 if(select.dataset.signature!==signature){select.replaceChildren(...options.map(m=>{const o=el('option',m.name||m.id);o.value=m.id;return o;}));select.dataset.signature=signature;}
 select.value=chosen;
 const view=currentView();if(!view)return;
 const {map,bits,w,h}=view;
 const padding=24,fit=Math.max(1,Math.floor(Math.min((viewport.clientWidth-padding*2)/w,(viewport.clientHeight-padding*2)/h))),scale=zoom.value==='fit'?Math.min(14,fit):Number(zoom.value);
 canvas.width=w*scale+padding*2;canvas.height=h*scale+padding*2;canvas.style.width=canvas.width+'px';canvas.style.height=canvas.height+'px';
 geometry={map:map.id,w,h,scale,padding,bits};
 const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#302e28';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.strokeStyle='#9d8254';ctx.strokeRect(5.5,5.5,canvas.width-11,canvas.height-11);ctx.strokeStyle='#574831';ctx.strokeRect(9.5,9.5,canvas.width-19,canvas.height-19);
 let explored=0,total=0;
 for(let y=0;y<h;y++)for(let x=0;x<map.ascii[y].length;x++){
  total++;const px=padding+x*scale,py=padding+y*scale;
  if(!seen(bits,w,x,y)){if(hash(x,y)%19===0&&scale>=4){ctx.fillStyle='#403b2e';ctx.fillRect(px+1,py+1,1,1);}continue;}
  explored++;const ch=map.ascii[y][x],entry=latest.seed.legend[ch]||[],kind=entry[0],material=entry[1],n=hash(x,y);
  const water=kind==='water'||ch==='~',wall=kind==='wall'||ch==='#';
  ctx.fillStyle=water?'#75a5a5':wall?'#aaa48a':material==='tree'?'#879064':material==='fungus'?'#7f9170':material==='grass'?'#b4b17b':material==='plank'||material==='wood'?'#bd9565':'#cbb480';
  ctx.fillRect(px,py,scale,scale);
  if(scale>=5){
   if(water){ctx.fillStyle='#b2d0bd';ctx.fillRect(px+1,py+Math.floor(scale*.6),Math.max(2,scale-3),1);}
   else if(material==='tree'){
    ctx.fillStyle='#3f5036';ctx.fillRect(px+Math.floor(scale/2),py+scale-3,1,2);ctx.fillStyle='#61734a';ctx.fillRect(px+1,py+Math.floor(scale/2),scale-2,2);ctx.fillRect(px+2,py+2,Math.max(1,scale-4),2);
   }else if(wall){ctx.fillStyle='#645e4c';ctx.beginPath();ctx.moveTo(px+1,py+scale-1);ctx.lineTo(px+Math.floor(scale/2),py+1);ctx.lineTo(px+scale-1,py+scale-1);ctx.closePath();ctx.strokeStyle='#645e4c';ctx.stroke();}
   else if(n%4===0){ctx.fillStyle='#9f9064';ctx.fillRect(px+1,py+2,2,1);}
  }
 }
 function marker(x,y,kind){
  if(!seen(bits,w,x,y))return;const px=padding+(x+.5)*scale,py=padding+(y+.5)*scale,u=Math.max(2,Math.floor(scale/2));
  ctx.fillStyle='#493c28';ctx.fillRect(Math.round(px-u-1),Math.round(py-u-1),u*2+2,u*2+2);ctx.fillStyle='#efcf84';ctx.fillRect(Math.round(px-u),Math.round(py-u),u*2,u*2);
  if(kind==='exit'){ctx.fillStyle='#493c28';ctx.fillRect(Math.round(px),Math.round(py-u),1,u*2);}else{ctx.fillStyle='#493c28';ctx.fillRect(Math.round(px),Math.round(py),1,u);}
 }
 for(const exit of map.exits||[])marker(exit.x,exit.y,'exit');
 for(const e of latest.seed.entities)if(e.map===map.id&&(e.townRefuge||e.swordQuestLandmark==='cathedral'))marker(e.x,e.y,'town');
 const p=latest.player;
 if(p.map===map.id){
  const px=Math.round(padding+(p.x+.5)*scale),py=Math.round(padding+(p.y+.5)*scale),r=Math.max(4,Math.floor(scale*.7));
  ctx.fillStyle='#fff0c5';ctx.fillRect(px-r-2,py-2,r*2+5,5);ctx.fillRect(px-2,py-r-2,5,r*2+5);
  ctx.fillStyle='#b54436';ctx.fillRect(px-r,py-1,r*2+1,3);ctx.fillRect(px-1,py-r,3,r*2+1);ctx.fillStyle='#502b22';ctx.fillRect(px-1,py-1,3,3);
 }
 ctx.font='bold 10px monospace';ctx.textAlign='right';ctx.fillStyle='#d6bd8c';ctx.fillText('N ↑',canvas.width-14,19);
 caption.textContent=(map.name||map.id)+' · '+explored+' / '+total+' tiles charted · '+(p.map===map.id?'YOU: '+p.x+', '+p.y:'Player is in '+(latest.seed.maps.find(m=>m.id===p.map)?.name||p.map));
 canvas.setAttribute('aria-label',caption.textContent+'. Dark tiles are unknown. North is up.');
}
function center(){draw();if(!geometry||chosen!==latest?.mapId)return;const {padding,scale}=geometry,p=latest.player;viewport.scrollLeft=Math.max(0,padding+(p.x+.5)*scale-viewport.clientWidth/2);viewport.scrollTop=Math.max(0,padding+(p.y+.5)*scale-viewport.clientHeight/2);}
function show(open){
 if(open&&(!latest||latest.player.hp<=0||blocked()))return;
 if(open){previousFocus=document.activeElement;chosen=latest.mapId;follow=true;followButton.setAttribute('aria-pressed','true');}
 panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
 if(open){draw();close.focus({preventScroll:true});requestAnimationFrame(center);}else if(previousFocus?.isConnected&&!previousFocus.closest('[hidden],[inert]'))previousFocus.focus({preventScroll:true});
}
toggle.addEventListener('click',()=>show(panel.hidden));close.addEventListener('click',()=>show(false));
select.addEventListener('change',()=>{chosen=select.value;follow=false;followButton.setAttribute('aria-pressed','false');draw();});
zoom.addEventListener('change',center);
locate.addEventListener('click',()=>{chosen=latest.mapId;follow=true;followButton.setAttribute('aria-pressed','true');center();});
followButton.addEventListener('click',()=>{follow=!follow;followButton.setAttribute('aria-pressed',String(follow));if(follow)chosen=latest.mapId;center();});
canvas.addEventListener('click',event=>{
 if(!geometry||!latest)return;
 const rect=canvas.getBoundingClientRect(),g=geometry,x=Math.floor(((event.clientX-rect.left)*canvas.width/rect.width-g.padding)/g.scale),y=Math.floor(((event.clientY-rect.top)*canvas.height/rect.height-g.padding)/g.scale);
 const map=latest.seed.maps.find(m=>m.id===g.map);
 if(x<0||y<0||!map?.ascii[y]?.[x])return;
 if(!seen(g.bits,g.w,x,y)){inspect.textContent='Unknown ground · '+x+', '+y+'. Travel nearby to chart it.';return;}
 const landmark=latest.seed.entities.find(e=>e.map===map.id&&e.x===x&&e.y===y&&(e.townRefuge||e.swordQuestLandmark==='cathedral'));
 const material=latest.seed.legend[map.ascii[y][x]]?.[1]||'ground',exit=map.exits?.some(e=>e.x===x&&e.y===y);
 inspect.textContent=x+', '+y+' · '+(landmark?.name|| (exit?'Passage / exit':material))+(latest.mapId===map.id&&latest.player.x===x&&latest.player.y===y?' · You are here':'');
});
window.addEventListener('keydown',event=>{
 const typing=event.target instanceof HTMLElement&&(event.target.matches('input,textarea,select')||event.target.isContentEditable);
 if(!typing&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.toLowerCase()==='m'&&window.GulchMovementState?.focused&&!blocked()){
  event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)show(panel.hidden);return;
 }
 if(!panel.hidden&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();show(false);}
},true);
function persist(){
 if(!latest||latest.player.hp<=0||document.hidden||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;
 const next=chart(latest.gameState);if(next===latest.gameState)return;
 attempt=latest.stateRevision;Gulch.commit(next,'Updated the shared exploration chart.');
}
Gulch.register('travel-cartography',{snapshot(s){
 const reset=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;
 if(reset){chosen=s.mapId;attempt=null;inspect.textContent='A new expedition begins with a fresh chart.';}
 toggle.disabled=s.player.hp<=0;
 if(!panel.hidden&&(s.player.hp<=0||blocked()))show(false);
 persist();if(!panel.hidden){if(follow)center();else draw();}
},resize(){if(!panel.hidden){if(follow)center();else draw();}}});
new MutationObserver(()=>{if(!panel.hidden&&blocked())show(false);}).observe(host,{subtree:true,attributes:true,attributeFilter:['hidden']});
setInterval(persist,1200);
})();
