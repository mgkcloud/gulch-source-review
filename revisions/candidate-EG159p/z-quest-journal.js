(function(){
'use strict';
const KEY='legendarySwordQuest';
const PARTS=[['blade','Dawnsteel Blade'],['guard','Sunfire Guard'],['hilt','Oathbound Hilt']];
let snapshot=null,pending=null,previousFocus=null;
const host=document.getElementById('left');
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=el('style');style.textContent=`
#questToggle{position:absolute;right:18px;top:312px;z-index:4;min-height:40px;padding:9px 13px;background:#132c2b;color:#ffe1a3;border:1px solid #879c6e;border-radius:5px;font:11px monospace}
#swordQuestTracker{position:absolute;left:18px;top:350px;z-index:4;width:min(245px,calc(100% - 190px));padding:12px;background:#0b2023ed;border:1px solid #8e855f;border-radius:7px;color:#eadfc1;font:11px/1.6 monospace}
#swordQuestTracker strong{color:#f3ce88}#swordQuestTracker p{margin:5px 0}#swordQuestTracker button{width:100%;min-height:44px;background:#344536;color:#ffe7b4;border:1px solid #aa9868;border-radius:5px;font:inherit;padding:8px}#swordQuestTracker button:disabled{opacity:.55}
#questBoard[hidden]{display:none}#questBoard{position:absolute;inset:18px;z-index:11;overflow:auto;background:#09191ffb;border:1px solid #ad9867;border-radius:10px;padding:24px;color:#dce5d0;box-shadow:0 20px 70px #000b;font:13px/1.7 monospace}
#questBoard header{display:flex;justify-content:space-between;align-items:center;gap:12px}#questBoard h2{color:#f1d49a;font-size:20px;margin:0}#questBoard h3{color:#e4c68a;font-size:15px}#questBoard button{min-height:44px;background:#20382f;color:#ffe5af;border:1px solid #87986a;border-radius:5px;padding:9px 12px;font:inherit}#questBoard li{padding:10px 0;border-bottom:1px solid #365149}#questBoard .quest-done{color:#b9dda1}#questBoard p{max-width:740px}#questBoard :focus-visible,#questToggle:focus-visible,#swordQuestTracker :focus-visible{outline:2px solid #f1d49a;outline-offset:3px}
@media(max-width:700px){#questToggle{right:10px;top:294px}#swordQuestTracker{left:10px;top:365px;width:calc(100% - 175px);padding:8px;font-size:10px}#questBoard{inset:8px;padding:16px}#questBoard h2{font-size:16px}}
@media(max-height:700px){#swordQuestTracker{top:auto;bottom:250px;max-height:130px;overflow:auto}}
`;document.head.append(style);
const toggle=button('Main quest',()=>show(true));toggle.id='questToggle';toggle.setAttribute('aria-controls','questBoard');toggle.setAttribute('aria-expanded','false');
const board=el('section');board.id='questBoard';board.hidden=true;board.setAttribute('role','dialog');board.setAttribute('aria-modal','true');board.setAttribute('aria-labelledby','swordQuestTitle');
const header=el('header'),title=el('h2','THE SWORD OF FIRST LIGHT');title.id='swordQuestTitle';const close=button('Close',()=>show(false));header.append(title,close);
const story=el('p','The legendary sword was broken into three pieces when the cathedral fell silent. Recover its Dawnsteel Blade, Sunfire Guard and Oathbound Hilt. Rebuild it at the cathedral altar, then carry it to the Stone of Truth to reveal its purpose.');
const objectives=el('ol'),guidance=el('p'),result=el('p');result.setAttribute('role','status');
board.append(header,story,el('h3','MAIN QUEST'),objectives,guidance,result);
const tracker=el('section');tracker.id='swordQuestTracker';tracker.setAttribute('aria-label','Main quest objective');const trackerTitle=el('strong','SWORD OF FIRST LIGHT'),progress=el('p'),hint=el('p'),interact=button('Approach a quest landmark',use),status=el('p');status.setAttribute('role','status');tracker.append(trackerTitle,progress,hint,interact,status);host.append(toggle,board,tracker);
function show(open){if(open)previousFocus=document.activeElement;board.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open){render();close.focus();}else(previousFocus?.isConnected?previousFocus:toggle).focus();}
window.addEventListener('keydown',event=>{
 if(board.hidden)return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();show(false);return;}
 if(event.key==='Tab'){event.preventDefault();close.focus();}
 event.stopImmediatePropagation();
},true);
function epoch(s){return String(s.gameState.respawnSettings?.token||'original');}
function quest(){const q=snapshot?.gameState[KEY];return q&&q.epoch===epoch(snapshot)&&snapshot.seed.maps.some(m=>m.id===q.map)?q:null;}
function floor(seed,map,x,y){const ch=map?.ascii[y]?.[x];return Boolean(ch)&&!['#','~'].includes(ch)&&!['wall','water'].includes(seed.legend[ch]?.[0]);}
function ready(){return snapshot&&snapshot.player.hp>0&&!pending&&!window.GulchMovementState?.inFlight;}
function submit(data,note){pending={base:snapshot.stateRevision};status.textContent='Waiting for the room…';Gulch.commit(data,note);render();}
function setup(){
 if(!ready()||quest())return;
 const s=snapshot,p=s.player,map=s.seed.maps.find(m=>m.id===p.map);if(!map)return;
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length&&queue.length<20000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(!seen.has(k)&&floor(s.seed,map,x,y)){seen.add(k);queue.push({x,y});}}
 const available=queue.filter(q=>Math.hypot(q.x-p.x,q.y-p.y)>=3&&!map.exits?.some(e=>e.x===q.x&&e.y===q.y)&&map.ascii[q.y][q.x]!=='>'&&!s.seed.entities.some(e=>e.map===p.map&&e.x===q.x&&e.y===q.y));
 if(available.length<5){status.textContent='Find a larger open area to begin the sword quest.';return;}
 const chosen=[];
 for(let i=0;i<5;i++){
  let best=null,score=-1;
  for(const q of available){if(chosen.some(v=>v.x===q.x&&v.y===q.y))continue;const distance=Math.min(...[{x:p.x,y:p.y},...chosen].map(v=>Math.hypot(v.x-q.x,v.y-q.y)));if(distance>score){score=distance;best=q;}}
  chosen.push(best);
 }
 const occupied=new Set(s.seed.entities.map(e=>e.id));
 const definitions=[...PARTS.map(([key,name])=>({key,name,glyph:'✦',color:'#ffe4a5',kind:'quest-relic'})),{key:'cathedral',name:'Cathedral of First Light',glyph:'♜',color:'#eadaca',kind:'quest-cathedral'},{key:'stone',name:'Stone of Truth',glyph:'◈',color:'#9de9e6',kind:'quest-stone'}];
 const sites=definitions.map((d,i)=>{let id='legendary-sword-'+d.key;while(occupied.has(id))id+='-1';occupied.add(id);return {...d,id,...chosen[i],map:p.map};});
 const entities=sites.map(v=>({id:v.id,name:v.name,map:v.map,x:v.x,y:v.y,glyph:v.glyph,color:v.color,kind:v.kind,swordQuestLandmark:v.key,dialogue:v.key==='cathedral'?'The altar awaits the three pieces of First Light.':v.key==='stone'?'Bring the reforged sword here to complete your pilgrimage.':'A piece of the legendary sword rests here. Use the main quest interaction to recover it.'}));
 submit({...s.gameState,seed:{...s.seed,entities:[...s.seed.entities,...entities]},[KEY]:{epoch:epoch(s),map:p.map,sites,pieces:[],forged:false,complete:false}},'Main quest discovered: recover the three pieces of First Light, forge them at the cathedral, and seek the Stone of Truth.');
}
function nearby(){const q=quest();if(!q)return null;const p=snapshot.player,map=snapshot.seed.maps.find(m=>m.id===p.map);return q.sites.find(site=>site.map===p.map&&Math.abs(site.x-p.x)+Math.abs(site.y-p.y)<=1&&floor(snapshot.seed,map,p.x,p.y)&&(!PARTS.some(([key])=>key===site.key)||!q.pieces.includes(site.key)))||null;}
function itemPack(p){const raw=p.inventory??snapshot.gameState.inventory??snapshot.seed.inventory??[];if(Array.isArray(raw))return [...raw];if(raw&&typeof raw==='object'){if(Array.isArray(raw.items))return {...raw,items:[...raw.items]};return {...raw};}return [];}
function addSword(p){
 const sword={id:'legendary-sword-first-light',name:'Sword of First Light',category:'Weapon',kind:'weapon',glyph:'⚔',quantity:1,damage:2,description:'The legendary sword, reforged at the cathedral from the Dawnsteel Blade, Sunfire Guard and Oathbound Hilt. Carry it to the Stone of Truth.'};
 const pack=itemPack(p);let inventory;
 if(Array.isArray(pack))inventory=[...pack,sword];else if(Array.isArray(pack.items))inventory={...pack,items:[...pack.items,sword]};else if(pack.items&&typeof pack.items==='object')inventory={...pack,items:{...pack.items,[sword.id]:sword}};else inventory={...pack,[sword.id]:sword};
 return {...p,inventory};
}
function use(){
 if(!ready()||!window.GulchMovementState?.focused||!board.hidden)return;
 if(['inventoryPanel','characterPanel','workBoard'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;}))return;
 const q=quest(),site=nearby();if(!q||!site||q.complete)return;
 let next=q,seed=snapshot.seed,note='';
 if(PARTS.some(([key])=>key===site.key)){
  next={...q,pieces:[...q.pieces,site.key]};seed={...seed,entities:seed.entities.filter(e=>e.id!==site.id)};note='Recovered the '+site.name+' ('+next.pieces.length+'/3 sword pieces).';
 }else if(site.key==='cathedral'){
  if(q.forged){status.textContent='The sword is ready. Take it to the Stone of Truth.';return;}
  if(q.pieces.length<3){status.textContent='The altar requires all three sword pieces.';return;}
  next={...q,forged:true};seed={...seed,entities:seed.entities.map(e=>e.id==='player'?addSword(e):e)};note='At the cathedral altar, the three pieces become the legendary Sword of First Light. Carry it to the Stone of Truth.';
 }else{
  if(!q.forged){status.textContent='The Stone of Truth awaits the reforged sword.';return;}
  next={...q,complete:true,completedTurn:snapshot.turn};note='Main quest complete: the Stone of Truth recognizes the Sword of First Light. Its light reveals that the sword was made to protect, not to rule.';
 }
 submit({...snapshot.gameState,seed,[KEY]:next},note);
}
function render(){
 const q=quest();interact.disabled=!ready();
 if(!q){progress.textContent='Discover the lost sword';hint.textContent='Preparing reachable quest landmarks…';interact.disabled=true;return;}
 progress.textContent=q.complete?'Main quest complete':q.forged?'Bring the sword to the Stone of Truth':q.pieces.length===3?'Reforge the sword at the cathedral':'Recover sword pieces · '+q.pieces.length+'/3';
 const site=nearby();
 interact.textContent=site?(PARTS.some(([key])=>key===site.key)?'Recover '+site.name:site.key==='cathedral'?'Reforge legendary sword':'Present sword to the stone'):'Approach a quest landmark';
 interact.disabled=!ready()||!site||q.complete||(site.key==='cathedral'&&(q.forged||q.pieces.length<3))||(site.key==='stone'&&!q.forged);
 const nextSite=q.complete?null:q.forged?q.sites.find(v=>v.key==='stone'):q.pieces.length===3?q.sites.find(v=>v.key==='cathedral'):q.sites.find(v=>PARTS.some(([key])=>key===v.key)&&!q.pieces.includes(v.key));
 hint.textContent=nextSite?nextSite.name+' · '+nextSite.x+', '+nextSite.y+(snapshot.mapId!==q.map?' · '+(snapshot.seed.maps.find(m=>m.id===q.map)?.name||q.map):''):'The truth has been revealed.';
 if(board.hidden)return;
 objectives.replaceChildren();
 q.sites.forEach(v=>{const done=v.key==='cathedral'?q.forged:v.key==='stone'?q.complete:q.pieces.includes(v.key);const li=el('li',(done?'✓ ':'○ ')+v.name+' — '+v.x+', '+v.y);if(done)li.className='quest-done';objectives.append(li);});
 guidance.textContent='Landmarks are in '+(snapshot.seed.maps.find(m=>m.id===q.map)?.name||q.map)+'. Stand on or directly beside a landmark, close the journal, and use its quest button. Pieces are carried in the shared quest pouch; the completed sword appears in Inventory. Both room members advance the same quest.';
 result.textContent=q.complete?'The stone shines. A voice answers: “Strength is not the right to rule, but the courage to protect.” You have completed the pilgrimage of First Light.':q.forged?'The Sword of First Light is in your shared inventory. The final journey awaits.':'Recover all three pieces before approaching the cathedral altar.';
}
Gulch.register('quest-journal',{snapshot(s){snapshot=s;if(pending&&s.stateRevision!==pending.base){pending=null;status.textContent='';}setup();render();},action(a){if(a?.type==='quest-interact')use();}});
setInterval(()=>{if(document.hidden)return;setup();render();},500);
})();
