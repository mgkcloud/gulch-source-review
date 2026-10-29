(function(){
'use strict';
const KEY='groundHazards',STATUS='groundPoison';
const epoch=d=>String(d.respawnSettings?.token||'original');
function random(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h=(h+0x6d2b79f5)|0;let t=Math.imul(h^(h>>>15),h|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function poison(data){const v=data[STATUS];return v?.epoch===epoch(data)?Math.max(0,Math.min(5,Math.floor(Number(v.turns)||0))):0;}
function utf8Bytes(text){
 let bytes=0;
 for(let i=0;i<text.length;i++){
  const code=text.charCodeAt(i);
  if(code<128)bytes++;
  else if(code<2048)bytes+=2;
  else if(code>=55296&&code<=56319&&i+1<text.length&&text.charCodeAt(i+1)>=56320&&text.charCodeAt(i+1)<=57343){bytes+=4;i++;}
  else bytes+=3;
 }
 return bytes;
}
function generate(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map[KEY]?.version===1)return data;
 const area=map.ascii.reduce((n,r)=>n+r.length,0);if(area>20000)return data;
 const rng=random(String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':ground-hazards:'+map.id);
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);queue.push({x,y});}}
 const reserved=seed.entities.filter(e=>e.map===map.id);
 const landmarks=[...(map.exits||[]),...(map.dynamicRegion?.sites||[]),...(map.landmarks||[]),...(data.legendarySwordQuest?.sites||[]).filter(s=>s.map===map.id),...(data.wayfarerPilgrimage?.sites||[]).filter(s=>s.map===map.id)];
 function safe(q){return Math.hypot(q.x-p.x,q.y-p.y)>6&&floor(seed,map,q.x,q.y)&&!['wood','plank'].includes(seed.legend[map.ascii[q.y][q.x]]?.[1])&&reserved.every(e=>Math.hypot(e.x-q.x,e.y-q.y)>2)&&landmarks.every(e=>Math.hypot(e.x-q.x,e.y-q.y)>2);}
 const candidates=queue.filter(safe);
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 const cells=[],occupied=new Set(),target=Math.min(12,Math.max(2,Math.floor(queue.length/160)));
 let pools=0;
 for(const q of candidates){
  if(pools>=target)break;
  if(cells.some(c=>Math.hypot(c.x-q.x,c.y-q.y)<5))continue;
  const kind=pools%2===0?'poison':'lava';pools++;
  const cluster=[q,...[[1,0],[-1,0],[0,1],[0,-1]].filter(()=>rng()<.4).map(([dx,dy])=>({x:q.x+dx,y:q.y+dy}))];
  for(const c of cluster){const key=c.x+','+c.y;if(!seen.has(key)||occupied.has(key)||!safe(c))continue;occupied.add(key);cells.push({x:c.x,y:c.y,kind});}
 }
 const next={...data,seed:{...seed,maps:seed.maps.map(m=>m.id===map.id?{...m,[KEY]:{version:1,cells}}:m)}};
 return utf8Bytes(JSON.stringify(next))<350000?next:data;
}
function apply(data,activity,previousSnapshot){
 if(!data?.seed)return {data,activity};
 let next=generate(data);
 if(!previousSnapshot||epoch(next)!==epoch(previousSnapshot.gameState)||!(Number(next.turn)>Number(previousSnapshot.turn)))return {data:next,activity};
 const p=next.seed.entities.find(e=>e.id==='player');
 if(!p||p.hp<=0||next.gulchPermanentGameOver?.ended)return {data:next,activity};
 const map=next.seed.maps.find(m=>m.id===p.map),cell=map?.[KEY]?.cells?.find(c=>c.x===p.x&&c.y===p.y);
 let turns=poison(previousSnapshot.gameState),damage=0;const notes=[];
 if(turns){damage++;turns--;notes.push('Poison deals 1 base damage.');}
 if(cell?.kind==='poison'){
  if(!poison(previousSnapshot.gameState)){damage++;notes.push('Toxic puddle: poisoned for five turns; 1 base damage.');}
  else notes.push('Toxic puddle refreshes poison to five turns.');
  turns=5;
 }
 if(cell?.kind==='lava'){damage+=3;notes.push('Lava burns for 3 base damage.');}
 if(damage||turns||poison(previousSnapshot.gameState)){
  next={...next,[STATUS]:{epoch:epoch(next),turns},seed:{...next.seed,entities:next.seed.entities.map(e=>e.id==='player'?{...e,hp:Math.max(0,e.hp-damage)}:e)}};
  if(!turns&&poison(previousSnapshot.gameState))notes.push('The poison wears off.');
 }
 return {data:next,activity:[activity,...notes].filter(Boolean).join(' ')};
}
globalThis.GulchGroundHazardEffects=Object.freeze({epoch,random,floor,poison,generate,apply});
})();
