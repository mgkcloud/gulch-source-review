(function(){
'use strict';
const KEY='legendaryAscension',XP=12000,TILES=300;
const commit=Gulch.commit;
let latest=null,refresh=()=>{};
const epoch=d=>String(d?.respawnSettings?.token||'original');
const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(999,Math.floor(Number(n)))):0;
const bounded=(n,max)=>Number.isFinite(Number(n))?Math.max(0,Math.min(max,Math.floor(Number(n)))):0;
const powers={
 hearth:{name:'Heart of the Undying Hearth',glyph:'♥',color:'#ffc18b',description:'Regenerates 3 HP every 12 played turns while slotted. Only heals a surviving adventurer.'},
 aegis:{name:'Aegis of the Long Road',glyph:'◈',color:'#a9dfe5',description:'Prevents up to 2 final incoming damage per played turn while slotted, leaving at least 1 damage. Cannot prevent a lethal hit.'},
 waystar:{name:'Waystar of the First Horizon',glyph:'✦',color:'#d9c5ff',description:'Restores 1 HP whenever you enter a previously uncharted tile in this ascension cycle while slotted. Only heals a surviving adventurer.'}
};
function state(d){const v=d?.[KEY];return v?.epoch===epoch(d)?{...v,xp:bounded(v.xp,XP),tiles:Array.isArray(v.tiles)?v.tiles.filter(x=>typeof x==='string').slice(0,TILES):[],cycles:bounded(v.cycles,96),beats:bounded(v.beats,11)}:{epoch:epoch(d),xp:0,tiles:[],cycles:0,beats:0,receipt:null};}
function grid(d){
 const f=d.freeformForge,p=d.itemEcosystem;
 if(f?.epoch!==epoch(d)||p?.epoch!==epoch(d))return Array(9).fill(null);
 const used=new Map();
 return Array.from({length:9},(_,i)=>{const id=f.grid?.[i],item=f.definitions?.[id],n=used.get(id)||0;if(typeof id!=='string'||!item||count(p.bag?.[id])<=n)return null;used.set(id,n+1);return id;});
}
function active(d){const f=d.freeformForge,found=new Set();for(const id of grid(d)){const kind=f?.definitions?.[id]?.legendaryPassive;if(Object.hasOwn(powers,kind))found.add(kind);}return found;}
Gulch.register('legendary-ascension',{snapshot(s){latest=s;queueMicrotask(refresh);}});
Gulch.commit=function(data,activity,options){
 if(!latest||!data?.seed||epoch(data)!==epoch(latest.gameState)||!(Number(data.turn)>Number(latest.turn)))return commit.call(this,data,activity,options);
 const before=latest.player,after=data.seed.entities.find(e=>e.id==='player');
 if(!after)return commit.call(this,data,activity,options);
 const old=state(latest.gameState),next={...old,tiles:old.tiles.slice()},distance=before.map===after.map?Math.hypot(after.x-before.x,after.y-before.y):0;
 const walked=distance>0&&distance<=Math.SQRT2+.001;
 const moved=walked||before.map!==after.map;
 const tile=JSON.stringify([after.map,after.x,after.y]);
 const newTile=moved&&!next.tiles.includes(tile)&&next.tiles.length<TILES;
 if(newTile)next.tiles.push(tile);
 // Running progression is applied outside this boundary. Count only its
 // confirmed-proposal movement gain; no menu, timer or idle XP is awarded.
 const earned=walked?Math.max(0,Math.min(10,Number(data.runningProgress?.xp)-Number(latest.gameState.runningProgress?.xp||0))):0;
 next.xp=Math.min(XP,next.xp+(Number.isFinite(earned)?earned:0));
 const enabled=active(latest.gameState);
 next.beats=enabled.has('hearth')?(old.beats+1)%12:0;
 let hp=Number(after.hp),notes=[];
 if(hp>0&&!data.gulchPermanentGameOver?.ended){
  if(enabled.has('aegis')&&hp<before.hp){const saved=Math.min(2,Math.max(0,before.hp-hp-1));if(saved){hp+=saved;notes.push('Legendary Aegis prevented '+saved+' damage.');}}
  const healing=(enabled.has('hearth')&&next.beats===0?3:0)+(enabled.has('waystar')&&newTile?1:0);
  if(healing&&Number.isFinite(after.maxHp)){const restored=Math.max(0,Math.min(healing,after.maxHp-hp));hp+=restored;if(restored)notes.push('Legendary blessing restored '+restored+' HP.');}
 }
 const seed=hp===after.hp?data.seed:{...data.seed,entities:data.seed.entities.map(e=>e.id==='player'?{...e,hp}:e)};
 return commit.call(this,{...data,seed,[KEY]:next},[activity,...notes].filter(Boolean).join(' '),options);
};
function mount(){
 const root=document.getElementById('mergeForge'),panel=document.getElementById('inventoryPanel');if(!root||!panel)return;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const style=el('style');style.textContent='#legendaryAscension{margin:24px 0;padding:18px;border:2px solid #dbbd7b;border-radius:12px;background:linear-gradient(135deg,#343c36,#171c30);color:#eee2c5}#legendaryAscension h3{margin:0;color:#ffe5a9;font:22px Georgia,serif}#legendaryAscension progress{height:22px;width:100%;accent-color:#efd28a}#legendaryAscension p{font:12px/1.6 monospace}#legendaryAscension select{width:100%;min-height:44px}#legendaryAscension .ascension-status{min-height:24px;color:#ffe0a0}#legendaryAscension .ascension-owned{padding:10px;border-left:2px solid #d7c58b;white-space:pre-line}';document.head.append(style);
 const section=el('section');section.id='legendaryAscension';section.setAttribute('aria-labelledby','legendaryAscensionTitle');
 const heading=el('h3','SECONDARY MERGE · LEGENDARY ASCENSION');heading.id='legendaryAscensionTitle';
 const bar=el('progress');bar.max=100;bar.value=0;bar.setAttribute('aria-label','Legendary ascension charge');
 const meter=el('p'),requirements=el('p'),label=el('label','Choose your legendary passive');label.htmlFor='legendaryPassiveChoice';
 const choice=el('select');choice.id=label.htmlFor;
 for(const [id,p] of Object.entries(powers)){const o=el('option',p.name);o.value=id;choice.append(o);}
 const preview=el('p'),warning=el('p'),button=el('button','Ascend all 9 grid items');button.type='button';
 const status=el('p');status.className='ascension-status';status.setAttribute('role','status');
 const owned=el('div');owned.className='ascension-owned';
 section.append(heading,el('p','Fill the power grid with nine ordinary merged creations, then charge this forge through a long expedition. Secondary merging consumes one copy from each of the nine slots and creates one legendary relic in the waiting box.'),bar,meter,requirements,label,choice,preview,warning,button,status,owned,el('p','Requires 12,000 running XP (1,200 confirmed adjacent moves) and 300 distinct destination tiles. Both goals must finish. Charge starts with this feature and resets after each ascension or new expedition. Repeated steps earn XP but do not count as new exploration. Menus and waiting add no charge. Legendary passives work only while their relic is in the power grid; identical passive types do not stack. Legendary relics cannot be ingredients in another ascension.'));
 const waiting=document.getElementById('fusionWaitingBox');if(waiting)waiting.before(section);else root.append(section);
 let pending=null,context='';
 function ready(){const m=window.GulchMovementState;return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending&&!document.hidden&&!panel.hidden&&!root.hidden&&!panel.closest('[inert]')&&!document.querySelector('dialog[open]');}
 function eligible(){
  if(!latest)return false;
  const d=latest.gameState,f=d.freeformForge,g=grid(d),worn=Object.values(d.itemEcosystem?.equipment||{});
  if(g.some(id=>!id||!f.definitions[id].freeformFusion||f.definitions[id].legendaryPassive))return false;
  for(const id of new Set(g)){if(count(d.itemEcosystem.bag[id])<g.filter(v=>v===id).length+worn.filter(v=>v===id).length)return false;}
  return true;
 }
 function render(){
  if(!latest)return;
  const d=latest.gameState,s=state(d),g=grid(d),charged=s.xp>=XP&&s.tiles.length>=TILES;
  bar.value=Math.floor(50*s.xp/XP+50*s.tiles.length/TILES);
  meter.textContent=bar.value+'% charged · '+s.xp.toLocaleString()+' / 12,000 XP · '+s.tiles.length+' / 300 explored tiles';
  requirements.textContent=g.filter(Boolean).length+' / 9 occupied slots · '+(eligible()?'Nine eligible creations ready.':'Fill every slot with an ordinary merged creation; equipped copies remain reserved.');
  preview.textContent=powers[choice.value].description+' Also grants Ward 8 with an 8-turn recharge through the existing grid-power system.';
  warning.textContent='Consumes: '+g.map(id=>d.freeformForge?.definitions?.[id]?.name||'Empty slot').join(' · ');
  button.disabled=!ready()||!eligible()||!charged;
  choice.disabled=Boolean(pending);
  const enabled=active(d),defs=d.freeformForge?.epoch===epoch(d)?Object.values(d.freeformForge.definitions||{}):[];
  const relics=defs.filter(i=>i.legendaryPassive&&count(d.itemEcosystem?.bag?.[i.id])>0);
  owned.textContent=relics.length?relics.map(i=>i.name+' · '+(grid(d).includes(i.id)?'ACTIVE':'Waiting / inactive')+'\n'+(powers[i.legendaryPassive]?.description||'')).join('\n\n'):'No legendary creations yet.';
  if(enabled.has('hearth'))owned.textContent+='\nHearth pulse in '+(12-s.beats)+' played turns.';
 }
 button.addEventListener('click',()=>{
  if(!ready()||!eligible())return;
  const d=latest.gameState,s=state(d);if(s.xp<XP||s.tiles.length<TILES)return;
  const kind=choice.value;if(!Object.hasOwn(powers,kind))return;
  const next=structuredClone(d),f=next.freeformForge,p=next.itemEcosystem,g=grid(d);
  const token=typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const id='legendary_'+token,power=powers[kind];
  const investment=g.reduce((sum,key)=>sum+Math.max(1,Number(f.definitions[key].craftValue)||1),0);
  for(const key of g)p.bag[key]=count(p.bag[key])-1;
  f.grid=Array(9).fill(null);f.active=null;
  // Retire only exhausted ingredients, preserving every owned definition.
  for(const key of new Set(g))if(!p.bag[key]&&!Object.values(p.equipment||{}).includes(key)){delete f.definitions[key];if(f.gridReady)delete f.gridReady[key];p.known=(p.known||[]).filter(v=>v!==key);}
  if(Object.keys(f.definitions).length>=96){status.textContent='Creation archive is full. Use ingredients whose final copies will be consumed.';return;}
  const value=Math.min(300000,Math.max(600,Math.ceil(investment*1.5)));
  const description=power.description+' Active only in the shared power grid. Identical legendary passives do not stack. Also grants Ward 8 on an 8-played-turn recharge. Cannot revive you. Consumed if used in an ordinary merge.';
  f.definitions[id]={id,name:power.name+' · '+token.slice(-5),type:'Relic',glyph:power.glyph,freeformFusion:true,legendaryPassive:kind,fusionGeneration:Math.min(99,1+Math.max(...g.map(key=>Number(d.freeformForge.definitions[key].fusionGeneration)||1))),craftValue:value,letterTier:{letter:'S',index:25,color:power.color,baseValue:value,value,skill:description},fusionPower:{kind:'ward',strength:8,cooldown:8},lore:'Nine forged journeys became one legend, tempered by twelve thousand experience and three hundred new horizons.',description};
  p.bag[id]=1;p.known=Array.from(new Set([...(p.known||[]),id]));
  const text='Ascended nine merged creations into '+power.name+'. Place it in the power grid to activate its legendary passive.';
  p.log=[text,...(p.log||[])].slice(0,12);f.receipt=token;
  next[KEY]={epoch:epoch(d),xp:0,tiles:[],cycles:Math.min(96,s.cycles+1),beats:0,receipt:token};
  if(new TextEncoder().encode(JSON.stringify(next)).length>340000){status.textContent='Not enough shared world space. No items or charge were spent.';return;}
  pending={base:latest.stateRevision,token};status.textContent='Awaiting shared confirmation…';
  try{Gulch.commit(next,text);}catch(error){pending=null;status.textContent=String(error.message||error);}
  if(pending&&!window.GulchMovementState?.inFlight){pending=null;status.textContent='Not submitted. Items and charge remain unchanged.';}
  render();
 });
 choice.addEventListener('change',render);
 refresh=()=>{
  const next=latest.revision+':'+epoch(latest.gameState);
  if(context&&context!==next){pending=null;status.textContent='Expedition or source changed. Review the current grid.';}context=next;
  if(pending&&latest.stateRevision!==pending.base){const ok=state(latest.gameState).receipt===pending.token;pending=null;status.textContent=ok?'Legendary relic confirmed in the waiting box. Choose a grid slot to activate it.':'Another update arrived. Review the grid and charge before retrying.';}
  render();
 };
 window.addEventListener('gulch:recovered',()=>queueMicrotask(()=>{if(pending&&!window.GulchMovementState?.inFlight){const ok=state(latest.gameState).receipt===pending.token;pending=null;status.textContent=ok?'Legendary relic confirmed in the waiting box.':'Ascension was not confirmed. Review the current grid before retrying.';}render();}));
 new MutationObserver(render).observe(panel,{attributes:true,attributeFilter:['hidden','data-inventory-page']});
 let available='';setInterval(()=>{if(document.hidden||panel.hidden||root.hidden)return;const key=String(ready());if(key!==available){available=key;render();}},350);
 if(latest)refresh();
}
if(document.readyState==='complete')setTimeout(mount,0);else window.addEventListener('load',()=>setTimeout(mount,0),{once:true});
})();
