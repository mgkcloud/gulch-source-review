(function(){
'use strict';
function isRat(entity){return [entity.id,entity.name,entity.species,entity.type,entity.kind].some(value=>typeof value==='string'&&/(^|[^a-z])rats?([^a-z]|$)/i.test(value));}
function protectedTarget(e){return e.loreSpeaker||e.isPlayer||e.playerId||e.clientId||e.ownerId||e.itemId!=null||/player|item|weapon|armor|armour|equipment|consumable|loot|object|prop/i.test([e.kind,e.type,e.species].filter(v=>typeof v==='string').join(' '));}
// Isolate the optional hook from all objects owned by the supplied JSON state.
function copy(value){
 if(Array.isArray(value))return value.map(copy);
 if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copy(item)]));
 return value;
}
function isolatedCopy(value){
 if(typeof globalThis.structuredClone==='function'){
  try{return globalThis.structuredClone(value);}catch(error){}
 }
 return copy(value);
}
function apply(gameState,action,hooks={}){
 if(!action||typeof action!=='object')return null;
 if(action.type==='move'&&(!Number.isInteger(action.dx)||!Number.isInteger(action.dy)||Math.abs(action.dx)>1||Math.abs(action.dy)>1||(!action.dx&&!action.dy)))return null;
 if(!['move','descend'].includes(action.type))return null;
 const original=gameState,originalSeed=original.seed;
 let entities=originalSeed.entities,p=entities.find(e=>e.id==='player'),turn=Number(original.turn)||0,sword=original.sword,note='';
 if(!p||p.hp<=0||original.gulchPermanentGameOver?.ended)return null;
 const initialTurn=turn,map=originalSeed.maps.find(m=>m.id===p.map);
 if(!map)return null;
 const occupants=new Map();
 for(const e of entities)if(e.id!=='player'&&!isRat(e)&&e.map===p.map){const key=e.x+','+e.y;if(!occupants.has(key))occupants.set(key,e);}
 function replace(entity){entities=entities.map(e=>e.id===entity.id?entity:e);}
 function terrain(x,y){const ch=map.ascii[y]?.[x];return Boolean(ch)&&!['#','~'].includes(ch)&&!['wall','water'].includes(originalSeed.legend[ch]?.[0]);}
 function occupant(x,y){return occupants.get(x+','+y);}
 if(action.type==='move'){
  const {dx,dy}=action,x=p.x+dx,y=p.y+dy,ch=map.ascii[y]?.[x];
  const changedFacing=sword?.facing?.dx!==dx||sword?.facing?.dy!==dy;
  sword={...sword,facing:{dx,dy}};
  const corner=dx&&dy&&(!terrain(p.x+dx,p.y)||!terrain(p.x,p.y+dy)||occupant(p.x+dx,p.y)||occupant(p.x,p.y+dy));
  const entity=occupant(x,y);
  if(!terrain(x,y)||corner){
   if(!changedFacing)return null;
   note='Blocked.';
  }else if(entity){
   if(entity.faction==='hostile'&&!protectedTarget(entity)){
    if(entity.practiceTarget){if(!changedFacing)return null;note='Face the wooden target and press Space or Attack to slash.';}
    else{
     const hit={...entity,hp:Math.max(0,(entity.hp||4)-2)};turn++;note='You hit '+entity.name+'.';
     if(!hit.hp){entities=entities.filter(e=>e.id!==entity.id);note='You defeat '+entity.name+'.';}else replace(hit);
    }
   }else{
    if(!changedFacing)return null;
    note='You meet '+entity.name+'. '+(entity.dialogue||'');
   }
  }else{
   p={...p,x,y};replace(p);turn++;note='You stand on '+(originalSeed.legend[ch]?.[1]||'ground')+'.';
   const occupied=new Map();
   for(const e of entities)if(e.map===p.map&&!isRat(e)){const key=e.x+','+e.y;occupied.set(key,(occupied.get(key)||0)+1);}
   for(const e of entities.filter(e=>e.ai==='chase'&&!e.practiceTarget&&e.caveEncounter!==1&&e.map===p.map)){
    const distance=Math.hypot(e.x-p.x,e.y-p.y);
    if(distance<9&&distance>1.2){
     const nx=e.x+(Math.abs(p.x-e.x)>Math.abs(p.y-e.y)?Math.sign(p.x-e.x):0),ny=e.y+(nx===e.x?Math.sign(p.y-e.y):0);
     const from=e.x+','+e.y,to=nx+','+ny;
     if(terrain(nx,ny)&&!(occupied.get(to)>0)){
      replace({...e,x:nx,y:ny});
      if(!isRat(e)){occupied.set(from,Math.max(0,(occupied.get(from)||0)-1));occupied.set(to,(occupied.get(to)||0)+1);}
     }
    }
   }
  }
 }else{
  const exit=map.exits?.find(e=>e.x===p.x&&e.y===p.y);
  if(!exit)return null;
  p={...p,map:exit.to,x:exit.at.x,y:exit.at.y};replace(p);turn++;note='You descend.';
 }
 let seed={...originalSeed,entities};
 if(turn!==initialTurn&&hooks.advanceCaves!==undefined){seed=hooks.advanceCaves(isolatedCopy(seed));const hp=seed.entities.find(e=>e.id==='player').hp;if(hp<p.hp)note+=' Cave enemies deal '+(p.hp-hp)+' damage.';}
 return {data:{...original,seed,turn,...(sword?{sword}:{})},activity:note};
}
globalThis.GulchWorldEngine=Object.freeze({apply});
})();
