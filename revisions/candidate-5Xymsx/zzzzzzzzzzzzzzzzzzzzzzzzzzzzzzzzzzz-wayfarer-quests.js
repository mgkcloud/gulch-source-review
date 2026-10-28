(function(){
'use strict';
const KEY='wayfarerPilgrimage',host=document.getElementById('left');
if(!host)return;
let latest=null,pending=null,attempt=null,selected=0,notice='',previousFocus=null;
const stages=[
 {name:'A Light Left Behind',place:'The Fallen Beacon',subtitle:'Follow the abandoned road',item:'fiber',amount:3,task:'Bind a new wick at the fallen beacon.',lore:'Long before the frontier roads broke apart, keepers left a light for every traveler. The last keeper, Mira, extinguished her own hearth to keep this beacon burning through a winter without dawn.',discovery:'A brass plate reads: “No traveler should have to earn a light.” The wick has crumbled. Three bundles of tough fiber could bind a replacement.',completion:'The wick catches. Beneath the soot you uncover Mira’s route: a bridge, a listening stone, and a tower facing the morning.',source:'Collect creature remains for tough fiber. A recovered ranger cloak, hunting bow, satchel or ancient parchment can also be salvaged through the recipe book.'},
 {name:'The Bridge of Small Promises',place:'The Broken Crossing',subtitle:'Restore the keeper’s resting place',item:'$wood',amount:3,task:'Use three wood to repair the crossing’s shelter.',lore:'Mira counted journeys by the people who returned, never the miles they walked. Here she built a small shelter for those who could not finish the road before nightfall.',discovery:'The crossing itself is safe, but its shelter has fallen. Beside it, a child’s carved bird lies beneath three broken roof beams.',completion:'You raise the shelter’s frame and set the little bird above its door. A message beneath the old beams points toward a stone that remembers the sound of storms.',source:'Gather fallen wood from outdoor deposits or seasonal supply patches. Wood is spent from the shared outdoor resource pack.'},
 {name:'What the Storm Remembers',place:'The Listening Stone',subtitle:'Wake the stone’s forgotten voice',item:'spark',amount:2,task:'Offer two charged motes to the listening stone.',lore:'The keepers learned to catch the last note of a thunderstorm inside hollow stones. Their messages crossed the valley after the roads became impassable.',discovery:'Two empty sockets face one another across a narrow seam. A faint inscription asks for “two sparks, held together without either swallowing the other.”',completion:'The stone sings in two voices. Mira’s final message was never a plea for rescue: she asked that someone carry a light to the watchtower for those still finding their way home.',source:'Wisps and Storm lanterns can leave charged motes in their remains. Collect the cache. You can also separate an azure crystal cluster or decode a weathered data shard in the recipe book.'},
 {name:'A Dawn for Those Who Follow',place:'The Dawnward Watch',subtitle:'Complete the keeper’s unfinished journey',item:'lens',amount:1,task:'Install one prismatic lens in the watchtower lamp.',lore:'The tower was built to watch for enemies. Mira turned its lamp toward the roads instead. Her last entry contains no prophecy, only a list of names with space for more.',discovery:'The lamp’s cradle is intact. A polished lens would gather the small flame into a signal visible far beyond this ridge.',completion:'Light runs along the old road. Nothing commands the valley to change; there is simply a place to look toward when the path grows dark. You add your name beneath Mira’s, leaving room for the next traveler.',source:'Craft a prismatic lens from two outdoor crystals and one desert glass; glass needs two stone and one crystal. Alternatively, polish an emerald lens using a verdant emerald and a silver ingot.'}
];
const epoch=d=>String(d.respawnSettings?.token||'original');
const count=n=>Number.isFinite(n)?Math.max(0,Math.min(999,Math.floor(n))):0;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;}
function button(text,fn){const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;}
function quest(){const q=latest?.gameState[KEY];return q?.epoch===epoch(latest.gameState)?q:null;}
function pack(){const p=latest?.gameState.itemEcosystem;return p?.epoch===epoch(latest.gameState)?p:{epoch:latest?epoch(latest.gameState):'original',bag:{},equipment:{},known:[],crafted:[],log:[]};}
function available(id){if(id.startsWith('$'))return count(latest?.gameState.outsideWorld?.resources?.[id.slice(1)]);const p=pack();return Math.max(0,count(p.bag?.[id])-Object.values(p.equipment||{}).filter(v=>v===id).length);}
function itemName(id){return id.startsWith('$')?id.slice(1):window.GulchItemCatalog?.items[id]?.name||id;}
function walk(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function blocked(){return ['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu','travelMapPanel'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function ready(){const m=window.GulchMovementState;return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending&&!blocked();}
function closeEnough(site){return site&&latest.player.map===site.map&&Math.abs(latest.player.x-site.x)+Math.abs(latest.player.y-site.y)<=1;}
function safeSize(data){return new TextEncoder().encode(JSON.stringify(data)).length<350000;}
const style=el('style');style.textContent=`
#pilgrimToggle{position:absolute;left:12px;top:244px;z-index:5;min-height:40px;padding:8px 12px;background:#10272bea;color:#eee0b6;border:1px solid #9b9b72;border-radius:5px;font:11px monospace}
#pilgrimJournal[hidden]{display:none!important}
#pilgrimJournal{position:absolute;right:12px;top:58px;bottom:16px;z-index:94;width:min(760px,calc(100% - 24px));overflow:auto;background:#102329f7;color:#e3e9dc;border:1px solid #9aa78b;border-radius:8px;box-shadow:0 14px 50px #0009;font:12px/1.65 ui-monospace,monospace}
#pilgrimJournal header{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:18px;background:#193438;border-bottom:1px solid #54746b}
#pilgrimJournal h2{font:24px Georgia,serif;margin:0;color:#f1dda6}#pilgrimJournal h3{font:20px Georgia,serif;color:#f0dca7;margin:10px 0}
#pilgrimJournal small{color:#b4c9b9;letter-spacing:1px}#pilgrimJournal button{min-height:40px;background:#203d39;color:#f0dfb6;border:1px solid #718f78;border-radius:4px;padding:8px 11px;font:inherit}
#pilgrimJournal button:disabled{opacity:.5;cursor:default}#pilgrimJournal :focus-visible,#pilgrimToggle:focus-visible{outline:2px solid #ffe0a0;outline-offset:3px}
.pilgrim-body{padding:16px}.pilgrim-intro{color:#c3d4c8}.pilgrim-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:14px 0}
#pilgrimJournal .pilgrim-tabs button{text-align:left}#pilgrimJournal button[aria-pressed=true]{border-color:#e3ce91;background:#354c3e}
.pilgrim-chapter{border-left:3px solid #c9b67b;padding-left:14px}.pilgrim-lore{font-family:Georgia,serif;font-size:16px;line-height:1.7;color:#cad6c7}
.pilgrim-requirement{padding:12px;border:1px solid #607c68;background:#0a1d22}.pilgrim-requirement strong{color:#f2d69b}.pilgrim-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
#pilgrimQuestMap{display:block;width:100%;height:auto;max-height:330px;object-fit:contain;background:#27352e;border:3px double #87916a;image-rendering:pixelated}
#pilgrimMapText{color:#c8d7be;font-size:11px}#pilgrimStatus{min-height:22px;color:#f1d79b}#pilgrimJournal details{border-top:1px solid #4d695e;padding-top:10px;margin-top:12px}#pilgrimJournal summary{cursor:pointer;color:#ead39b}#pilgrimJournal li{margin:9px 0}
@media(max-width:700px){#pilgrimToggle{left:8px;top:236px}#pilgrimJournal{inset:8px;width:auto}#pilgrimJournal header{padding:12px}#pilgrimJournal h2{font-size:20px}.pilgrim-body{padding:12px}}
@media(max-height:500px){#pilgrimToggle{top:auto;bottom:8px;left:50%;transform:translateX(-50%)}}
`;document.head.append(style);
const toggle=button('Quest journal',()=>show(panel.hidden));toggle.id='pilgrimToggle';toggle.setAttribute('aria-controls','pilgrimJournal');toggle.setAttribute('aria-expanded','false');
const panel=el('section');panel.id='pilgrimJournal';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','pilgrimTitle');
const head=el('header'),titleBox=el('div'),title=el('h2','The Keeper’s Last Light');title.id='pilgrimTitle';titleBox.append(el('small','EXPLORATION JOURNAL · MAIN ADVENTURE'),title);const close=button('Close',()=>show(false));head.append(titleBox,close);
const body=el('div',undefined,'pilgrim-body'),intro=el('p','Follow a forgotten keeper’s journey through four landmarks. Visit each checkpoint, learn its story, then bring the item needed to restore it. Both room members share this adventure.','pilgrim-intro');
const tabs=el('nav',undefined,'pilgrim-tabs');tabs.setAttribute('aria-label','Quest chapters');
const chapter=el('section',undefined,'pilgrim-chapter'),subtitle=el('small'),chapterTitle=el('h3'),objective=el('p'),lore=el('p',undefined,'pilgrim-lore'),discovery=el('p');chapter.append(subtitle,chapterTitle,objective,lore,discovery);
const requirement=el('div',undefined,'pilgrim-requirement'),actions=el('div',undefined,'pilgrim-actions');
const activate=button('Visit checkpoint',interact),recipeButton=button('Find item recipes',openRecipes),locate=button('Show tracked checkpoint',()=>{selected=quest()?.step||0;selected=Math.min(3,selected);render();mapCanvas.scrollIntoView({block:'nearest'});});actions.append(activate,recipeButton,locate);
const status=el('p');status.id='pilgrimStatus';status.setAttribute('role','status');
const mapCanvas=el('canvas');mapCanvas.id='pilgrimQuestMap';mapCanvas.setAttribute('role','img');mapCanvas.setAttribute('aria-label','Quest route map');
const mapText=el('p');mapText.id='pilgrimMapText';
const chronicle=el('details'),entries=el('ol');chronicle.append(el('summary','Adventure log'),entries);
const reward=el('p','Completion reward: Keeper of the Dawn title and two vitality tonics. Restoring checkpoints does not advance enemy turns. Movement and the normal game controls remain available while this journal is open.');
body.append(intro,tabs,chapter,requirement,actions,status,el('h3','The Keeper’s Route'),mapCanvas,mapText,chronicle,reward);panel.append(head,body);host.append(toggle,panel);
const chapterButtons=stages.map((stage,i)=>{const n=button((i+1)+'. '+stage.name,()=>{selected=i;render();});tabs.append(n);return n;});
function show(open){if(open&&(!latest||latest.player.hp<=0||blocked()))return;if(open){previousFocus=document.activeElement;selected=Math.min(3,quest()?.step||0);}panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open){render();close.focus({preventScroll:true});}else if(previousFocus?.isConnected&&!previousFocus.closest('[hidden],[inert]'))previousFocus.focus({preventScroll:true});}
function setup(){
 if(!latest||quest()||latest.player.hp<=0||latest.gameState.gulchPermanentGameOver?.ended||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;
 const s=latest,p=s.player,map=s.seed.maps.find(m=>m.id===p.map);if(!map)return;
 const occupied=new Set(s.seed.entities.filter(e=>e.map===p.map&&e.id!=='player').map(e=>e.x+','+e.y));
 const queue=[{x:p.x,y:p.y,d:0}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length&&queue.length<16000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const q=queue[i],x=q.x+dx,y=q.y+dy,key=x+','+y;if(!seen.has(key)&&walk(s.seed,map,x,y)&&!occupied.has(key)){seen.add(key);queue.push({x,y,d:q.d+1});}}
 const candidates=queue.filter(q=>q.d>=5&&map.ascii[q.y][q.x]!=='>'&&!(map.exits||[]).some(e=>Math.abs(e.x-q.x)+Math.abs(e.y-q.y)<3));
 if(candidates.length<4){notice='Find open ground connected to a larger area to chart the keeper’s route.';return;}
 const chosen=[],maximum=Math.max(...candidates.map(q=>q.d));
 for(let i=0;i<4;i++){
  const target=maximum*(.2+i*.25);
  const options=candidates.filter(q=>!chosen.some(v=>v.x===q.x&&v.y===q.y));
  options.sort((a,b)=>{
   const score=q=>Math.abs(q.d-target)+chosen.reduce((n,v)=>n+Math.max(0,7-Math.hypot(q.x-v.x,q.y-v.y))*8,0);
   return score(a)-score(b)||a.y-b.y||a.x-b.x;
  });chosen.push(options[0]);
 }
 const sites=chosen.map((q,i)=>({map:map.id,x:q.x,y:q.y,name:stages[i].place}));
 // A self exit keeps this quest region in the frontier's existing map retention set.
 const alreadyPinned=(map.exits||[]).some(e=>e.to===map.id);
 const pin={x:p.x,y:p.y,to:map.id,at:{x:p.x,y:p.y},keeperAnchor:true};
 const next={...s.gameState,seed:{...s.seed,maps:s.seed.maps.map(m=>m.id===map.id&&!alreadyPinned?{...m,exits:[...(m.exits||[]),pin]}:m)},[KEY]:{epoch:epoch(s.gameState),map:map.id,sites,step:0,visited:[],log:['A weathered route chart names four places where the keeper left her light.'],complete:false}};
 attempt=s.stateRevision;
 if(!safeSize(next)){notice='The shared world is too full to record a new quest route.';return;}
 Gulch.commit(next,'Adventure discovered: The Keeper’s Last Light. Open Quest journal to follow four restoration checkpoints.');
}
function interact(){
 if(!ready())return;
 const q=quest();if(!q||q.complete||selected!==q.step)return;
 const site=q.sites[q.step],stage=stages[q.step];if(!closeEnough(site)){notice='Reach '+site.name+' at '+site.x+', '+site.y+' first.';render();return;}
 const visited=Array.isArray(q.visited)?q.visited:[];
 let next={...latest.gameState},updated={...q,visited:visited.slice(),log:(q.log||[]).slice()},text;
 if(!visited.includes(q.step)){
  updated.visited.push(q.step);text='Reached '+site.name+'. '+stage.discovery;updated.log=[text,...updated.log].slice(0,12);
 }else{
  if(available(stage.item)<stage.amount){notice='Missing '+(stage.amount-available(stage.item))+' '+itemName(stage.item)+'. See the acquisition guidance.';render();return;}
  if(q.step===3&&count(pack().bag?.tonic)>997){notice='Make room for two vitality tonics in the shared pack before finishing.';render();return;}
  if(stage.item.startsWith('$')){const world=next.outsideWorld||{};next.outsideWorld={...world,resources:{...world.resources,[stage.item.slice(1)]:available(stage.item)-stage.amount}};}
  else{const p=pack();next.itemEcosystem={...p,bag:{...p.bag,[stage.item]:count(p.bag?.[stage.item])-stage.amount}};}
  updated.step=q.step+1;updated.complete=updated.step===stages.length;text='Restored '+site.name+'. '+stage.completion;updated.log=[text,...updated.log].slice(0,12);
  if(updated.complete){const p=next.itemEcosystem||pack();next.itemEcosystem={...p,bag:{...p.bag,tonic:count(p.bag?.tonic)+2},known:Array.from(new Set([...(p.known||[]),'tonic'])),log:['The Keeper’s Last Light: received two vitality tonics.',...(p.log||[])].slice(0,12)};updated.title='Keeper of the Dawn';updated.completedTurn=latest.turn;}
 }
 const token=String(latest.stateRevision)+':'+Date.now().toString(36)+':'+Math.random().toString(36).slice(2,8);updated.receipt=token;next[KEY]=updated;
 if(!safeSize(next)){notice='The shared world is full. No items were consumed.';render();return;}
 pending={base:latest.stateRevision,token,epoch:epoch(next),step:updated.step,text};notice='Waiting for shared confirmation…';
 Gulch.commit(next,text);
 if(!window.GulchMovementState?.inFlight){pending=null;notice='The update was not submitted. Try again when the room is ready.';}
 render();
}
function openRecipes(){
 const id=stages[selected].item;show(false);document.getElementById('inventoryToggle')?.click();
 const inv=document.getElementById('inventoryPanel');if(!inv||inv.hidden)return;
 inv.querySelectorAll('.new-inventory-nav button')[1]?.click();
 const selector=document.getElementById('ecosystemRecipe'),recipe=window.GulchItemCatalog?.recipes.find(r=>r.output[id]);
 if(selector&&recipe){selector.value=recipe.id;selector.dispatchEvent(new Event('change'));selector.focus();selector.scrollIntoView({block:'nearest'});}
 else{const n=document.getElementById('packStatus');if(n)n.textContent=stages[selected].source;}
}
function paintMap(){
 const q=quest(),map=latest?.seed.maps.find(m=>m.id===q?.map);if(!q||!map)return;
 const w=Math.max(...map.ascii.map(r=>r.length)),h=map.ascii.length,scale=Math.max(1,Math.min(7,Math.floor(700/w))),pad=18;
 mapCanvas.width=w*scale+pad*2;mapCanvas.height=h*scale+pad*2;
 const ctx=mapCanvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#26372f';ctx.fillRect(0,0,mapCanvas.width,mapCanvas.height);
 map.ascii.forEach((row,y)=>Array.from(row).forEach((c,x)=>{const kind=latest.seed.legend[c]?.[0],mat=latest.seed.legend[c]?.[1];ctx.fillStyle=kind==='wall'||c==='#'?'#485247':kind==='water'||c==='~'?'#527d80':mat==='tree'?'#637851':'#a4a27a';ctx.fillRect(pad+x*scale,pad+y*scale,scale,scale);}));
 ctx.setLineDash([4,5]);ctx.strokeStyle='#f6db94';ctx.lineWidth=2;ctx.beginPath();q.sites.forEach((s,i)=>{const x=pad+(s.x+.5)*scale,y=pad+(s.y+.5)*scale;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();ctx.setLineDash([]);
 q.sites.forEach((s,i)=>{const x=pad+(s.x+.5)*scale,y=pad+(s.y+.5)*scale;ctx.fillStyle=i<q.step?'#a9db9d':i===q.step?'#f7d184':'#d8d0b0';ctx.beginPath();ctx.arc(x,y,i===selected?10:8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#20372f';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#182b27';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),x,y);});
 if(latest.mapId===map.id){const p=latest.player,x=pad+(p.x+.5)*scale,y=pad+(p.y+.5)*scale;ctx.fillStyle='#b94037';ctx.strokeStyle='#fff2c9';ctx.lineWidth=2;ctx.fillRect(x-3,y-3,6,6);ctx.strokeRect(x-4,y-4,8,8);}
 const site=q.sites[selected];mapText.textContent=(map.name||map.id)+' · '+site.name+': '+site.x+', '+site.y+'. Red square: you. Gold: active checkpoint. Green: restored. Dotted lines show quest order, not a guaranteed walking route. This quest chart reveals terrain in its region.';
 mapCanvas.setAttribute('aria-label',mapText.textContent);
}
function render(){
 const q=quest();toggle.disabled=!latest||latest.player.hp<=0;toggle.textContent=q?.complete?'Journal · Keeper of the Dawn':'Quest journal'+(q?' · '+Math.min(q.step+1,4)+'/4':'');
 if(panel.hidden)return;
 status.textContent=notice;
 if(!q){objective.textContent='Charting a reachable quest route…';activate.disabled=true;recipeButton.disabled=true;return;}
 const stage=stages[selected],site=q.sites[selected],visited=q.visited.includes(selected),done=selected<q.step;
 chapterButtons.forEach((n,i)=>{n.textContent=(i<q.step?'✓ ':i===q.step?'◆ ':'○ ')+(i+1)+'. '+stages[i].name;n.setAttribute('aria-pressed',String(i===selected));});
 subtitle.textContent=done?'COMPLETED':selected===q.step?'TRACKED ADVENTURE':'LATER CHAPTER';chapterTitle.textContent=stage.name;
 objective.textContent=done?'Restored: '+site.name:!visited?'Reach '+site.name+' · '+site.x+', '+site.y+' · '+stage.subtitle:stage.task;
 lore.textContent=stage.lore;discovery.textContent=done?stage.completion:visited?stage.discovery:'The route chart marks this place. Visit it to uncover the keeper’s message.';
 requirement.replaceChildren(el('strong','Required: '+stage.amount+' × '+itemName(stage.item)),el('p',done?'Offering delivered.':available(stage.item)+' available in the shared pack. Items are consumed only when you restore the checkpoint.'),el('p',stage.source));
 if(q.complete)requirement.append(el('strong','ADVENTURE COMPLETE · Keeper of the Dawn'),el('p','Two vitality tonics were added to the shared pack.'));
 activate.textContent=done?'Checkpoint restored':selected!==q.step?'Complete the earlier checkpoint':!visited?'Examine checkpoint':'Restore · offer '+stage.amount+' '+itemName(stage.item);
 activate.disabled=!ready()||done||selected!==q.step||!closeEnough(site)||(visited&&available(stage.item)<stage.amount);
 recipeButton.disabled=false;
 entries.replaceChildren(...q.log.map(text=>el('li',text)));paintMap();
}
const overlay=el('canvas');overlay.setAttribute('aria-hidden','true');overlay.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2';host.append(overlay);
function paintPins(){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
 if(overlay.width!==Math.round(w*dpr)||overlay.height!==Math.round(h*dpr)){overlay.width=Math.max(1,Math.round(w*dpr));overlay.height=Math.max(1,Math.round(h*dpr));overlay.style.width=w+'px';overlay.style.height=h+'px';}
 const ctx=overlay.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const q=quest();if(!q||!latest||latest.player.hp<=0)return;
 const p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 q.sites.forEach((s,i)=>{if(s.map!==p.map||latest.lit[s.y]?.[s.x]!==1)return;const x=w/2+(s.x-camera.x)*ts,y=h/2+(s.y-camera.y)*ts;
 ctx.strokeStyle=i<q.step?'#acd99c':i===q.step?'#ffe2a1':'#c0c6ad';ctx.lineWidth=i===q.step?2:1;ctx.strokeRect(x-ts*.38,y-ts*.38,ts*.76,ts*.76);
 ctx.fillStyle='#152b2bea';ctx.fillRect(x-9,y-ts*.72,18,17);ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i<q.step?'✓':String(i+1),x,y-ts*.72+8);
 });
}
mapCanvas.addEventListener('click',event=>{const q=quest(),map=latest?.seed.maps.find(m=>m.id===q?.map);if(!q||!map)return;const rect=mapCanvas.getBoundingClientRect(),scale=Math.min(rect.width/mapCanvas.width,rect.height/mapCanvas.height),left=rect.left+(rect.width-mapCanvas.width*scale)/2,top=rect.top+(rect.height-mapCanvas.height*scale)/2,x=(event.clientX-left)/scale,y=(event.clientY-top)/scale,w=Math.max(...map.ascii.map(r=>r.length)),tile=Math.max(1,Math.min(7,Math.floor(700/w)));const hit=q.sites.map((s,i)=>({i,d:Math.hypot(x-(18+(s.x+.5)*tile),y-(18+(s.y+.5)*tile))})).sort((a,b)=>a.d-b.d)[0];if(hit&&hit.d<=15){selected=hit.i;render();}});
Gulch.register('keeper-quest-journal',{snapshot(s){
 const reset=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;
 if(reset){pending=null;attempt=null;selected=0;notice='A new expedition brings a new keeper’s route.';}
 if(pending&&pending.base!==s.stateRevision){const request=pending;pending=null;const q=quest();if(q?.receipt===request.token&&q.epoch===request.epoch){notice=request.text;selected=Math.min(3,q.step);}else notice='Another room update arrived. Check your quest progress and supplies before retrying.';}
 if(s.player.hp<=0&&!panel.hidden)show(false);
 setup();render();paintPins();
},resize(){render();paintPins();}});
new MutationObserver(()=>{if(!panel.hidden&&blocked())show(false);}).observe(host,{subtree:true,attributes:true,attributeFilter:['hidden']});
let last=0;
function frame(now){if(!document.hidden&&latest&&now-last>=100){last=now;paintPins();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
setInterval(()=>{if(document.hidden)return;setup();if(!panel.hidden)render();},700);
})();
