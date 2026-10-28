(function(){
'use strict';
const host=document.getElementById('left'),board=document.getElementById('board'),baseCommit=Gulch.commit;
if(!host||!board)return;
const KEY='npcConversations';
let latest=null,npcId=null,pending=null,submitting=false,returnFocus=null,selectedMap='',message='';
const epoch=d=>String(d?.respawnSettings?.token||'original');
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
function state(){const v=latest?.gameState[KEY];return v?.epoch===epoch(latest.gameState)?v:{epoch:epoch(latest?.gameState),people:{},treasures:[],receipt:null};}
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function npc(e){return e&&e.id!=='player'&&e.faction!=='hostile'&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.outsideAnimal&&!e.ecosystemLoot&&!e.itemId&&!e.swordQuestLandmark&&(!Number.isFinite(e.hp)||e.hp>0)&&(e.outsideNPC||e.loreSpeaker||/^(villager|traveler|merchant|guard|npc|storyteller)$/i.test(e.kind||''));}
function visible(e){return npc(e)&&e.map===latest?.mapId&&latest.lit[e.y]?.[e.x]===1;}
const personalities=[
 {name:'Warm-hearted',greeting:'Come closer, traveler. There is always room for another story.',answers:['My grandmother left bread at the old milestones. She said every road should remember kindness.','Our village once shared one lamp through a winter storm. We passed it from window to window.','Trust grows in small acts. Tell me whose road you have made easier today.']},
 {name:'Suspicious',greeting:'Keep your hands where I can see them. Words first, business later.',answers:['The old watchtower fell without a battle. Someone opened its gates from inside.','I count every stranger twice. Once when they arrive, once when the trouble starts.','Promises are easy. Come back when your boots have earned their dust.']},
 {name:'Playful',greeting:'A visitor! Tell me you brought a better joke than the last merchant.',answers:['A fox stole the mayor’s hat. For three days we had the best-dressed fox in the valley.','They say the listening stones repeat secrets. Mine only repeats my terrible singing.','My greatest adventure involved a runaway cart and six very opinionated geese.']},
 {name:'Scholarly',greeting:'Excellent timing. I was just considering the history beneath our feet.',answers:['The road stones predate the villages. Their makers measured distance by the time a song took to sing.','Blue lanterns once marked safe shelters. Amber lanterns marked places where travelers could exchange news.','A ruined arch is a document. Its missing stones often tell us more than those still standing.']},
 {name:'Weary but brave',greeting:'Rest your feet a moment. The road will still be there when we finish.',answers:['I carried messages through the last great frost. The shortest letters were always the hardest to deliver.','We rebuilt the bridge with timber from our own doors. Nobody slept warmly, but everybody crossed.','Fear walks beside me still. I have learned that it need not choose the direction.']}
];
const choices=[['history','“What happened in these lands?”'],['home','“Tell me about yourself.”'],['hope','“What keeps you going?”']];
const style=el('style');style.textContent=`
#npcTalkDialog{width:min(620px,calc(100% - 20px));max-height:90vh;overflow:auto;padding:20px;background:#14272b;color:#e6e7d4;border:3px double #bba174;border-radius:8px;font:13px/1.65 monospace}#npcTalkDialog::backdrop{background:#030c1088}#npcTalkDialog h2{margin:0;color:#ffe1a2;font:24px Georgia,serif}#npcTalkDialog h3{color:#ecd39b;font-size:14px}#npcTalkDialog button,#npcTalkDialog select{min-height:42px;padding:9px;background:#294239;color:#f5e6bc;border:1px solid #8ca080;border-radius:4px;font:inherit;max-width:100%}#npcTalkDialog button:disabled{opacity:.5}#npcTalkDialog :focus-visible{outline:2px solid #ffe1a2;outline-offset:3px}#npcTalkChoices{display:grid;gap:7px}#npcTalkLine{padding:14px;border-left:3px solid #bda174;background:#0b1d23;white-space:pre-wrap}#npcTreasureChart{width:100%;height:auto;max-height:300px;object-fit:contain;background:#cab184;image-rendering:pixelated;border:3px double #8b693e}#npcTreasureMaps{width:100%}#npcTalkStatus{color:#f5d796;min-height:22px}#npcTreasureToggle{position:absolute;left:66px;top:198px;z-index:5;min-height:44px;padding:7px;background:#17262ae8;color:#f1d69d;border:1px solid #a89161;border-radius:6px;font:11px monospace}@media(max-width:700px){#npcTreasureToggle{left:58px;top:190px}#npcTalkDialog{padding:14px}}
`;document.head.append(style);
const dialog=el('dialog');dialog.id='npcTalkDialog';dialog.setAttribute('aria-labelledby','npcTalkTitle');
const title=el('h2');title.id='npcTalkTitle';const persona=el('p'),line=el('p');line.id='npcTalkLine';
const responseBox=el('div');responseBox.id='npcTalkChoices';
const status=el('p');status.id='npcTalkStatus';status.setAttribute('role','status');
const maps=el('section');maps.append(el('h3','Revealed treasure maps'));
const select=el('select');select.id='npcTreasureMaps';select.setAttribute('aria-label','Revealed treasure location');
const canvas=el('canvas');canvas.id='npcTreasureChart';canvas.setAttribute('role','img');
const directions=el('p'),recover=button('Recover marked treasure',dig);
const close=button('Return to the road',()=>dialog.close());
maps.append(select,canvas,directions,recover);dialog.append(title,persona,line,responseBox,status,maps,close);document.body.append(dialog);
const toggle=button('Treasure maps',()=>open(null));toggle.id='npcTreasureToggle';toggle.setAttribute('aria-haspopup','dialog');host.append(toggle);
for(const [key,label] of choices)responseBox.append(button(label,()=>speak(key)));
function busy(){return !latest||latest.player.hp<=0||latest.gameState.gulchPermanentGameOver?.ended||pending||window.GulchMovementState?.inFlight||!window.GulchMovementState?.focused;}
function blocked(){return ['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;})||Array.from(document.querySelectorAll('dialog[open]')).some(n=>n!==dialog);}
function personality(e){return personalities[hash(e.id)%personalities.length];}
function open(e){
 if(!latest||latest.player.hp<=0||blocked())return;
 returnFocus=document.activeElement;npcId=e?.id||null;message='';
 render();if(!dialog.open)dialog.showModal();close.focus({preventScroll:true});
}
dialog.addEventListener('close',()=>{npcId=null;const target=returnFocus?.isConnected&&!returnFocus.closest('[hidden],[inert]')?returnFocus:toggle;target.focus({preventScroll:true});});
dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});
Gulch.commit=function(data,activity){if(dialog.open&&!submitting)return;return baseCommit(data,activity);};
window.addEventListener('keydown',e=>{
 if(!dialog.open)return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dialog.close();return;}
 if(e.key!=='Tab')e.stopImmediatePropagation();
},true);
function walk(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y);}
function treasureSite(e,v){
 const seed=latest.seed,map=seed.maps.find(m=>m.id===e.map),p=latest.player;
 if(!map)return null;
 const occupied=new Set(seed.entities.filter(n=>n.map===map.id&&n.id!=='player').map(n=>n.x+','+n.y));
 const danger=[...(map.groundHazards?.cells||[]),...(map.dynamicRegion?.sites||[])];
 const reserved=[...(map.landmarks||[]),...(latest.gameState.legendarySwordQuest?.sites||[]).filter(s=>s.map===map.id),...(latest.gameState.wayfarerPilgrimage?.sites||[]).filter(s=>s.map===map.id),...v.treasures.filter(s=>s.map===map.id)];
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]),candidates=[];
 for(let i=0;i<queue.length&&i<16000;i++){
  const q=queue[i];
  if(Math.hypot(q.x-p.x,q.y-p.y)>=6&&!occupied.has(q.x+','+q.y)&&danger.every(s=>Math.hypot(q.x-s.x,q.y-s.y)>2)&&reserved.every(s=>Math.hypot(q.x-s.x,q.y-s.y)>2))candidates.push(q);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=q.x+dx,y=q.y+dy,k=x+','+y;if(!seen.has(k)&&walk(seed,map,x,y)&&!occupied.has(k)){seen.add(k);queue.push({x,y});}}
 }
 return candidates.length?candidates[Math.floor(Math.random()*candidates.length)]:null;
}
function submit(next,text){
 const token=String(latest.stateRevision)+':'+Date.now().toString(36)+':'+Math.random().toString(36).slice(2);
 next[KEY]={...next[KEY],receipt:token};
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000){message='The shared world is full. Nothing was submitted.';render();return;}
 pending={base:latest.stateRevision,token,epoch:epoch(next),text};submitting=true;
 try{Gulch.commit(next,text);}catch(error){pending=null;message=String(error.message||error);}finally{submitting=false;}
 if(pending&&!window.GulchMovementState?.inFlight){pending=null;message='The room is updating. Please try again.';}
 render();
}
function speak(topic){
 if(busy())return;
 const e=latest.seed.entities.find(n=>n.id===npcId);if(!visible(e))return;
 const v=state(),old=v.people[e.id]||{},person=personality(e),index=choices.findIndex(c=>c[0]===topic);
 if(index<0)return;
 let reply=person.answers[(index+Math.floor(Math.random()*person.answers.length))%person.answers.length];
 if(topic==='home'&&e.villageResident?.thought)reply+=' '+e.villageResident.thought;
 const treasures=v.treasures.slice();let seed=latest.seed;
 if(!old.revealed&&treasures.length<16&&Math.random()<.2){
  const spot=treasureSite(e,v);
  if(spot){
   const id='npc-treasure:'+String(latest.stateRevision)+':'+hash(e.id),map=seed.maps.find(m=>m.id===e.map);
   treasures.push({id,npc:e.id,speaker:String(e.name||'Traveler'),map:e.map,mapName:map.name||map.id,x:spot.x,y:spot.y,claimed:false});
   reply+=' I trust you with this: I hid a coffer at '+spot.x+', '+spot.y+'. Take this map. What you find is yours.';
   // The frontier already retains destinations referenced by exits. This harmless
   // self exit pins the treasure region without changing any existing exit.
   const anchor=[spot,{x:latest.player.x,y:latest.player.y}].find(q=>!map.exits?.some(a=>a.x===q.x&&a.y===q.y));
   if(anchor)seed={...seed,maps:seed.maps.map(m=>m.id===map.id?{...m,exits:[...(m.exits||[]),{x:anchor.x,y:anchor.y,to:m.id,at:{x:anchor.x,y:anchor.y},npcTreasureAnchor:true}]}:m)};
   selectedMap=id;
  }else reply+=' I remember a hidden coffer, but I cannot mark a safe location from here. Ask me again after we reach more open ground.';
 }
 const revealed=old.revealed||treasures.some(t=>t.npc===e.id);
 let people={...v.people,[e.id]:{reply,topic,revealed,visits:Math.min(999,(Number(old.visits)||0)+1)}};
 const keys=Object.keys(people);if(keys.length>64){const removable=keys.find(k=>k!==e.id&&!people[k].revealed);if(removable)delete people[removable];}
 submit({...latest.gameState,seed,[KEY]:{...v,people,treasures}},String(e.name||'Traveler')+': '+reply);
}
function dig(){
 if(busy())return;
 const v=state(),t=v.treasures.find(t=>t.id===select.value),p=latest.player;
 if(!t||t.claimed||p.map!==t.map||Math.abs(p.x-t.x)+Math.abs(p.y-t.y)>1)return;
 const map=latest.seed.maps.find(m=>m.id===t.map);if(!walk(latest.seed,map,p.x,p.y)&&!(p.x===t.x&&p.y===t.y))return;
 const old=latest.gameState.itemEcosystem,pack=old?.epoch===epoch(latest.gameState)?old:{epoch:epoch(latest.gameState),bag:{},equipment:{},known:[],crafted:[],log:[]};
 const rewards={image_gold_bar:2,image_ruby:1,image_red_potion:2,relic:1},bag={...pack.bag};
 for(const [id,n] of Object.entries(rewards)){const current=Number.isFinite(bag[id])?Math.max(0,Math.floor(bag[id])):0;if(current+n>999){message='Make room in your pack for the treasure first (999 per item).';render();return;}bag[id]=current+n;}
 const text='Recovered '+t.speaker+'’s treasure: 2 gold ingots, 1 ruby, 2 crimson potions and 1 data shard.';
 submit({...latest.gameState,itemEcosystem:{...pack,bag,known:Array.from(new Set([...(pack.known||[]),...Object.keys(rewards)])),log:[text,...(pack.log||[])].slice(0,12)},[KEY]:{...v,treasures:v.treasures.map(a=>a.id===t.id?{...a,claimed:true}:a)}},text);
}
function drawMap(t){
 const map=latest.seed.maps.find(m=>m.id===t.map);if(!map){directions.textContent='This region is no longer available.';return;}
 const w=Math.max(1,...map.ascii.map(r=>r.length)),h=map.ascii.length,u=Math.max(1,Math.min(8,Math.floor(700/w))),pad=18;
 canvas.width=w*u+pad*2;canvas.height=h*u+pad*2;
 const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#c9b181';c.fillRect(0,0,canvas.width,canvas.height);
 map.ascii.forEach((row,y)=>Array.from(row).forEach((ch,x)=>{const kind=latest.seed.legend[ch]?.[0];c.fillStyle=kind==='wall'||ch==='#'?'#666552':kind==='water'||ch==='~'?'#638e97':'#aaa773';c.fillRect(pad+x*u,pad+y*u,u,u);}));
 const x=pad+(t.x+.5)*u,y=pad+(t.y+.5)*u;c.strokeStyle=t.claimed?'#436b43':'#a93029';c.lineWidth=3;c.beginPath();c.moveTo(x-6,y-6);c.lineTo(x+6,y+6);c.moveTo(x+6,y-6);c.lineTo(x-6,y+6);c.stroke();
 const p=latest.player;if(p.map===t.map){c.fillStyle='#fff3cb';c.fillRect(pad+p.x*u-2,pad+p.y*u-2,Math.max(5,u+2),Math.max(5,u+2));c.fillStyle='#263f69';c.fillRect(pad+p.x*u,pad+p.y*u,Math.max(3,u-1),Math.max(3,u-1));}
 c.fillStyle='#392d22';c.font='12px monospace';c.fillText('N ↑',6,13);
 directions.textContent=t.mapName+' · X: '+t.x+', '+t.y+' · '+(t.claimed?'Recovered.':'Stand on or directly beside X, then recover the treasure.')+' Blue square: you. The NPC’s chart reveals this region’s terrain.'+(p.map!==t.map?' You are currently in another region.':'');
 canvas.setAttribute('aria-label',directions.textContent);
}
function render(){
 if(!latest)return;
 const v=state(),e=latest.seed.entities.find(n=>n.id===npcId);
 title.textContent=e?String(e.name||'Traveler'):'Your treasure maps';
 persona.textContent=e?personality(e).name+' · '+(v.people[e.id]?.revealed?'Already shared a treasure location.':'Each reply has a 20% chance to reveal treasure; one location per NPC, up to 16 per expedition.'):'Maps and recovered treasures are shared by both room members.';
 line.hidden=!e;line.textContent=e?(v.people[e.id]?.reply||personality(e).greeting):'';
 responseBox.hidden=!e;Array.from(responseBox.children).forEach(b=>{b.disabled=busy()||!visible(e);});
 status.textContent=pending?'Waiting for the room to confirm…':message;
 maps.hidden=!v.treasures.length;
 select.replaceChildren(...v.treasures.map(t=>{const o=el('option',t.speaker+' · '+t.mapName+(t.claimed?' · recovered':''));o.value=t.id;return o;}));
 if(v.treasures.some(t=>t.id===selectedMap))select.value=selectedMap;else selectedMap=select.value;
 const t=v.treasures.find(t=>t.id===select.value);
 if(t){drawMap(t);const p=latest.player;recover.disabled=busy()||t.claimed||p.map!==t.map||Math.abs(p.x-t.x)+Math.abs(p.y-t.y)>1;recover.textContent=t.claimed?'Treasure recovered':'Recover marked treasure';}
 else if(!e)message=status.textContent='No treasure maps yet. Right-click a visible villager or traveler and choose what to say.';
 toggle.disabled=latest.player.hp<=0;
}
select.addEventListener('change',()=>{selectedMap=select.value;render();});
window.addEventListener('contextmenu',event=>{
 if(event.target!==board||!latest||blocked()||dialog.open)return;
 const r=board.getBoundingClientRect(),p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const x=Math.round(camera.x+(event.clientX-r.left-r.width/2)/ts),y=Math.round(camera.y+(event.clientY-r.top-r.height/2)/ts);
 const e=latest.seed.entities.find(e=>visible(e)&&e.x===x&&e.y===y);if(!e)return;
 event.preventDefault();event.stopImmediatePropagation();open(e);
},true);
Gulch.register('npc-personality-conversations',{snapshot(s){
 const reset=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;
 if(reset){pending=null;selectedMap='';message='';if(dialog.open)dialog.close();}
 if(pending&&pending.base!==s.stateRevision){const request=pending;pending=null;message=state().receipt===request.token&&epoch(s.gameState)===request.epoch?request.text:'Another room update won. No conversation or treasure reward was confirmed; try again.';}
 if(s.player.hp<=0&&dialog.open)dialog.close();
 if(npcId&&!visible(s.seed.entities.find(e=>e.id===npcId))){npcId=null;message='The speaker is no longer in sight. Your confirmed maps remain available.';}
 if(dialog.open)render();else toggle.disabled=s.player.hp<=0;
}});
const help=document.getElementById('keyHelp');if(help)help.append(el('p','Right-click a visible NPC to talk. Choose a response for personality-based lore and a 20% treasure-map chance. Open Treasure maps later and stand beside the marked X to recover its contents. Conversation and recovery do not advance turns.'));
})();
