import fs from 'node:fs';
import {durableReplace} from './world-store.mjs';
export const STORY='main quest is to find pieces of the legendary sword build it at the cathedral and take the sword to the stone of truth';
const RETRYABLE=new Set(['awaiting_retry','interrupted','failed','rejected','queued_not_sent','cancelled']);
export function retryable(job){return job&&RETRYABLE.has(job.status);}
export function restore(saved,seed){
  const patches=(saved?.patches||[]).map(p=>['queued','running','queued_not_sent'].includes(p.status)
    ? {...p,status:'interrupted',stage:'awaiting_retry',error:'Previous request was not completed; retry deliberately.'}:p);
  const next=Math.max(saved?.nextPatchId||1,...patches.map(p=>Number(p.id)||0))+1;
  const missing=!patches.some(p=>p.text===STORY);
  return {
    gameState:saved?.gameState||{seed:saved?.seed||seed,turn:saved?.turn||0},stateRevision:saved?.stateRevision||0,
    chat:saved?.chat||[],gameLog:saved?.gameLog||[],clients:0,
    userNotes:saved?.userNotes||{revision:0,items:[]},
    patches:missing?[...patches,{id:next,text:STORY,status:'awaiting_retry',stage:'awaiting_retry'}]:patches,
    nextPatchId:next+(missing?1:0),revision:saved?.revision||0,editorRevision:saved?.editorRevision||0,repairEnabled:saved?.repairEnabled??true,sourceDir:saved?.sourceDir||'game-project',
  };
}
export function validateCommit(state,b){
  if(b.base!==state.stateRevision||b.revision!==state.revision)return {code:409,error:'State changed; action rejected. Please try again.'};
  if(!b.data||typeof b.data!=='object'||Array.isArray(b.data)||Buffer.byteLength(JSON.stringify(b.data))>200000)
    return {code:400,error:'Game state must be a JSON object under 200KB'};
  const stack=[[b.data,0]];
  while(stack.length){
    const [value,depth]=stack.pop();
    if(depth>32)return {code:400,error:'Game state nesting exceeds 32 levels'};
    if(value&&typeof value==='object')for(const child of Object.values(value))stack.push([child,depth+1]);
  }
  return null;
}
/* Patch jobs are source-code history, not room state. They were 53 MB of a
   55 MB room-state.json, so every player move serialised and fsynced them.
   The sidecar is written only when the job list actually changes. */
const lastPatches=new Map();
export function patchesFile(file){return file+".patches";}
export function loadRoom(file){
  let room={},jobs=null;
  try{room=JSON.parse(fs.readFileSync(file,"utf8"));}catch(e){if(e.code!=="ENOENT")throw e;}
  try{jobs=JSON.parse(fs.readFileSync(patchesFile(file),"utf8"));}catch(e){if(e.code!=="ENOENT")throw e;}
  // Legacy layout: jobs still embedded. Move them out on first read.
  if(!Array.isArray(jobs)&&Array.isArray(room.patches)){
    jobs=room.patches;
    const {patches,...rest}=room;
    durableReplace(patchesFile(file),JSON.stringify(jobs));
    durableReplace(file,JSON.stringify(rest));
    room=rest;
  }
  return {...room,patches:Array.isArray(jobs)?jobs:[]};
}
export function saveRoom(file,state){
  const {patches,...rest}=state;
  // Jobs first: they are the durable record of queued work.
  if(Array.isArray(patches)){
    const text=JSON.stringify(patches);
    if(lastPatches.get(file)!==text){
      durableReplace(patchesFile(file),text);
      lastPatches.set(file,text);
    }
  }
  if(rest.worldStore===1){
    const {gameState,stateRevision,gameLog,seed,turn,...metadata}=rest;
    durableReplace(file,JSON.stringify({...metadata,clients:0}));
  }else durableReplace(file,JSON.stringify({...rest,seed:rest.gameState.seed,turn:rest.gameState.turn||0,clients:0}));
}
// Compatibility projection only: gameplay is never evaluated by the server.
export function legacyView(data){
  const seed=data.seed;
  if(!Array.isArray(seed?.entities)||!Array.isArray(seed?.maps))return {};
  const p=seed.entities.find(e=>e?.id==='player');
  const map=seed.maps.find(m=>m?.id===p?.map);
  if(!p||!Array.isArray(map?.ascii))return {};
  const radius=Number.isFinite(seed.meta?.fov?.radius)?Math.max(0,Math.min(100,seed.meta.fov.radius)):0;
  return {player:{x:p.x,y:p.y,hp:p.hp,maxHp:p.maxHp},mapId:p.map,
    lit:map.ascii.slice(0,256).map((row,y)=>Array.from(typeof row==='string'?row.slice(0,256):'',(_,x)=>Math.hypot(x-p.x,y-p.y)<=radius+.5?1:0))};
}
