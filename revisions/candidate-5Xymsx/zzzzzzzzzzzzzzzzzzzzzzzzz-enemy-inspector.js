(function(){
'use strict';
const host=document.getElementById('left'),board=document.getElementById('board');
if(!host||!board)return;
let latest=null,targetId=null,pinned=false,closeTimer=null,previousFocus=null,lastPointer=null;
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');style.textContent=`
#enemyInspectCard[hidden]{display:none!important}
#enemyInspectCard{position:absolute;z-index:90;width:300px;max-width:calc(100% - 16px);max-height:calc(100% - 16px);overflow:auto;padding:14px;background:#101e26fa;color:#e1e7d9;border:1px solid #aa9471;border-radius:9px;box-shadow:0 10px 32px #0009;font:12px/1.6 ui-monospace,monospace}
#enemyInspectCard header{display:flex;gap:12px;align-items:center}#enemyInspectCard h2{font-size:15px;line-height:1.4;color:#f4d59d;margin:0;overflow-wrap:anywhere}
#enemyInspectPortrait{width:80px;height:80px;flex-shrink:0;background:#09151d;border:1px solid #54675c;border-radius:5px;image-rendering:pixelated}
#enemyInspectCard p{margin:10px 0}#enemyInspectCard dl{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;margin:12px 0}#enemyInspectCard dt{color:#aabbac}#enemyInspectCard dd{margin:0;text-align:right;overflow-wrap:anywhere}#enemyInspectCard blockquote{margin:12px 0;border-left:2px solid #a18d68;padding-left:12px;color:#d0d9c4}
#enemyInspectCard button{min-height:40px;padding:8px 12px;background:#253b35;color:#f0dcb2;border:1px solid #79917d;border-radius:5px;font:inherit}#enemyInspectCard button:focus-visible{outline:2px solid #f4d59d;outline-offset:3px}.enemy-inspect-actions{display:flex;gap:8px;justify-content:space-between}#enemyInspectCard small{display:block;color:#a4b6ad;font-size:10px;margin:10px 0}
#enemyInspectToggle{position:absolute;left:12px;top:154px;z-index:5;min-height:36px;background:#10252be8;color:#e9dbb7;border:1px solid #7a9580;border-radius:6px;padding:7px 10px;font:11px monospace}
#enemyInspectPicker{width:100%;min-height:38px;background:#142b2d;color:#eee5cb;border:1px solid #79917d;font:inherit;margin-bottom:10px}
@media(max-width:700px){#enemyInspectToggle{left:8px;top:146px}#enemyInspectCard{width:280px}}
`;document.head.append(style);
const panel=el('section');panel.id='enemyInspectCard';panel.hidden=true;panel.setAttribute('aria-label','Enemy inspection');
const picker=el('select');picker.id='enemyInspectPicker';picker.setAttribute('aria-label','Visible enemy');picker.hidden=true;
const header=el('header'),portrait=el('canvas');portrait.id='enemyInspectPortrait';portrait.width=80;portrait.height=80;portrait.setAttribute('role','img');
const title=el('h2');title.id='enemyInspectTitle';header.append(portrait,title);
const brief=el('p'),stats=el('dl'),behavior=el('p'),lore=el('blockquote'),credit=el('small','Original frontier legend inspired by Tolkien’s themes; these creatures and places are fictional additions, not canonical lore.');
const actions=el('div');actions.className='enemy-inspect-actions';const inspect=el('button','Inspect enemy'),close=el('button','Close');inspect.type=close.type='button';actions.append(inspect,close);
panel.append(picker,header,brief,stats,behavior,lore,credit,actions);host.append(panel);
const toggle=el('button','Inspect enemies');toggle.id='enemyInspectToggle';toggle.type='button';toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');host.append(toggle);
const stories={
 skitter:['Thornveil runner','Beyond the gardens of Brindlewick, small hunters weave their nests from thorn and moon-pale silk. The little folk hang copper bells along their fences: a ringing path is safer than a silent one.','Swift hunter; occasionally moves two tiles. Adjacent strikes deal 1 base damage.'],
 brute:['Warden of the Broken Road','The smiths of Karad Venn once bound these beasts to their mountain caravans. When the northern road fell, the ironhide wardens remained, charging at every lantern as though it were a stolen star.','Marks a straight attack lane up to four tiles long, strikes on its next enemy turn, then recovers. Base damage: 5.'],
 storm:['Lantern of the Lost Vale','Travelers say the pale lights of Elar Vale remember an oath their keepers forgot. They gather above ruined watchtowers, guarding the road to a woodland refuge that no living map records.','Marks your tile from up to six tiles away when its path is clear. Strikes next enemy turn, then recovers. Base damage: 3.'],
 colossus:['The Last Stonebound','Beneath the western peaks, the stone-singers carved a guardian to shelter every wanderer, great or small. Centuries of lonely watch have clouded its purpose. It now mistakes approaching footsteps for the armies it was made to withstand.','Slow giant with a wide, marked slam. Leave the marked ground before the next enemy turn. Base damage: 12; two recovery turns.'],
 dread:['Crimson keeper','In the roots of the Elderwood, a red-horned keeper drank from a spring darkened by a fallen crown. The woodland folk still leave flowers on its trails, remembering the gentle creature it once was.','Dangerous adjacent attacker. A Dreadmaw encounter applies an 8-base-damage hit before armor and difficulty.'],
 wisp:['A candle without a keeper','When the watchfires of the western vale went out, a few sparks refused the darkness. They drift between old stones, searching for the hands that once sheltered them from the wind.','Closes in within nine tiles and attacks from adjacent ground. Ordinary cave attackers share a two-base-damage cap per enemy turn.'],
 crawler:['Delver of the Sunless Halls','Under the abandoned halls of Karad Venn, patient delvers feed on roots that have never seen daylight. Their shells carry a faint green sheen, like the lamps the mountain folk left burning when they fled.','Approaches along open ground within nine tiles. Ordinary adjacent cave attackers share a two-base-damage cap per enemy turn.'],
 beetle:['Amber shield of the old wood','Foresters of Alderhaven call these creatures the fallen forest’s shields. Amber plates shelter them from frost and blade alike, but the restless shadow beyond the ridge has turned their patient wandering into a hunt.','Approaches within nine tiles and attacks adjacent targets across clear corners. Ordinary cave attackers share a two-base-damage cap per enemy turn.'],
 other:['A shadow on the long road','The road from Brindlewick to the mountain gates passes many forgotten kingdoms. Around small campfires, travelers tell of this creature and remind one another that courage is easier to keep when shared.','Watch its position and health. Walk into a hostile creature or face it and press Space to attack.'],
 dummy:['The patient sentinel','A roadwarden carved this wooden sentinel for the young defenders of Alderhaven. It has never abandoned its post, though the sparrows show it very little respect.','Harmless practice target. Face it and press Space to slash.']
};
function enemy(e){return e&&e.id!=='player'&&e.faction==='hostile'&&!(Number.isFinite(e.hp)&&e.hp<=0)&&!e.isPlayer&&!e.playerId&&!e.ownerId&&!e.clientId&&!e.loreSpeaker&&!e.ecosystemLoot&&e.itemId==null&&!/item|loot|weapon|armor|equipment/i.test(String(e.kind||''));}
function visible(e){return enemy(e)&&e.map===latest?.mapId&&latest.lit[e.y]?.[e.x]===1;}
function enemies(){return latest?latest.seed.entities.filter(visible):[];}
function target(){return latest?.seed.entities.find(e=>e.id===targetId);}
function type(e){if(e.practiceTarget)return 'dummy';if(stories[e.enemyVariety])return e.enemyVariety;if(e.dreadBeast)return 'dread';if(stories[e.caveSprite])return e.caveSprite;return 'other';}
function blocked(){return ['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function paintPortrait(e){
 const ctx=portrait.getContext('2d');ctx.clearRect(0,0,80,80);ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#0a1820';ctx.fillRect(0,0,80,80);ctx.fillStyle='#203435';for(let y=0;y<80;y+=8)for(let x=0;x<80;x+=8)if((x+y)%16===0)ctx.fillRect(x,y,8,8);
 if(e.caveEncounter===1&&window.GulchCaveEnemies?.sprite){
  const size=e.enemyVariety==='colossus'?25:e.enemyVariety==='brute'?43:54;
  window.GulchCaveEnemies.sprite(ctx,e,40,44,size,1);
 }else{
  const rows=['..a....a..','.aabbbbaa.','..bbbbbb..','.bbdccdbb.','..bbccbb..','...bbbb...','..aee eea..'.replace(' ',''),'.aaeeeeaa.','...eeee...','..aa..aa..'];
  const colors={a:'#3c303b',b:e.practiceTarget?'#bd9160':'#94aa74',c:'#202332',d:'#f0ce83',e:e.practiceTarget?'#92704d':'#805b58'};
  rows.forEach((row,y)=>Array.from(row).forEach((c,x)=>{if(colors[c]){ctx.fillStyle=colors[c];ctx.fillRect(15+x*5,15+y*5,5,5);}}));
 }
 portrait.setAttribute('aria-label','Pixel portrait of '+String(e.name||'enemy'));
}
function render(){
 const e=target();if(!e||!visible(e)){hide(false);return;}
 const story=stories[type(e)],p=latest.player;
 title.textContent=String(e.name||'Unknown enemy');brief.textContent=story[0];
 stats.replaceChildren();
 function row(label,value){stats.append(el('dt',label),el('dd',String(value)));}
 row('Health',Number.isFinite(e.hp)?e.hp+(Number.isFinite(e.maxHp)?' / '+e.maxHp:''):'Unknown');
 row('Disposition',e.practiceTarget?'Harmless target':'Hostile');
 row('Position',e.x+', '+e.y);row('Distance',Math.hypot(e.x-p.x,e.y-p.y).toFixed(1)+' tiles');
 row('Intent',e.enemyIntent?'Attack winding up':e.enemyRecovery>0?'Recovering':e.practiceTarget?'Stationary':'Watching / hunting');
 row('Difficulty',latest.gameState.respawnSettings?.difficulty||'hard');
 behavior.textContent=story[2]+(e.practiceTarget?'':' Damage shown is before armor and expedition difficulty.');lore.textContent=story[1];
 paintPortrait(e);inspect.hidden=pinned;picker.hidden=!pinned;stats.hidden=behavior.hidden=lore.hidden=credit.hidden=!pinned;
 if(pinned){picker.replaceChildren(...enemies().map(v=>{const o=el('option',String(v.name||v.id)+' · '+v.x+', '+v.y);o.value=v.id;return o;}));picker.value=e.id;}
}
function position(x,y){
 const rect=host.getBoundingClientRect();
 panel.style.left=Math.max(8,Math.min(x-rect.left+16,host.clientWidth-panel.offsetWidth-8))+'px';
 panel.style.top=Math.max(8,Math.min(y-rect.top+14,host.clientHeight-panel.offsetHeight-8))+'px';
}
function show(e,x,y,lock){
 clearTimeout(closeTimer);targetId=e.id;pinned=Boolean(lock);panel.hidden=false;toggle.setAttribute('aria-expanded','true');
 if(pinned){panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby',title.id);}else panel.removeAttribute('role');
 render();position(x,y);
}
function hide(restore){clearTimeout(closeTimer);panel.hidden=true;targetId=null;pinned=false;toggle.setAttribute('aria-expanded','false');if(restore){const n=previousFocus?.isConnected&&!previousFocus.closest('[hidden],[inert]')?previousFocus:toggle;n.focus({preventScroll:true});}}
function hit(x,y){
 if(!latest||blocked()||latest.player.hp<=0)return null;
 const rect=board.getBoundingClientRect(),p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const tx=Math.round(camera.x+(x-rect.left-rect.width/2)/ts),ty=Math.round(camera.y+(y-rect.top-rect.height/2)/ts);
 return enemies().find(e=>e.x===tx&&e.y===ty)||null;
}
function delayedHide(){clearTimeout(closeTimer);if(!pinned)closeTimer=setTimeout(()=>{if(!pinned&&!panel.matches(':hover')&&!panel.contains(document.activeElement))hide(false);},450);}
board.addEventListener('pointermove',event=>{
 lastPointer={x:event.clientX,y:event.clientY};if(pinned||event.pointerType==='touch')return;
 const e=hit(event.clientX,event.clientY);if(!e){delayedHide();return;}
 if(panel.hidden||targetId!==e.id)show(e,event.clientX,event.clientY,false);else clearTimeout(closeTimer);
});
board.addEventListener('pointerleave',delayedHide);
panel.addEventListener('pointerenter',()=>clearTimeout(closeTimer));panel.addEventListener('pointerleave',delayedHide);
inspect.addEventListener('click',()=>{previousFocus=board;pinned=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby',title.id);render();if(lastPointer)position(lastPointer.x,lastPointer.y);close.focus({preventScroll:true});});
close.addEventListener('click',()=>hide(true));
picker.addEventListener('change',()=>{targetId=picker.value;render();});
toggle.addEventListener('click',()=>{
 if(!panel.hidden&&pinned){hide(true);return;}
 if(blocked())return;
 const list=enemies().sort((a,b)=>Math.hypot(a.x-latest.player.x,a.y-latest.player.y)-Math.hypot(b.x-latest.player.x,b.y-latest.player.y));
 if(!list.length)return;previousFocus=toggle;const r=toggle.getBoundingClientRect();show(list[0],r.left,r.bottom,true);picker.focus();
});
window.addEventListener('keydown',event=>{
 if(panel.hidden)return;
 if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();hide(true);return;}
 if(panel.contains(event.target))event.stopImmediatePropagation();
},true);
document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&event.target!==toggle&&pinned)hide(false);},true);
window.addEventListener('resize',()=>{if(!panel.hidden){const r=toggle.getBoundingClientRect();position(r.left,r.bottom);}});
new MutationObserver(()=>{if(!panel.hidden&&blocked())hide(false);}).observe(host,{subtree:true,attributes:true,attributeFilter:['hidden']});
Gulch.register('enemy-inspector',{snapshot(s){
 const changed=latest&&String(latest.gameState.respawnSettings?.token||'original')!==String(s.gameState.respawnSettings?.token||'original');latest=s;
 toggle.disabled=s.player.hp<=0||!enemies().length;toggle.title=enemies().length?'Inspect visible enemies; hover an enemy on the map for a quick preview.':'No enemies currently visible';
 if(changed||s.player.hp<=0||blocked()){hide(false);return;}
 if(!panel.hidden)render();
}});
})();
