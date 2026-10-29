(function(){
'use strict';
const originalCommit=Gulch.commit;
let latest=null;
const epoch=data=>String(data?.respawnSettings?.token||'original');
function helper(e){
 return e.id!=='player'&&e.faction==='friendly'&&(!Number.isFinite(e.hp)||e.hp>0)&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.outsideAnimal&&e.kind!=='animal'&&!e.ecosystemLoot&&!e.itemId&&(e.outsideNPC||e.loreSpeaker||/^(villager|traveler|merchant|guard|npc)$/i.test(e.kind||''));
}
function enemy(e){
 return e.id!=='player'&&e.faction==='hostile'&&Number.isFinite(e.hp)&&e.hp>0&&!e.practiceTarget&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.loreSpeaker&&!e.ecosystemLoot&&e.itemId==null&&!/item|weapon|armor|armour|equipment|consumable|loot|object|prop/i.test([e.kind,e.type].join(' '));
}
function walk(seed,map,x,y){
 const c=map?.ascii[y]?.[x];
 return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);
}
Gulch.register('friendly-npc-assistance',{snapshot(s){latest=s;}});
Gulch.commit=function(data,activity){
 if(!latest||!data?.seed||epoch(data)!==epoch(latest.gameState)||!(Number(data.turn)>Number(latest.turn)))return originalCommit(data,activity);
 const seed=data.seed,p=seed.entities.find(e=>e.id==='player');
 if(!p||p.hp<=0||data.gulchPermanentGameOver?.ended)return originalCommit(data,activity);
 const map=seed.maps.find(m=>m.id===p.map);
 if(!map)return originalCommit(data,activity);
 let entities=seed.entities.slice();
 const messages=[];
 const helpers=entities.filter(e=>helper(e)&&e.map===p.map&&Math.hypot(e.x-p.x,e.y-p.y)<=6);
 for(const npc of helpers){
  const targets=entities.filter(e=>{
   if(!enemy(e)||e.map!==npc.map)return false;
   const dx=e.x-npc.x,dy=e.y-npc.y;
   return Math.max(Math.abs(dx),Math.abs(dy))<=1&&walk(seed,map,e.x,e.y)&&(!(dx&&dy)||(walk(seed,map,npc.x+dx,npc.y)&&walk(seed,map,npc.x,npc.y+dy)));
  }).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)||String(a.id).localeCompare(String(b.id)));
  if(!targets.length||Math.random()>=.3)continue;
  const target=targets[0],hp=Math.max(0,target.hp-2);
  entities=entities.flatMap(e=>e.id!==target.id?[e]:hp>0?[{...e,hp}]:[]);
  messages.push(String(npc.name||'A friendly traveler')+(hp?' strikes ':' defeats ')+String(target.name||'an enemy')+' for 2 damage.');
  if(!hp&&entities.filter(e=>e.ecosystemLoot).length<48){
   let id='ally-remains:'+target.id+':'+String(latest.stateRevision);
   while(entities.some(e=>e.id===id))id+='x';
   entities.push({id,map:target.map,x:target.x,y:target.y,name:'Remains of '+String(target.name||'creature'),kind:'loot',ecosystemLoot:true,contents:{scrap:2},glyph:'♦',color:'#e8cb85'});
  }
 }
 if(!messages.length)return originalCommit(data,activity);
 const next={...data,seed:{...seed,entities}};
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000)return originalCommit(data,activity);
 return originalCommit(next,[activity,'Friendly aid: '+messages.slice(0,8).join(' '),messages.length>8?'Other nearby villagers also joined the fight.':''].filter(Boolean).join(' '));
};
window.addEventListener('load',()=>{
 const help=document.getElementById('keyHelp');
 if(!help)return;
 const text=document.createElement('p');
 text.textContent='Friendly aid: friendly villagers and travelers within six tiles of you each have a 30% chance per played turn to hit one enemy adjacent to them for 2 damage. They help after enemy retaliation, cannot revive you, and do not attack through blocked corners. Allied kills leave salvage when ground-cache space is available. Animals do not fight. Waiting in menus does not trigger aid.';
 help.append(text);
},{once:true});
})();
