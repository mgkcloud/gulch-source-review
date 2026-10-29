(function(){
'use strict';
const KEY='rankedTreasure';
let latest=null,pending=null,attempt='',installed=false,paintKey='',frame=0;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const ranks=[{name:'Wooden',trim:'#94704c',light:'#dbad76',wood:'#815039',weight:55},{name:'Silver',trim:'#7e91ad',light:'#d5e0e8',wood:'#704a39',weight:28},{name:'Golden',trim:'#d39431',light:'#ffe190',wood:'#885439',weight:13},{name:'Royal',trim:'#ddaa36',light:'#ffe798',wood:'#9c2935',weight:4}];
const host=document.getElementById('left');if(!host)return;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function state(d){const v=d?.[KEY];return v?.epoch===epoch(d)?v:{epoch:epoch(d),keys:0,opened:0};}
function rng(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h=(h+0x6d2b79f5)|0;let t=Math.imul(h^(h>>>15),h|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y);}
function generate(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map.rankedTreasureVersion)return data;
 if(map.ascii.reduce((n,r)=>n+r.length,0)>20000)return data;
 const occupied=new Set(seed.entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
 const excluded=new Set();
 function reserve(x,y,r){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)excluded.add((x+dx)+','+(y+dy));}
 for(const q of [...(map.exits||[]),...(map.landmarks||[]),...(map.dynamicRegion?.sites||[]),...(map.groundHazards?.cells||[]),...(map.sinkingGround?.cells||[]),...(data.legendarySwordQuest?.sites||[]).filter(q=>q.map===map.id),...(data.wayfarerPilgrimage?.sites||[]).filter(q=>q.map===map.id),...(data.npcConversations?.treasures||[]).filter(q=>q.map===map.id)])reserve(q.x,q.y,2);
 for(const d of [...(map.blockSettlements?.designs||[]),...(map.npcConstruction?.sites||[])])for(let y=d.y-2;y<=d.y+(d.h||3)+1;y++)for(let x=d.x-2;x<=d.x+(d.w||3)+1;x++)reserve(x,y,0);
 for(const d of map.villageLife?.districts||[]){reserve(d.well.x,d.well.y,2);for(const q of d.garden)reserve(q.x,q.y,1);}
 const dirs=[[1,0],[-1,0],[0,1],[0,-1]],queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length&&i<20000;i++)for(const [dx,dy] of dirs){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(!seen.has(k)&&floor(seed,map,x,y)&&!occupied.has(k)){seen.add(k);queue.push({x,y});}}
 const random=rng(String(data.respawnSettings?.generationSeed||seed.meta?.seed||epoch(data))+':locked-treasure:'+map.id);
 const candidates=queue.filter(q=>Math.hypot(q.x-p.x,q.y-p.y)>=4&&[-1,0,1].every(dy=>[-1,0,1].every(dx=>{const x=q.x+dx,y=q.y+dy,k=x+','+y;return seen.has(k)&&!occupied.has(k)&&!excluded.has(k)&&floor(seed,map,x,y);})));
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 const entities=seed.entities.slice(),ids=new Set(entities.map(e=>e.id)),placed=[];
 const capacity=Math.max(0,96-entities.filter(e=>e.rankedChest||e.treasureKey).length);
 const count=Math.min(8,Math.max(2,Math.floor(queue.length/300)),Math.floor(capacity/3));
 function take(){const i=candidates.findIndex(q=>placed.every(v=>Math.hypot(q.x-v.x,q.y-v.y)>=4));if(i<0)return null;const q=candidates.splice(i,1)[0];placed.push(q);return q;}
 function add(q,suffix,extra){let id='locked-treasure:'+map.id+':'+suffix;while(ids.has(id))id+='x';ids.add(id);entities.push({id,map:map.id,x:q.x,y:q.y,glyph:' ',...extra});}
 let chests=0;
 for(let i=0;i<count;i++){
  const keySpot=take(),chestSpot=take();if(!keySpot||!chestSpot)break;
  const roll=random()*100;let rank=0,total=0;for(let r=0;r<ranks.length;r++){total+=ranks[r].weight;if(roll<total){rank=r;break;}}
  add(keySpot,'key-'+i,{name:'Treasure key',kind:'treasure-key',treasureKey:true});
  add(chestSpot,'chest-'+i,{name:ranks[rank].name+' treasure chest',kind:'prop',rankedChest:{rank,opened:false,lootSeed:Math.floor(random()*4294967296)}});chests++;
 }
 if(chests){const extra=take();if(extra)add(extra,'spare-key',{name:'Treasure key',kind:'treasure-key',treasureKey:true});}
 const next={...data,seed:{...seed,entities,maps:seed.maps.map(m=>m.id===map.id?{...m,rankedTreasureVersion:1}:m)}};
 return new TextEncoder().encode(JSON.stringify(next)).length<340000?next:data;
}
const style=el('style');style.textContent='#treasureTools{position:absolute;left:12px;bottom:112px;z-index:6;max-width:min(280px,calc(100% - 175px));padding:8px;background:#10252bee;border:1px solid #ab9466;border-radius:6px;color:#f4dfb3;font:11px/1.5 monospace}#treasureTools button{display:block;min-height:40px;width:100%;margin-top:5px;padding:7px;background:#334939;color:#ffe5ac;border:1px solid #ab9466;border-radius:4px;font:inherit}#treasureTools button:disabled{opacity:.6}#treasureTools p{margin:5px 0;overflow-wrap:anywhere}#treasureTools summary{cursor:pointer}#treasureTools :focus-visible{outline:2px solid #ffe5ac;outline-offset:2px}@media(max-width:700px){#treasureTools{left:8px;bottom:105px;font-size:10px;max-width:calc(100% - 165px)}}';document.head.append(style);
const tools=el('section');tools.id='treasureTools';tools.setAttribute('aria-label','Keys and ranked treasure');
const stock=el('strong','Treasure keys: 0'),button=el('button','Find a key or chest'),status=el('p');button.type='button';status.setAttribute('role','status');
const guide=el('details');guide.append(el('summary','Chest ranks'),el('p','I Wooden → II Silver → III Golden → IV Royal. Higher ranks contain larger guaranteed rewards and stronger equipment. Every chest costs one universal treasure key. Keys lie on open ground; collect with E. Keys and rewards are shared. Chests open once per retained region; regenerated frontier regions can contain fresh treasure.'));
tools.append(stock,button,status,guide);host.append(tools);
const canvas=el('canvas');canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:3';host.append(canvas);
const artCache=new Map();
function art(rank,opened,key){
 const cacheKey=[rank,opened,key].join(':');if(artCache.has(cacheKey))return artCache.get(cacheKey);
 const a=el('canvas');a.width=a.height=32;const c=a.getContext('2d');
 const box=(color,x,y,w,h)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 const ink='#151426',r=ranks[rank]||ranks[0];
 if(key){
  box(ink,14,2,6,18);box('#d49a39',15,3,4,17);box('#ffe39a',15,3,2,14);box('#d49a39',19,4,4,3);box('#d49a39',19,9,4,3);
  box(ink,9,18,15,11);box('#d49a39',10,19,13,9);box('#ffe39a',11,20,3,6);box(ink,15,21,5,4);
 }else{
  const royal=rank===3;
  box(ink,3,12,26,18);box(r.wood,5,13,22,15);
  for(let x=7;x<27;x+=6){box('#422b30',x,14,2,13);box(royal?'#bd4547':'#ae7850',x+2,15,2,10);}
  box(r.trim,4,26,24,3);box(r.light,5,26,22,1);
  box(r.trim,4,13,3,14);box(r.light,4,14,1,11);box(r.trim,25,13,3,14);box(r.light,26,14,1,11);
  if(opened){
   box(ink,3,3,26,11);box(r.wood,5,5,22,6);box(r.trim,4,3,3,8);box(r.trim,25,3,3,8);box(r.light,7,5,18,2);
   box(ink,6,12,20,7);box(royal?'#682032':'#382332',7,13,18,5);box(r.trim,4,19,24,3);box(r.light,5,19,22,1);
   box(r.trim,14,19,5,5);box(ink,16,21,1,2);
  }else{
   box(ink,3,5,26,10);box(r.wood,5,7,22,7);box(royal?'#ce4950':'#c08b59',6,7,20,2);
   box(r.trim,4,5,3,10);box(r.light,4,6,1,7);box(r.trim,25,5,3,10);box(r.light,26,6,1,7);
   box(r.trim,4,13,24,3);box(r.light,6,13,20,1);
   box(ink,12,13,9,9);box(rank===0?'#9caac0':r.trim,13,14,7,7);box(rank===0?'#d8e0e8':r.light,13,14,7,2);box(ink,16,17,2,3);
  }
  if(royal){box(r.trim,0,17,3,7);box(r.light,0,18,1,5);box(r.trim,29,17,3,7);box(r.light,31,18,1,5);for(const x of [8,22])box(r.light,x,23,2,2);box('#e79b50',14,8,5,3);box('#ffe195',16,6,2,6);}
 }
 artCache.set(cacheKey,a);return a;
}
function target(){
 if(!latest)return null;const p=latest.player;
 return latest.seed.entities.filter(e=>e.map===p.map&&(e.treasureKey||e.rankedChest&&!e.rankedChest.opened)&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1).sort((a,b)=>Number(Boolean(b.treasureKey))-Number(Boolean(a.treasureKey))||String(a.id).localeCompare(String(b.id)))[0];
}
function blocked(){return Boolean(document.querySelector('dialog[open]'))||['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','itemContext','enemyInspectCard','atlasPanel'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function ready(){const m=window.GulchMovementState;return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending&&!blocked();}
function rewards(e){
 const rank=Math.max(0,Math.min(3,e.rankedChest.rank|0)),random=rng(String(e.rankedChest.lootSeed)),n=rank+1;
 const pools=[['scrap_knife','bone_spear'],['iron_blade','chitin_blade'],['alloy_blade','crystal_blade'],['ref_hearth_sun','ref_verdant_comet','ref_cinder_return']];
 const gear=pools[rank][Math.floor(random()*pools[rank].length)];
 return {scrap:3*n,fiber:2*n,image_coin:2*n*n,[['bandage','salve','tonic','tonic'][rank]]:n,[gear]:1,...(rank>=2?{image_gold_bar:n,lens:n}:{}),...(rank===3?{core:2,image_ruby:3}:{} )};
}
function interact(){
 if(!ready())return;const e=target();if(!e)return;
 const data=latest.gameState,v=state(data);let next,text;
 if(e.treasureKey){
  if(v.keys>=999){status.textContent='Key ring full (999). Open a chest first.';return;}
  text='Found a treasure key.';next={...data,seed:{...data.seed,entities:data.seed.entities.filter(a=>a.id!==e.id)},[KEY]:{...v,keys:v.keys+1}};
 }else{
  if(v.keys<1){status.textContent='Locked. Find a treasure key on the map.';return;}
  const loot=rewards(e),catalog=window.GulchItemCatalog?.items||{},old=data.itemEcosystem;
  const pack=old?.epoch===epoch(data)?old:{epoch:epoch(data),bag:{},equipment:{},known:[],crafted:[],log:[]};
  for(const [id,n] of Object.entries(loot)){if(!catalog[id]){status.textContent='Waiting for the item catalog.';return;}if((Number(pack.bag?.[id])||0)+n>999){status.textContent='Make room for '+catalog[id].name+' in your pack. No key spent.';return;}}
  const bag={...pack.bag};for(const [id,n] of Object.entries(loot))bag[id]=(Number(bag[id])||0)+n;
  text='Opened '+ranks[e.rankedChest.rank].name+' chest: '+Object.entries(loot).map(([id,n])=>catalog[id].name+' ×'+n).join(', ')+'.';
  next={...data,seed:{...data.seed,entities:data.seed.entities.map(a=>a.id===e.id?{...a,rankedChest:{...a.rankedChest,opened:true}}:a)},itemEcosystem:{...pack,bag,known:Array.from(new Set([...(pack.known||[]),...Object.keys(loot)])),log:[text,...(pack.log||[])].slice(0,12)},[KEY]:{...v,keys:v.keys-1,opened:Math.min(1000000,(v.opened||0)+1)}};
 }
 const token=String(latest.stateRevision)+':'+Date.now()+':'+Math.random().toString(36).slice(2);
 next[KEY]={...next[KEY],receipt:token};
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000){status.textContent='Shared world capacity reached. Nothing spent or collected.';return;}
 pending={base:latest.stateRevision,source:latest.revision,epoch:epoch(data),token,text};
 try{Gulch.commit(next,text);}catch(error){pending=null;status.textContent=String(error.message||error);}
 if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='Not submitted. Try again when the room is ready.';}else if(pending)status.textContent='Waiting for shared confirmation…';update();
}
function update(){
 if(!latest)return;const e=target();stock.textContent='Treasure keys: '+state(latest.gameState).keys;
 button.textContent=e?(e.treasureKey?'Collect key [E]':'Open '+ranks[e.rankedChest.rank].name+' chest [E] · 1 key'):'Find a key or chest';
 button.disabled=!ready()||!e;tools.hidden=latest.player.hp<=0;
}
function paint(){
 if(!latest||document.hidden)return;
 const p=latest.player,v=window.GulchMovementState?.visual,cam=v?.map===p.map?v:p,w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
 const key=[latest.revision,latest.stateRevision,w,h,dpr,cam.map,cam.x,cam.y].join('|');if(key===paintKey)return;paintKey=key;
 const cw=Math.max(1,Math.round(w*dpr)),ch=Math.max(1,Math.round(h*dpr));if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.imageSmoothingEnabled=false;
 const ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 for(const e of latest.seed.entities){if(e.map!==p.map||(!e.rankedChest&&!e.treasureKey)||latest.lit[e.y]?.[e.x]!==1)continue;const x=w/2+(e.x-cam.x)*ts,y=h/2+(e.y-cam.y)*ts;if(x<-ts||y<-ts||x>w+ts||y>h+ts)continue;const rank=e.rankedChest?.rank||0,size=Math.round(ts*(rank===3?1.12:.94));c.drawImage(art(rank,e.rankedChest?.opened,Boolean(e.treasureKey)),Math.round(x-size/2),Math.round(y-size/2),size,size);if(e.rankedChest){c.font='bold 9px monospace';c.textAlign='center';c.fillStyle='#101a21';c.fillRect(x-12,y-ts*.62,24,11);c.fillStyle=ranks[rank].light;c.fillText(e.rankedChest.opened?'OPEN':['I','II','III','IV'][rank],x,y-ts*.62+9);}}
}
function follow(){frame=0;paint();const m=window.GulchMovementState,v=m?.visual,p=latest?.player;if(!document.hidden&&p&&v&&(m.heldKeys.length||m.inFlight||v.map===p.map&&Math.hypot(v.x-p.x,v.y-p.y)>.001))frame=requestAnimationFrame(follow);}
function setup(){if(!installed||!latest||document.hidden||window.GulchMovementState?.inFlight)return;const key=latest.revision+':'+latest.stateRevision;if(attempt===key)return;attempt=key;const next=generate(latest.gameState);if(next!==latest.gameState)Gulch.commit(next,'Treasure chests and lost keys are scattered throughout this region.');}
button.addEventListener('click',interact);
window.addEventListener('keydown',e=>{if(String(e.key).toLowerCase()!=='e'||e.ctrlKey||e.metaKey||e.altKey||e.isComposing||!target()||blocked()||!window.GulchMovementState?.focused)return;const n=e.target;if(n instanceof HTMLElement&&(n.matches('input,textarea,select')||n.isContentEditable))return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)interact();},true);
Gulch.register('ranked-treasure',{snapshot(s){latest=s;if(pending&&(s.stateRevision!==pending.base||s.revision!==pending.source||epoch(s.gameState)!==pending.epoch)){const r=pending;pending=null;status.textContent=epoch(s.gameState)===r.epoch&&state(s.gameState).receipt===r.token?r.text:'Room updated. Check your keys and chest before trying again.';}update();paint();if(!frame)frame=requestAnimationFrame(follow);queueMicrotask(setup);},resize(){paintKey='';paint();},action(a){if(a?.type==='treasure-interact')interact();}});
function install(){if(installed)return;installed=true;const commit=Gulch.commit;Gulch.commit=function(data,activity,options){if(window.GulchMovementState?.inFlight)return;return commit.call(this,generate(data),activity,options);};setup();}
if(document.readyState==='complete')install();else window.addEventListener('load',install,{once:true});
setInterval(()=>{if(document.hidden)return;if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='Update finished without a matching treasure receipt. Check the chest before retrying.';}update();setup();paint();if(!frame&&(window.GulchMovementState?.heldKeys.length||window.GulchMovementState?.inFlight))frame=requestAnimationFrame(follow);},200);
document.addEventListener('visibilitychange',()=>{paintKey='';if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else paint();});
})();
