(function(){
'use strict';
let snapshot=null,draft=null,previousFocus=null,pending=null;
const options={skin:[['Warm','#e6b78e'],['Deep','#81513d'],['Golden','#c78d58'],['Pale','#f1d5be']],hair:[['Sand','#b79059'],['Dark','#302a29'],['Copper','#a55237'],['Silver','#c4ced0']],clothing:[['Teal','#4d9090'],['Moss','#648252'],['Plum','#885c8c'],['Rust','#ad6546']]};
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
const style=el('style');style.textContent=`
#characterToggle{position:absolute;right:18px;top:256px;z-index:4;min-height:44px;padding:10px 13px;background:#19332e;color:#ead9af;border:1px solid #879c6e88;border-radius:5px;font:12px monospace}
#characterPanel[hidden]{display:none}#characterPanel{position:absolute;inset:12px;z-index:12;display:grid;place-items:center;background:#030b10bb;padding:8px}
.character-card{width:min(420px,100%);max-height:100%;overflow:auto;padding:18px;background:#102726;border:1px solid #829777;border-radius:9px;box-shadow:0 14px 60px #0009;color:#d9e1d3}
.character-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.character-head h2{font-size:16px;color:#e9c58c;margin:0}
#characterPanel button,#characterPanel input{font:inherit;min-height:44px;border:1px solid #66826c;border-radius:5px;background:#19362f;color:#e1e5cf;padding:9px 12px}#characterPanel button:focus-visible,#characterPanel input:focus-visible,#characterToggle:focus-visible{outline:2px solid #e9c58c;outline-offset:2px}
#characterPanel button:disabled{opacity:.5;cursor:default}#characterPanel label{display:block;margin:10px 0 5px}#characterName{width:100%}#characterPreview{display:block;width:144px;height:144px;margin:8px auto;image-rendering:pixelated;background:#091b20;border-radius:6px}
#characterPanel fieldset{border:0;padding:0;margin:12px 0}#characterPanel legend{font-size:12px;margin-bottom:6px}.character-swatches{display:flex;flex-wrap:wrap;gap:6px}#characterPanel .character-swatch{display:flex;align-items:center;gap:6px;padding:8px;font-size:12px}#characterPanel [aria-pressed=true]{outline:2px solid #e9c58c;outline-offset:1px}.character-color{width:16px;height:16px;border:1px solid #ffffff60;display:inline-block}.character-actions{display:flex;gap:10px;margin-top:14px}#characterStatus{font-size:12px;min-height:36px;color:#c4d2b7;margin-bottom:0}
@media(max-width:700px){#characterToggle{right:10px;top:238px}.character-card{padding:12px}}
`;document.head.append(style);
const toggle=button('Character',()=>show());toggle.id='characterToggle';toggle.setAttribute('aria-controls','characterPanel');toggle.setAttribute('aria-expanded','false');
const panel=el('section');panel.id='characterPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','characterTitle');
const card=el('div');card.className='character-card';const head=el('header');head.className='character-head';const title=el('h2','CHARACTER');title.id='characterTitle';const close=button('Close',hide);close.id='characterClose';head.append(title,close);
const preview=el('canvas');preview.id='characterPreview';preview.width=144;preview.height=144;preview.setAttribute('role','img');preview.setAttribute('aria-label','Player sprite preview');
const label=el('label','Player name');label.htmlFor='characterName';const name=el('input');name.id='characterName';name.type='text';name.maxLength=40;name.autocomplete='off';
card.append(head,preview,label,name);
const swatches=[];
Object.entries(options).forEach(([key,values])=>{
 const group=el('fieldset'),legend=el('legend',key[0].toUpperCase()+key.slice(1)),row=el('div');row.className='character-swatches';group.append(legend,row);
 values.forEach(([text,color])=>{const b=button('',()=>{draft={...draft,[key]:color};draw();});b.className='character-swatch';b.setAttribute('aria-label',key+': '+text);const dot=el('span');dot.className='character-color';dot.style.backgroundColor=color;dot.setAttribute('aria-hidden','true');b.append(dot,el('span',text));row.append(b);swatches.push({key,color,b});});card.append(group);
});
const actions=el('div');actions.className='character-actions';const apply=button('Apply',save),cancel=button('Cancel',hide);actions.append(apply,cancel);const status=el('p');status.id='characterStatus';status.setAttribute('role','status');card.append(actions,status);panel.append(card);document.getElementById('left').append(toggle,panel);
function draw(){
 if(!draft)return;
 const ctx=preview.getContext('2d');ctx.clearRect(0,0,144,144);ctx.imageSmoothingEnabled=false;
 if(window.GulchPlayerSprite)window.GulchPlayerSprite(ctx,{appearance:draft},72,72,126);
 swatches.forEach(({key,color,b})=>b.setAttribute('aria-pressed',String(draft[key]===color)));
 apply.disabled=!snapshot||Boolean(window.GulchMovementState?.inFlight)||Boolean(pending);
}
function show(){
 if(!snapshot)return;
 previousFocus=document.activeElement;
 const a=snapshot.player.appearance;
 draft={...(a&&typeof a==='object'&&!Array.isArray(a)?a:{})};
 Object.entries(options).forEach(([key,values])=>{if(!/^#[0-9a-f]{6}$/i.test(draft[key]||''))draft={...draft,[key]:values[0][1]};});
 name.value=String(snapshot.player.name??'Adventurer').slice(0,40);pending=null;
 status.textContent='Preview only. Apply saves to the shared player.';
 panel.hidden=false;toggle.setAttribute('aria-expanded','true');draw();name.focus();
}
function hide(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');draft=null;(previousFocus?.isConnected?previousFocus:toggle).focus();}
function save(){
 if(!snapshot||!draft||pending||window.GulchMovementState?.inFlight)return;
 const value=name.value.trim();
 if(!value||/[\u0000-\u001f\u007f]/.test(value)){status.textContent='Enter a name of 1–40 printable characters.';name.focus();return;}
 const data=snapshot.gameState,seed=data.seed;
 const old=snapshot.player.appearance;
 const appearance={...(old&&typeof old==='object'&&!Array.isArray(old)?old:{}),skin:draft.skin,hair:draft.hair,clothing:draft.clothing};
 pending={base:snapshot.stateRevision,name:value,appearance};
 Gulch.commit({...data,seed:{...seed,entities:seed.entities.map(p=>p.id==='player'?{...p,name:value,appearance}:p)}},'Updated shared player character.');
 status.textContent='Waiting for the room to confirm…';draw();
}
panel.addEventListener('keydown',event=>{
 if(event.key==='Tab'){
  const controls=Array.from(panel.querySelectorAll('button,input')).filter(n=>!n.disabled),first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
 }
 event.stopPropagation();
},true);
Gulch.register('character',{snapshot(s){
 snapshot=s;toggle.disabled=!s.player;
 if(pending&&s.stateRevision!==pending.base){
  const confirmed=s.player.name===pending.name&&Object.keys(options).every(k=>s.player.appearance?.[k]===pending.appearance[k]);
  status.textContent=confirmed?'Character saved.':'The room changed before saving. Press Apply to retry.';pending=null;
 }
 if(!panel.hidden)draw();
}});
toggle.disabled=true;
})();
