(function(){
'use strict';
const {KEY,seasons,number,epoch,state,log,floor,spots,supplies,withSupplies,evolve}=globalThis.GulchLivingWorldEffects;
const host=document.getElementById('left');
if(!host)return;
const baseCommit=Gulch.commit;
let snapshot=null,pending=null,lastEpoch=null;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
Gulch.commit=function(data,activity){
 return baseCommit(globalThis.GulchLivingWorldEffects.apply(snapshot?.gameState,data),activity);
};
const style=el('style');style.textContent=`
#livingToggle{position:absolute;right:14px;top:148px;z-index:5;min-height:40px;padding:9px 12px;background:#19332e;color:#f0d8a5;border:1px solid #819777;border-radius:7px;font:11px monospace}
#livingPanel[hidden]{display:none}#livingPanel{position:absolute;inset:14px;z-index:30;background:#0b2023fc;border:1px solid #9aab7e;border-radius:12px;overflow:auto;padding:22px;color:#dae8d3;font:13px/1.7 monospace;box-shadow:0 16px 70px #000b}
#livingPanel header{display:flex;justify-content:space-between;align-items:center;gap:12px}#livingPanel h2{margin:0;color:#f1d39b;font-size:20px}#livingPanel h3{color:#c6dcab;font-size:14px}#livingPanel button{min-height:44px;padding:9px 12px;background:#233e34;color:#f4e2b7;border:1px solid #829777;border-radius:6px;font:inherit}#livingPanel button:disabled{opacity:.45;cursor:default}#livingPanel :focus-visible,#livingToggle:focus-visible{outline:2px solid #f1d39b;outline-offset:3px}.living-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin:14px 0}#livingPanel li{margin:10px 0;padding-bottom:10px;border-bottom:1px solid #416252}#livingPanel p{max-width:850px}#livingStatus{min-height:24px;color:#f1d39b}@media(max-width:700px){#livingToggle{top:166px;right:10px}#livingPanel{inset:8px;padding:14px}}
`;document.head.append(style);
const toggle=el('button','Living world');toggle.id='livingToggle';toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','livingPanel');
// Use the existing modal identifier so every gameplay component respects this panel.
const panel=el('section');panel.id='livingPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','livingTitle');
const head=el('header'),title=el('h2','THE LIVING WORLD'),close=el('button','Return to expedition');title.id='livingTitle';close.type='button';head.append(title,close);
const overview=el('p'),plan=el('p'),stock=el('p'),actions=el('div');actions.className='living-actions';
const status=el('p');status.id='livingStatus';status.setAttribute('role','status');const journal=el('ol');
panel.append(head,overview,plan,stock,el('h3','Camp & craftsmanship'),actions,status,el('h3','Expedition chronicle'),journal,el('p','The world evolves every 12 played turns; seasons change every 24. Waiting in menus does not advance time. Supply and creature populations are capped. Both room members share these upgrades, discoveries and decisions. New hardcore expeditions reset this progression.'));
host.append(toggle,panel);
let previousFocus=null,locks=[];
function show(){
 if(!snapshot||snapshot.player.hp<=0)return;
 if(['inventoryPanel','characterPanel','questBoard','workBoard','respawnScreen'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;}))return;
 previousFocus=document.activeElement;panel.hidden=false;toggle.setAttribute('aria-expanded','true');
 locks=Array.from(host.children).filter(n=>n!==panel).map(n=>({n,inert:n.inert}));locks.forEach(v=>{v.n.inert=true;});
 render();close.focus();
}
function hide(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');locks.forEach(v=>{if(v.n.isConnected)v.n.inert=v.inert;});locks=[];(previousFocus?.isConnected?previousFocus:toggle).focus();}
toggle.addEventListener('click',show);close.addEventListener('click',hide);
function modalElsewhere(){return ['inventoryPanel','characterPanel','questBoard','workBoard','respawnScreen'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function nearResource(){if(!snapshot)return null;const p=snapshot.player;return snapshot.seed.entities.find(e=>e.livingResource&&e.map===p.map&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1);}
function danger(){return snapshot.seed.entities.some(e=>e.map===snapshot.mapId&&e.faction==='hostile'&&e.hp>0&&Math.hypot(e.x-snapshot.player.x,e.y-snapshot.player.y)<=5);}
function ready(){return snapshot&&snapshot.player.hp>0&&!pending&&!window.GulchMovementState?.inFlight&&window.GulchMovementState?.focused&&!modalElsewhere();}
function act(kind){
 if(!ready())return;
 const data=snapshot.gameState,p=snapshot.player;
 let v=state(data),r=supplies(data),seed=data.seed,note='';
 const cost=kind==='forge'?{iron:2+v.forge*2,crystal:1+v.forge}:kind==='camp'?{wood:3+v.camp*2,stone:2}:kind==='rest'?{wood:2}:{};
 if(Object.entries(cost).some(([k,n])=>r[k]<n)){status.textContent='Gather the required resources first.';return;}
 if(kind==='gather'){
  const e=nearResource();if(!e)return;
  if(e.livingResource==='herb')v={...v,herbs:Math.min(99,v.herbs+number(e.quantity,9))};
  else r={...r,[e.livingResource]:Math.min(9999,(r[e.livingResource]||0)+number(e.quantity,9))};
  seed={...seed,entities:seed.entities.filter(n=>n.id!==e.id)};note='Gathered '+e.name+'.';
 }else if(kind==='forge'){
  if(v.forge>=3||danger())return;v={...v,forge:v.forge+1};note='Blade improved to tier '+v.forge+'. Sword and bump attacks gain '+v.forge+' bonus damage.';
 }else if(kind==='camp'){
  if(v.camp>=2||danger())return;v={...v,camp:v.camp+1};note='Camp kit improved to tier '+v.camp+'. Rest now restores '+(4+v.camp*3)+' HP.';
 }else if(kind==='rest'||kind==='heal'){
  if(!Number.isFinite(p.maxHp)||p.hp>=p.maxHp)return;
  if(kind==='rest'&&danger())return;
  if(kind==='heal'&&!v.herbs)return;
  if(kind==='heal')v={...v,herbs:v.herbs-1};
  const amount=kind==='heal'?6:4+v.camp*3;
  seed={...seed,entities:seed.entities.map(e=>e.id==='player'?{...e,hp:Math.min(e.maxHp,e.hp+amount)}:e)};
  note=kind==='heal'?'Used a healing herb.':'Rested beside a temporary campfire.';
 }else return;
 r=Object.fromEntries(Object.entries(r).map(([k,n])=>[k,n-(cost[k]||0)]));
 v=log(v,note);
 // Recovery and gathering consume a turn; nearby creatures can retaliate.
 if(window.GulchCaveEnemies)seed=window.GulchCaveEnemies.advance(seed);
 const next=withSupplies({...data,seed,turn:(Number(data.turn)||0)+1,[KEY]:v},r);
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000){status.textContent='The shared world is too large for another update.';return;}
 pending={base:snapshot.stateRevision};status.textContent='Waiting for the shared world…';Gulch.commit(next,note);render();
}
const buttons={};
[['gather','Gather adjacent supplies'],['heal','Use herb · heal 6 HP'],['rest','Rest · 2 wood'],['forge','Improve blade'],['camp','Improve camp kit']].forEach(([key,text])=>{const b=el('button',text);b.type='button';b.addEventListener('click',()=>act(key));actions.append(b);buttons[key]=b;});
function render(){
 if(!snapshot||panel.hidden)return;
 const v=state(snapshot.gameState),r=supplies(snapshot.gameState),season=seasons[Math.floor(v.age/24)%4],unsafe=danger(),e=nearResource();
 overview.textContent=season.name+' · expedition age '+v.age+' turns · '+v.visits.length+' charted regions · blade tier '+v.forge+' · camp tier '+v.camp+'. '+season.description;
 plan.textContent='Next automatic improvement in '+(12-v.age%12)+' turns: renew reachable seasonal supplies'+((v.wave+1)%2===0?' and introduce a tougher wanderer if the region has room.':'.')+' Next season in '+(24-v.age%24)+' turns. '+(unsafe?'Hostiles are nearby: move at least six tiles away before resting or crafting.':'This area is clear enough to rest and craft.');
 stock.textContent='Shared supplies: '+Object.entries(r).map(([k,n])=>k+' '+n).join(' · ')+' · herbs '+v.herbs;
 const disabled=!ready();
 buttons.gather.textContent=e?'Gather '+e.name:'Stand beside a new supply patch';buttons.gather.disabled=disabled||!e;
 buttons.heal.disabled=disabled||!v.herbs||snapshot.player.hp>=snapshot.player.maxHp;
 buttons.rest.textContent='Rest · 2 wood · heal '+(4+v.camp*3)+' HP';buttons.rest.disabled=disabled||unsafe||r.wood<2||snapshot.player.hp>=snapshot.player.maxHp;
 buttons.forge.textContent=v.forge>=3?'Blade fully improved':'Blade tier '+(v.forge+1)+' · '+(2+v.forge*2)+' iron + '+(1+v.forge)+' crystal';buttons.forge.disabled=disabled||unsafe||v.forge>=3||r.iron<2+v.forge*2||r.crystal<1+v.forge;
 buttons.camp.textContent=v.camp>=2?'Camp kit complete':'Camp tier '+(v.camp+1)+' · '+(3+v.camp*2)+' wood + 2 stone';buttons.camp.disabled=disabled||unsafe||v.camp>=2||r.wood<3+v.camp*2||r.stone<2;
 journal.replaceChildren(...v.log.map(entry=>el('li','Turn '+entry.age+' · '+entry.text)));
 if(!v.log.length)journal.append(el('li','Explore four distinct 4×4 regions to earn your first herbs. Play twelve turns to awaken the seasonal supply cycle.'));
}
// Capture menu input before runtime movement handlers and suppress incoming actions while open.
window.addEventListener('keydown',event=>{
 if(panel.hidden)return;
 event.stopImmediatePropagation();
 if(event.key==='Escape'){event.preventDefault();hide();return;}
 if(event.key==='Tab'){
  const controls=Array.from(panel.querySelectorAll('button')).filter(n=>!n.disabled),first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
 }
},true);
window.addEventListener('message',event=>{if(!panel.hidden&&event.source===parent&&event.data?.type==='gulch:action')event.stopImmediatePropagation();},true);
// A focused hidden input clears held movement through the existing focus protocol.
const focusSink=el('input');focusSink.type='text';focusSink.tabIndex=-1;focusSink.setAttribute('aria-label','World menu focus');focusSink.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';panel.append(focusSink);
toggle.addEventListener('click',()=>{if(!panel.hidden){focusSink.focus();close.focus();}});
Gulch.register('living-world',{snapshot(s){
 snapshot=s;
 if(pending&&pending.base!==s.stateRevision){pending=null;status.textContent='Room updated. Review the chronicle and supplies to confirm your action.';}
 const currentEpoch=epoch(s.gameState);
 if(lastEpoch!==null&&lastEpoch!==currentEpoch){pending=null;if(!panel.hidden)hide();}
 lastEpoch=currentEpoch;
 if(s.player.hp<=0&&!panel.hidden){hide();const death=document.getElementById('respawnScreen');if(death&&!death.hidden){Array.from(host.children).filter(n=>n!==death).forEach(n=>{n.inert=true;});death.focus();}}
 toggle.disabled=s.player.hp<=0;render();
}});
setInterval(()=>{if(!document.hidden&&!panel.hidden)render();},300);
})();
