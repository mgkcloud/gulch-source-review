(function(){
'use strict';
const KEY='gulchPermanentGameOver',SETTINGS='respawnSettings';
const MODES={easy:{name:'Easy',damage:.5,hp:4},normal:{name:'Normal',damage:1,hp:6},hard:{name:'Hard',damage:2,hp:8},nightmare:{name:'Nightmare',damage:3,hp:12}};
const originalCommit=Gulch.commit,host=document.getElementById('left');
let snapshot=null,ended=false,pending=null,building=false,job=0,previousFocus=null;
const locked=new Map();
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');style.textContent=`
#respawnScreen[hidden]{display:none}#respawnScreen{position:absolute;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:#060e17fa;color:#e4e5d4;font:13px/1.6 ui-monospace,monospace;overflow:auto}.respawn-card{width:min(800px,100%);max-height:100%;overflow:auto;padding:24px;border:1px solid #bb806d;border-radius:12px;background:linear-gradient(145deg,#302b29,#101f29);box-shadow:0 24px 80px #0009}#respawnScreen h1{margin:0;color:#f1c09e;font-size:24px;letter-spacing:1px}#respawnScreen h2{font-size:16px;color:#ead9b3}#respawnScreen p{margin:10px 0;color:#bacdbf}#respawnScreen label{display:block;margin-top:12px;color:#ead9b3}#respawnScreen select,#respawnScreen input,#respawnScreen button{width:100%;min-height:44px;padding:10px;margin-top:6px;font:inherit;background:#102726;color:#eef0db;border:1px solid #81997c;border-radius:6px}#respawnScreen button{background:#654638;color:#fff0c4;font-weight:bold;cursor:pointer}#respawnScreen button:disabled{opacity:.5;cursor:wait}#respawnScreen :focus-visible{outline:2px solid #f0d09a;outline-offset:3px}.respawn-options{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}#worldBuildPreview{display:block;width:100%;height:auto;max-height:260px;object-fit:contain;image-rendering:pixelated;background:#08151c;border:1px solid #536e60;border-radius:6px}#worldBuildProgress{width:100%;height:16px;accent-color:#bad49a}#worldBuildDetails{font-size:11px;white-space:pre-wrap}#respawnStatus{min-height:24px}#worldBuildStages{padding-left:22px;font-size:12px;color:#aebfb0}#worldBuildStages li[data-status=active]{color:#ffe0a1}#worldBuildStages li[data-status=done]{color:#b8dfa5}@media(max-width:500px){.respawn-card{padding:14px}.respawn-options{grid-template-columns:1fr}#respawnScreen h1{font-size:19px}}
`;document.head.append(style);
const panel=el('section');panel.id='respawnScreen';panel.hidden=true;panel.tabIndex=-1;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','respawnTitle');
const card=el('div');card.className='respawn-card';const title=el('h1','HARDCORE · EXPEDITION ENDED');title.id='respawnTitle';const summary=el('p');
card.append(title,summary,el('p','Create a fresh, detailed expedition. Death ends every difficulty mode. Both room members share the new world; the previous expedition cannot be continued.'));
const options=el('div');options.className='respawn-options';
function select(id,label,values){const box=el('div'),l=el('label',label),s=el('select');l.htmlFor=id;s.id=id;values.forEach(([v,t])=>{const o=el('option',t);o.value=v;s.append(o);});box.append(l,s);options.append(box);return s;}
const difficulty=select('respawnDifficulty','Difficulty',Object.entries(MODES).map(([k,v])=>[k,v.name]));difficulty.value='hard';
const world=select('respawnWorld','World landscape',[['meadow','Wildwood frontier · forests, rivers & villages'],['cavern','Deep kingdoms · chambers, mines & underground lakes']]);
const size=select('respawnWorldSize','World size',[['standard','Expedition · 65 × 49 tiles'],['large','Great expedition · 89 × 65 tiles']]);
const detail=select('respawnWorldDetail','Landscape character',[['balanced','Balanced · settlements and wilderness'],['wild','Wild · denser forests and more ruins'],['settled','Settled · more villages and supplies']]);
card.append(options);const help=el('p');help.id='respawnDifficultyHelp';difficulty.setAttribute('aria-describedby',help.id);
function modeKey(v){return Object.prototype.hasOwnProperty.call(MODES,v)?v:'hard';}
function modeHelp(){const m=MODES[modeKey(difficulty.value)];help.textContent=m.name+' · '+m.damage+'× incoming damage · enemies begin at '+m.hp+' HP. Difficulty stays fixed during the expedition.';}
difficulty.addEventListener('change',modeHelp);modeHelp();card.append(help);
const label=el('label','World seed');label.htmlFor='respawnSeed';const input=el('input');input.id='respawnSeed';input.maxLength=80;input.autocomplete='off';input.spellcheck=false;
function randomSeed(){return 'gulch-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
input.value=randomSeed();const random=el('button','Generate random seed');random.type='button';random.addEventListener('click',()=>{input.value=randomSeed();input.focus();});
card.append(label,input,random,el('p','The same seed, landscape, size and character recreate the same terrain and starting sites. Construction runs in stages so you can watch the world take shape.'));
const preview=el('canvas');preview.id='worldBuildPreview';preview.width=260;preview.height=196;preview.setAttribute('role','img');preview.setAttribute('aria-label','World generation preview, awaiting construction');
const progress=el('progress');progress.id='worldBuildProgress';progress.max=100;progress.value=0;progress.setAttribute('aria-label','World construction progress');
const stageTitle=el('h2','Ready to shape a new world');const stages=el('ol');stages.id='worldBuildStages';
const names=['Shape terrain and water','Carve safe routes and chambers','Build settlements and ancient sites','Place supplies, wildlife and encounters','Verify routes and prepare the expedition'];
const rows=names.map(t=>{const n=el('li',t);stages.append(n);return n;});
const facts=el('p');facts.id='worldBuildDetails';facts.textContent='Preview: green forest · blue water · tan roads · grey stone · gold settlements.';
const start=el('button','Build new hardcore expedition');start.type='button';const status=el('p');status.id='respawnStatus';status.setAttribute('role','status');
card.append(stageTitle,preview,progress,stages,facts,start,status);panel.append(card);host.append(panel);
function dead(data){const p=data?.seed?.entities?.find(e=>e.id==='player');return data?.[KEY]?.ended===true||Boolean(p&&Number.isFinite(p.hp)&&p.hp<=0);}
function lock(){for(const n of host.children){if(n===panel)continue;if(!locked.has(n))locked.set(n,n.inert);n.inert=true;}panel.hidden=false;}
function unlock(){for(const [n,v] of locked)if(n.isConnected)n.inert=v;locked.clear();panel.hidden=true;}
Gulch.commit=function(data,activity){
 if(ended||dead(snapshot?.gameState))return;
 const selected=modeKey(snapshot?.gameState?.[SETTINGS]?.difficulty),before=snapshot?.player,after=data?.seed?.entities?.find(e=>e.id==='player');let next=data;
 if(before&&after&&Number.isFinite(before.hp)&&Number.isFinite(after.hp)&&after.hp<before.hp){const hp=Math.max(0,before.hp-(before.hp-after.hp)*MODES[selected].damage);next={...next,seed:{...next.seed,entities:next.seed.entities.map(e=>e.id==='player'?{...e,hp}:e)}};}
 return originalCommit({...next,[SETTINGS]:{...next[SETTINGS],difficulty:selected,hardcore:true}},activity);
};
function controls(){const disabled=building||Boolean(pending)||Boolean(window.GulchMovementState?.inFlight);[difficulty,world,size,detail,input,random,start].forEach(n=>{n.disabled=disabled;});panel.setAttribute('aria-busy',String(building||Boolean(pending)));}
function rngFor(text){let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return ()=>{h=(h+0x6d2b79f5)|0;let t=Math.imul(h^(h>>>15),1|h);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
const legend={'.':['floor','grass'],',':['floor','soil'],'T':['floor','tree'],'~':['water','water'],'#':['wall','stone'],'s':['floor','stone'],'f':['floor','fungus'],'=':['floor','plank'],'H':['wall','wood'],'>':['floor','stone']};
const colors={'.':'#657c4b',',':'#a38a5b','T':'#2f583c','~':'#32677f','#':'#293942','s':'#6d7778','f':'#548577','=':'#bca16e','H':'#dab77b','>':'#e7daa0'};
function paint(b){preview.width=b.w*4;preview.height=b.h*4;const ctx=preview.getContext('2d');b.grid.forEach((row,y)=>row.forEach((c,x)=>{ctx.fillStyle=colors[c]||'#222';ctx.fillRect(x*4,y*4,4,4);}));ctx.fillStyle='#fff1b5';ctx.fillRect(4*4,4*4,5,5);preview.setAttribute('aria-label','Generated '+b.kind+' world, '+b.w+' by '+b.h+' tiles. '+b.sites.length+' landmarks placed.');}
function buildContext(config){const large=config.size==='large',w=large?89:65,h=large?65:49;return {...config,w,h,rng:rngFor('detailed-v1:'+config.kind+':'+config.seed+':'+config.size+':'+config.detail),grid:Array.from({length:h},()=>Array(w).fill('#')),sites:[],entities:[],protected:new Set(),rooms:[],serial:0};}
function terrain(b){
 const r=b.rng,phase=r()*6.28,river=b.w*.55,pond={x:Math.floor(b.w*.76),y:Math.floor(b.h*.7)},patches=Array.from({length:12},()=>({x:r()*b.w,y:r()*b.h,r:4+r()*7,type:r()}));
 for(let y=1;y<b.h-1;y++)for(let x=1;x<b.w-1;x++){
  const n=r();let c=b.kind==='meadow'?'.':'#';
  const patch=patches.find(p=>Math.hypot(x-p.x,y-p.y)<p.r);
  if(b.kind==='meadow'){
   const riverX=river+Math.sin(y*.15+phase)*5;
   if(Math.abs(x-riverX)<1.5||((x-pond.x)**2/70+(y-pond.y)**2/32)<1)c='~';
   else if(n<(b.detail==='wild'?.4:.25)+(patch?.type>.5?.16:0))c='T';
   else if(patch&&patch.type<.25)c=n<.4?'s':',';
   else if(n<.31)c=',';
  }else if(patch){c=patch.type<.2&&Math.hypot(x-patch.x,y-patch.y)<patch.r*.5?'~':n<.25?'f':'s';}
  b.grid[y][x]=c;
 }
}
function clear(b,x,y,r,c){for(let yy=Math.max(1,y-r);yy<=Math.min(b.h-2,y+r);yy++)for(let xx=Math.max(1,x-r);xx<=Math.min(b.w-2,x+r);xx++)b.grid[yy][xx]=c;}
function path(b,a,z){let x=a.x,y=a.y;const put=()=>{b.grid[y][x]=b.grid[y][x]==='~'?'=':b.kind==='meadow'?',':'s';b.protected.add(x+','+y);};put();while(x!==z.x){x+=Math.sign(z.x-x);put();}while(y!==z.y){y+=Math.sign(z.y-y);put();}}
function routes(b){
 const floor=b.kind==='meadow'?'.':'s';clear(b,4,4,3,floor);
 for(let y=9;y<b.h-7;y+=12)for(let x=10;x<b.w-7;x+=15){const q={x:x+Math.floor(b.rng()*3),y:y+Math.floor(b.rng()*3)};b.rooms.push(q);if(b.kind==='cavern')clear(b,q.x,q.y,4,'s');}
 let prev={x:4,y:4};b.rooms.forEach(q=>{path(b,prev,q);prev=q;});
 for(let i=0;i<b.rooms.length;i+=3)path(b,{x:4,y:4},b.rooms[i]);
}
function entity(b,e){const id='expedition-'+b.serial++;b.entities.push({id,map:b.mapId,...e});}
function landmarks(b){
 const villages=b.detail==='settled'?4:2;
 b.rooms.forEach((q,i)=>{
  const settlement=i<villages,type=settlement?'settlement':'ruin',name=settlement?['Willowwatch','Copper Hearth','Lantern Rest','Mossgate'][i]:['The Broken Watch','Moonwell Ruins','Ashen Shrine','Forgotten Archive'][i%4];
  clear(b,q.x,q.y,3,b.kind==='meadow'?'.':'s');
  if(settlement){
   for(let dy=-3;dy<=0;dy++)for(let dx=-3;dx<=3;dx++)b.grid[q.y+dy][q.x+dx]=(dy===-3||dx===-3||dx===3)?'H':'=';
   b.grid[q.y][q.x]='=';
   entity(b,{name:name+' keeper',x:q.x+2,y:q.y-1,kind:'villager',faction:'friendly',outsideNPC:true,dialogue:'Welcome to '+name+'. The marked roads connect our shelters. Gather supplies in the wilderness and keep herbs for the journey.'});
  }else{
   for(const [dx,dy] of [[-3,-3],[3,-3],[-3,3],[3,3]])b.grid[q.y+dy][q.x+dx]='#';
   entity(b,{name,kind:'ancient-marker',x:q.x+2,y:q.y-2,glyph:'◈',color:'#ded4a4',dialogue:'Weathered markings describe travelers sheltering here before the old roads fell silent.'});
  }
  b.sites.push({name,type,x:q.x,y:q.y,map:b.mapId});
 });
 path(b,{x:4,y:4},b.rooms[0]||{x:8,y:8});
}
function reachable(b){const queue=[{x:4,y:4}],seen=new Set(['4,4']);for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,y=queue[i].y+dy,c=b.grid[y]?.[x],k=x+','+y;if(c&&!['#','H','~'].includes(c)&&!seen.has(k)){seen.add(k);queue.push({x,y});}}return queue;}
function populate(b){
 const used=new Set(b.entities.map(e=>e.x+','+e.y));let spots=reachable(b).filter(q=>Math.hypot(q.x-4,q.y-4)>8&&!used.has(q.x+','+q.y)&&!b.protected.has(q.x+','+q.y)&&b.sites.every(v=>Math.hypot(v.x-q.x,v.y-q.y)>4));
 for(let i=spots.length-1;i>0;i--){const j=Math.floor(b.rng()*(i+1));[spots[i],spots[j]]=[spots[j],spots[i]];}
 function take(){return spots.pop();}
 const resources=['wood','iron','crystal','stone','copper'];
 for(let i=0;i<(b.size==='large'?48:32);i++){const q=take();if(!q)break;const type=resources[i%resources.length];entity(b,{...q,name:{wood:'Fallen ancient timber',iron:'Exposed iron vein',crystal:'Luminous quartz cluster',stone:'Weathered stone fragments',copper:'Copper-bearing rocks'}[type],kind:'resource',outsideResource:type,quantity:2+Math.floor(b.rng()*4),glyph:type==='wood'?'≡':'◆',color:type==='crystal'?'#badfff':'#ddbc87'});}
 for(let i=0;i<8;i++){const q=take();if(!q)break;entity(b,{...q,name:'Wild healing herbs',kind:'resource',livingResource:'herb',quantity:1,glyph:'✿',color:'#bce8ad'});}
 if(b.kind==='meadow')for(let i=0;i<8;i++){const q=take();if(!q)break;const species=['deer','rabbit','sheep','fox'][i%4];entity(b,{...q,name:'Wildwood '+species,kind:'animal',species,outsideAnimal:species,faction:'friendly',glyph:' ',dialogue:'The '+species+' pauses beside the old trail.'});}
 const count=b.size==='large'?16:10;
 for(let i=0;i<count;i++){const q=take();if(!q)break;const sprite=['beetle','crawler','wisp'][i%3],hp=MODES[b.difficulty].hp;entity(b,{...q,name:['Amber shell beetle','Moss cave crawler','Violet cave wisp'][i%3],kind:'cave-creature',faction:'hostile',caveEncounter:1,caveSprite:sprite,hp,maxHp:hp,glyph:' '});}
}
function validate(b){
 const accessible=reachable(b),seen=new Set(accessible.map(q=>q.x+','+q.y));
 if(accessible.length<200)throw new Error('Not enough connected terrain. Try another seed.');
 if(b.entities.some(e=>!seen.has(e.x+','+e.y)))throw new Error('A landmark or encounter is disconnected. Try another seed.');
 if(b.sites.some(q=>!seen.has(q.x+','+q.y)))throw new Error('A settlement route is disconnected. Try another seed.');
 const ids=new Set(),coords=new Set();for(const e of b.entities){const k=e.x+','+e.y;if(ids.has(e.id)||coords.has(k))throw new Error('World placement conflict. Try another seed.');ids.add(e.id);coords.add(k);}
 b.accessible=accessible.length;
 const counts={};b.grid.flat().forEach(c=>{counts[c]=(counts[c]||0)+1;});
 b.report={generator:'detailed-v1',walkableTiles:accessible.length,waterTiles:counts['~']||0,forestTiles:counts.T||0,settlements:b.sites.filter(s=>s.type==='settlement').length,ruins:b.sites.filter(s=>s.type==='ruin').length,resources:b.entities.filter(e=>e.outsideResource||e.livingResource).length,enemies:b.entities.filter(e=>e.faction==='hostile').length};
}
function pause(){return new Promise(resolve=>setTimeout(resolve,65));}
async function revive(){
 if(!snapshot||!ended||building||pending||window.GulchMovementState?.inFlight)return;
 const seed=input.value.trim();if(!seed||seed.length>80||/[\u0000-\u001f\u007f]/.test(seed)){status.textContent='Enter a seed of 1–80 printable characters.';input.focus();return;}
 const config={kind:world.value,size:size.value,detail:detail.value,difficulty:difficulty.value,seed};
 if(!['meadow','cavern'].includes(config.kind)||!['standard','large'].includes(config.size)||!['balanced','wild','settled'].includes(config.detail)||!Object.prototype.hasOwnProperty.call(MODES,config.difficulty))return;
 const token=++job,initialEpoch=snapshot.gameState[SETTINGS]?.token;building=true;controls();rows.forEach(n=>{delete n.dataset.status;});progress.value=0;
 try{
  const b=buildContext(config);const count=(Number.isSafeInteger(snapshot.gameState[SETTINGS]?.count)?snapshot.gameState[SETTINGS].count:0)+1;b.mapId='hardcore-'+count;
  const tasks=[terrain,routes,landmarks,populate,validate];
  for(let i=0;i<tasks.length;i++){
   if(token!==job||!ended||snapshot.gameState[SETTINGS]?.token!==initialEpoch)return;
   rows[i].dataset.status='active';stageTitle.textContent=names[i];status.textContent='Building your world · stage '+(i+1)+' of '+tasks.length;await pause();
   if(token!==job||!ended)return;
   tasks[i](b);paint(b);progress.value=Math.round((i+1)/tasks.length*95);rows[i].dataset.status='done';
   facts.textContent=b.w+' × '+b.h+' tiles · '+b.sites.length+' landmarks · '+b.entities.length+' inhabitants and supplies';await pause();
  }
  if(token!==job||!ended||snapshot.gameState[SETTINGS]?.token!==initialEpoch)return;
  if(window.GulchMovementState?.inFlight)throw new Error('The room is updating. Build again when the update finishes.');
  const data=snapshot.gameState,p=snapshot.player,maxHp=Number.isFinite(p.maxHp)&&p.maxHp>0?p.maxHp:20;
  const anchor={map:b.mapId,x:4,y:4},player={...p,...anchor,hp:maxHp,maxHp,inventory:[],equipment:{},equipped:{}};
  const map={id:b.mapId,name:b.kind==='meadow'?'Wildwood Frontier':'The Deep Kingdoms',biome:b.kind,ascii:b.grid.map(r=>r.join('')),exits:[],respawnBuild:true,generationSeed:seed,landmarks:b.sites,generationReport:b.report};
  const newToken=String(snapshot.stateRevision)+':'+count+':'+randomSeed();
  const next={...data,seed:{...data.seed,legend,maps:[map],entities:[player,...b.entities]},turn:0,inventory:[],equipment:{},[KEY]:{ended:false},[SETTINGS]:{difficulty:b.difficulty,hardcore:true,build:b.kind,generationSeed:seed,count,token:newToken,size:b.size,detail:b.detail,generator:'detailed-v1'},sword:{facing:{dx:0,dy:1},lastAttack:null},runningProgress:{xp:0,distance:0,anchor},smallCaveEncounter:{spawned:true,map:b.mapId,enemyIds:b.entities.filter(e=>e.caveEncounter).map(e=>e.id)},outsideWorld:{map:b.mapId,entrance:{...anchor},resources:{},villages:b.sites.filter(s=>s.type==='settlement')},livingWorld:{epoch:newToken,age:0,wave:0,forge:0,camp:0,herbs:2,visits:[],claims:[],log:[]}};
  delete next.legendarySwordQuest;
  if(new TextEncoder().encode(JSON.stringify(next)).length>350000)throw new Error('The generated expedition exceeds the shared state limit. Choose a smaller world.');
  facts.textContent=b.accessible+' connected tiles · '+b.report.settlements+' settlements · '+b.report.ruins+' ruins · '+b.report.resources+' resource patches · '+b.report.enemies+' enemies. Safe start verified; two healing herbs packed.';
  stageTitle.textContent='World built · awaiting the room';status.textContent='Sending the completed world. Entering after shared confirmation…';pending={base:snapshot.stateRevision,token:newToken};
  originalCommit(next,'New detailed hardcore expedition · '+MODES[b.difficulty].name+' · '+map.name+' · seed '+seed+'.');
 }catch(error){pending=null;stageTitle.textContent='World construction paused';status.textContent=String(error.message||error);}
 finally{if(token===job){building=false;controls();}}
}
start.addEventListener('click',revive);
Gulch.register('respawn-screen',{snapshot(s){
 snapshot=s;
 if(pending&&s.stateRevision!==pending.base){const confirmed=s.gameState[SETTINGS]?.token===pending.token;pending=null;progress.value=confirmed?100:progress.value;status.textContent=confirmed?'World confirmed. Entering expedition.':'Another room update arrived. Build again to start a new expedition.';}
 if(dead(s.gameState)){
  const first=!ended;ended=true;lock();summary.textContent='Fallen on turn '+String(s.turn??0)+' · '+String(s.seed.maps.find(m=>m.id===s.mapId)?.name||s.mapId);
  if(first){previousFocus=document.activeElement;input.value=randomSeed();difficulty.value=modeKey(s.gameState[SETTINGS]?.difficulty);modeHelp();status.textContent='Choose your landscape, scale and seed.';difficulty.focus({preventScroll:true});}controls();
 }else if(ended){ended=false;job++;building=false;pending=null;unlock();const target=previousFocus?.isConnected&&!previousFocus.closest('#workBoard')?previousFocus:document.getElementById('inventoryToggle');target?.focus({preventScroll:true});}
}});
window.addEventListener('keydown',event=>{
 if(!ended)return;event.stopImmediatePropagation();
 if(event.key==='Escape'){event.preventDefault();panel.focus();return;}
 if(event.key==='Tab'){
  const nodes=Array.from(panel.querySelectorAll('select,input,button')).filter(n=>!n.disabled),first=nodes[0],last=nodes[nodes.length-1];
  if(!first){event.preventDefault();panel.focus();return;}
  if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
 }
 if(!panel.contains(event.target)){event.preventDefault();panel.focus();}
},true);
new MutationObserver(()=>{if(ended)lock();}).observe(host,{childList:true});
setInterval(()=>{if(ended)controls();},250);
})();
