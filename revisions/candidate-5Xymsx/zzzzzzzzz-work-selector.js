(function(){
'use strict';
const board=document.getElementById('workBoard'),host=document.getElementById('left');
if(!board||!host)return;
let snapshot=null,captured=null,opened=false,previousFocus=null,wasHidden=true,selection=null;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=el('style');style.textContent=`
#selectWorkToggle{position:absolute;left:18px;top:125px;z-index:4;padding:10px 14px;min-height:44px;background:#183b35;color:#ffe1a3;border:1px solid #a99d6d;border-radius:6px;font:12px monospace}
#workBoard[data-selecting=true]>*:not(#workSelector){display:none!important}
#workBoard[data-selecting=true]{z-index:20;background:#09191f;overflow:auto}
#workSelector[hidden]{display:none}#workSelector{padding:20px;color:#dce7d6}
.ws-header{display:flex;align-items:center;justify-content:space-between;gap:14px}.ws-header h2{margin:0;font-size:20px;color:#f1d69e}
#workSelector p{font-size:12px;line-height:1.7;color:#b6c9bd}
.ws-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(240px,1fr);gap:20px;margin-top:16px}
#workPreview{display:block;width:100%;height:auto;max-height:65vh;object-fit:contain;border:1px solid #668777;border-radius:8px;background:#070e12;cursor:crosshair;touch-action:manipulation}
.ws-choices{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
#workSelector button{min-height:44px}#workSelector button[aria-pressed=true]{outline:2px solid #edcc8b;background:#344a38;color:#ffe1a3}
#workSelector label{display:block;font-size:12px;margin:12px 0 6px;color:#f1d69e}
#workSelector textarea{width:100%;min-height:100px;resize:vertical;font:13px/1.6 monospace;padding:10px;background:#10272a;color:#e3eadc;border:1px solid #668777;border-radius:5px}
#workSelector #workBrief{min-height:170px}.ws-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
#workSelection{padding:12px;border-left:3px solid #e9c58c;background:#16302c;white-space:pre-wrap;overflow-wrap:anywhere}
@media(max-width:700px){#selectWorkToggle{left:10px;top:155px;font-size:11px}#workSelector{padding:12px}.ws-layout{grid-template-columns:1fr}.ws-header h2{font-size:16px}#workPreview{max-height:45vh}}
`;document.head.append(style);
const toggle=button('Select work',show);toggle.id='selectWorkToggle';toggle.setAttribute('aria-controls','workSelector');toggle.setAttribute('aria-expanded','false');host.append(toggle);
const panel=el('section');panel.id='workSelector';panel.hidden=true;panel.setAttribute('aria-labelledby','workSelectorTitle');
const head=el('header');head.className='ws-header';const title=el('h2','What should I work on?');title.id='workSelectorTitle';const close=button('Back to game',hide);head.append(title,close);
const intro=el('p','Click a creature or tile in the game preview, or choose a game component. Describe the change, then copy the task brief into chat. This screen opens once when the game loads; use Select work for your next task.');
const layout=el('div');layout.className='ws-layout';const visual=el('div'),form=el('div');
const preview=el('canvas');preview.id='workPreview';preview.width=640;preview.height=400;preview.setAttribute('role','img');preview.setAttribute('aria-label','Selectable game preview. Keyboard users can choose visible entities and components below.');
const refresh=button('Refresh game preview',capture);
const nearby=el('div');nearby.className='ws-choices';nearby.setAttribute('aria-label','Visible entities');
visual.append(preview,el('p','Preview is frozen while selecting. Click a tile to identify it. Visible entities also have buttons below.'),refresh,nearby);
const selected=el('p','Choose a target.');selected.id='workSelection';selected.setAttribute('role','status');
const choices=el('div');choices.className='ws-choices';choices.setAttribute('aria-label','Game components');
const components=[
 ['Whole game',['index.html','runtime.js']],
 ['Movement and exits',['runtime.js','world.js']],
 ['Combat and enemies',['combat.js','a-cave-enemies.js','world.js']],
 ['Map visuals',['renderer.js']],
 ['Character editor',['character.js','renderer.js']],
 ['Inventory',['inventory.js','index.html']],
 ['Health and running',['zzzzzzz-health-running.js']],
 ['Quests',['z-quest-journal.js']],
 ['NPC conversations',['zz-middle-earth-lore.js']],
 ['Game status screen',['z-work-board.js','zzzzzzzz-build-inspector.js']],
 ['Controls and layout',['index.html','z-visual-polish.js','z-inventory-help.js']]
];
components.forEach(([label,files])=>{const b=button(label,()=>choose({label,files}));b.dataset.target=label;choices.append(b);});
const taskLabel=el('label','What would you like changed?');taskLabel.htmlFor='workRequest';const request=el('textarea');request.id='workRequest';request.maxLength=4000;request.placeholder='For example: make this creature larger and give it a ranged attack.';
const briefLabel=el('label','Task brief — copy this into chat');briefLabel.htmlFor='workBrief';const brief=el('textarea');brief.id='workBrief';brief.readOnly=true;
const actions=el('div');actions.className='ws-actions';const selectText=button('Select brief to copy',()=>{brief.focus();brief.select();feedback.textContent='Press Ctrl+C or Command+C, then paste into chat. On touch devices, use the text selection Copy action.';});actions.append(selectText);
const feedback=el('p');feedback.setAttribute('role','status');
form.append(selected,choices,taskLabel,request,briefLabel,brief,actions,feedback);layout.append(visual,form);panel.append(head,intro,layout);board.append(panel);
function updateBrief(){
 const target=selection||{label:'Not selected',files:[]};
 brief.value=['Please work on: '+target.label,target.context||'',target.files.length?'Relevant game files: '+target.files.map(f=>'game-project/'+f).join(', '):'',captured?'Preview reference: map '+captured.mapId+', state revision '+captured.stateRevision+'.':'','Requested change: '+(request.value.trim()||'[Describe your change here]'),'Preserve other working gameplay.'].filter(Boolean).join('\n\n');
 selectText.disabled=!selection||!request.value.trim();
}
function choose(target){selection=target;selected.textContent=target.label+(target.context?'\n'+target.context:'');panel.querySelectorAll('[data-target]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.target===target.label)));feedback.textContent='Target selected. Describe the change below.';updateBrief();}
function entityTarget(e){return {label:String(e.name||e.id),context:'Entity ID: '+JSON.stringify(e.id)+'; map: '+JSON.stringify(e.map)+'; tile: '+e.x+', '+e.y+'.',files:e.id==='player'?['character.js','renderer.js']:e.caveEncounter===1?['a-cave-enemies.js','combat.js']:['renderer.js','world.js','zz-middle-earth-lore.js']};}
function capture(){
 if(!snapshot)return;
 const movement=window.GulchMovementState,player=snapshot.player;
 const camera=movement?.visual?.map===player.map?movement.visual:player;
 captured={...snapshot,camera:{x:camera.x,y:camera.y},width:host.clientWidth,height:host.clientHeight,tileSize:Math.max(20,Math.min(64,Number(snapshot.seed.meta?.tileSize)||32))};
 preview.width=Math.max(1,captured.width);preview.height=Math.max(1,captured.height);
 const ctx=preview.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#070e12';ctx.fillRect(0,0,preview.width,preview.height);
 Array.from(host.children).filter(n=>n instanceof HTMLCanvasElement).forEach(c=>{if(c.width&&c.height)ctx.drawImage(c,0,0,preview.width,preview.height);});
 nearby.replaceChildren();
 captured.seed.entities.filter(e=>e.map===captured.mapId&&captured.lit[e.y]?.[e.x]===1).slice(0,80).forEach(e=>{const t=entityTarget(e),b=button(t.label,()=>choose(t));b.dataset.target=t.label;nearby.append(b);});
 updateBrief();
}
preview.addEventListener('click',event=>{
 if(!captured)return;
 const rect=preview.getBoundingClientRect();
 const scale=Math.min(rect.width/preview.width,rect.height/preview.height);
 const left=rect.left+(rect.width-preview.width*scale)/2,top=rect.top+(rect.height-preview.height*scale)/2;
 const px=(event.clientX-left)/scale,py=(event.clientY-top)/scale;
 if(px<0||py<0||px>=preview.width||py>=preview.height)return;
 const x=Math.round(captured.camera.x+(px-captured.width/2)/captured.tileSize),y=Math.round(captured.camera.y+(py-captured.height/2)/captured.tileSize);
 const map=captured.seed.maps.find(m=>m.id===captured.mapId),ch=map?.ascii[y]?.[x];
 if(!ch||captured.lit[y]?.[x]!==1){feedback.textContent='Choose a visible tile in the preview.';return;}
 const entity=captured.seed.entities.find(e=>e.map===captured.mapId&&e.x===x&&e.y===y);
 if(entity)choose(entityTarget(entity));
 else choose({label:'Map tile '+x+', '+y,context:'Map: '+JSON.stringify(captured.mapId)+'; terrain: '+JSON.stringify(ch)+'; legend: '+JSON.stringify(captured.seed.legend[ch]||[])+'.',files:['renderer.js','world.js']});
});
request.addEventListener('input',updateBrief);
function show(){
 if(!panel.hidden)return;
 previousFocus=document.activeElement;wasHidden=board.hidden;
 board.hidden=false;board.dataset.selecting='true';panel.hidden=false;toggle.setAttribute('aria-expanded','true');
 const wt=document.getElementById('workToggle');if(wt)wt.setAttribute('aria-expanded','true');
 capture();request.focus();
}
function hide(){
 panel.hidden=true;delete board.dataset.selecting;board.hidden=wasHidden;toggle.setAttribute('aria-expanded','false');
 const wt=document.getElementById('workToggle');if(wt)wt.setAttribute('aria-expanded',String(!board.hidden));
 (previousFocus?.isConnected?previousFocus:toggle).focus();
}
window.addEventListener('keydown',event=>{
 if(panel.hidden)return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();hide();return;}
 if(event.key==='Tab'){
  const controls=Array.from(panel.querySelectorAll('button,textarea')).filter(n=>!n.disabled&&n.getClientRects().length),first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
 }
 event.stopImmediatePropagation();
},true);
Gulch.register('work-target-selector',{snapshot(s){snapshot=s;if(!opened)opened=true;}});
updateBrief();
})();
