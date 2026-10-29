(function(){
'use strict';
const baseCommit=Gulch.commit,KEY='heroProgression',CAP=50;
let latest=null,pending=null,previousFocus=null,signature='',lastNotice='',noticeTimer=null;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const integer=(n,max)=>Number.isFinite(Number(n))?Math.max(0,Math.min(max,Math.floor(Number(n)))):0;
const threshold=level=>60*(level-1)*(level-1);
const nodes=[
 {id:'vigor',name:'Iron Heart',branch:'Guardian',max:3,cost:1,requires:[],text:'Gain 5 maximum health per rank. Learning a rank also restores that much health.'},
 {id:'ward',name:'Stoneward',branch:'Guardian',max:3,cost:1,requires:[['vigor',2]],text:'Reduce surviving turn damage by 1 per rank, after existing armor and difficulty. At least 1 damage remains. Cannot prevent an already lethal hit.'},
 {id:'renewal',name:'Second Wind',branch:'Guardian',max:3,cost:1,requires:[['ward',2]],active:true,text:'Restore 7 + 5 per rank HP before enemies retaliate. Recharge: 9 − rank played turns. Can be used during combat.'},
 {id:'cleave',name:'Whirlwind',branch:'Vanguard',max:3,cost:1,requires:[],active:true,text:'Strike every adjacent hostile across clear ground for 3 + 4 per rank damage. Recharge: 6 − rank played turns.'},
 {id:'reach',name:'Storm Reach',branch:'Vanguard',max:2,cost:1,requires:[['cleave',2]],text:'Increase Whirlwind radius by one tile per rank. Walls and blocked corners stop its reach.'},
 {id:'reaper',name:'Reaper’s Resolve',branch:'Vanguard',max:3,cost:1,requires:[['reach',2]],text:'Confirmed enemy kills restore 2 HP per rank, per kill, if you survived the turn. No resurrection.'},
 {id:'bolt',name:'Arc Lance',branch:'Arcanist',max:3,cost:1,requires:[],active:true,text:'Fire along your facing direction up to 6 tiles. Hit the first hostile for 5 + 5 per rank damage. Recharge: 6 − rank played turns.'},
 {id:'chain',name:'Forked Lightning',branch:'Arcanist',max:3,cost:1,requires:[['bolt',2]],text:'Arc Lance jumps to one additional enemy per rank, within 3 tiles of its last target. Each jump deals 75% of the previous hit, rounded down.'},
 {id:'nova',name:'Starfall',branch:'Arcanist',max:3,cost:1,requires:[['chain',2]],active:true,text:'Blast visible hostiles within 3 tiles for 10 + 7 per rank damage. Recharge: 12 − rank played turns. Walls protect targets.'}
];
const definitions=new Map(nodes.map(n=>[n.id,n]));
function state(data){
 const raw=data?.[KEY],valid=raw?.epoch===epoch(data),ranks={};
 for(const node of nodes)ranks[node.id]=valid?integer(raw.ranks?.[node.id],node.max):0;
 const xp=valid?integer(raw.xp,threshold(CAP)):0;
 let level=1;while(level<CAP&&xp>=threshold(level+1))level++;
 const spent=nodes.reduce((n,d)=>n+ranks[d.id]*d.cost,0);
 return {epoch:epoch(data),xp,level,points:Math.max(0,level-1-spent),ranks,ready:valid&&raw.ready&&typeof raw.ready==='object'?{...raw.ready}:{},kills:valid?integer(raw.kills,1000000):0,healthBonus:valid?integer(raw.healthBonus,1000):0,receipt:valid?String(raw.receipt||''):'',lastReward:valid?raw.lastReward||null:null};
}
function hostile(e){return Boolean(e&&e.id!=='player'&&e.faction==='hostile'&&!e.practiceTarget&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.loreSpeaker&&!e.swordQuestLandmark&&!e.ecosystemLoot&&e.itemId==null&&!/item|loot|prop|weapon|armor|resource/i.test(e.kind||'')&&(!Number.isFinite(e.hp)||e.hp>0));}
function reward(e,data){
 const hp=Math.max(1,Math.min(1000,Number(e.maxHp)||Number(e.hp)||4));
 const weight=e.enemyVariety==='colossus'?5:e.dreadBeast?3:e.enemyVariety==='brute'?2:e.enemyVariety==='storm'?1.7:e.enemyVariety==='skitter'?1.2:1;
 const mode={easy:.8,normal:1,hard:1.2,nightmare:1.5}[data.respawnSettings?.difficulty]||1.2;
 return Math.max(5,Math.round((6+hp*2)*weight*mode));
}
function defeated(before,next){
 if(!(Number(next.turn)>Number(before.turn)))return [];
 const p=before.seed.entities.find(e=>e.id==='player');if(!p||!(p.hp>0))return [];
 const after=new Map(next.seed.entities.map(e=>[e.id,e]));
 return before.seed.entities.filter(e=>hostile(e)&&e.map===p.map&&next.seed.maps.some(m=>m.id===e.map)&&(!after.has(e.id)||Number(after.get(e.id).hp)<=0));
}
// This early wrapper runs after the later gameplay decorators and before CAS.
// Rewards are calculated from the final proposal and never from visual prediction.
Gulch.commit=function(data,activity,options){
 if(!latest||!data?.seed?.entities)return baseCommit.call(this,data,activity,options);
 const before=latest.gameState,p=data.seed.entities.find(e=>e.id==='player');
 if(!p)return baseCommit.call(this,data,activity,options);
 const same=epoch(before)===epoch(data),old=state(before);
 let hero=state(data),next=data,text=activity||'',maxHp=Math.max(1,Number(p.maxHp)||20),hp=Number(p.hp)||0;
 if(!same){
  hero=state({respawnSettings:data.respawnSettings});
  maxHp=Math.max(1,maxHp-old.healthBonus);hp=Math.min(maxHp,hp);
 }else{
  const victims=defeated(before,data),gain=victims.reduce((n,e)=>n+reward(e,before),0);
  hero.xp=Math.min(threshold(CAP),old.xp+gain);
  hero.kills=Math.min(1000000,old.kills+victims.length);
  hero.level=1;while(hero.level<CAP&&hero.xp>=threshold(hero.level+1))hero.level++;
  hero.points=Math.max(0,hero.level-1-nodes.reduce((n,d)=>n+hero.ranks[d.id]*d.cost,0));
  const bonus=(hero.level-1)*4+hero.ranks.vigor*5,added=bonus-old.healthBonus;
  maxHp=Math.max(1,maxHp+added);hero.healthBonus=bonus;
  const alive=hp>0&&!data.gulchPermanentGameOver?.ended;
  if(alive){
   hp=Math.min(maxHp,hp+Math.max(0,added));
   const previous=before.seed.entities.find(e=>e.id==='player');
   if(Number(data.turn)>Number(before.turn)&&previous&&p.hp>0&&p.hp<previous.hp&&old.ranks.ward)hp=Math.min(maxHp,hp+Math.min(old.ranks.ward,Math.max(0,previous.hp-p.hp-1)));
   if(victims.length&&old.ranks.reaper)hp=Math.min(maxHp,hp+victims.length*old.ranks.reaper*2);
  }else hp=0;
  if(gain){
   const levels=hero.level-old.level;
   const summary='Earned '+gain+' combat XP from '+victims.length+' defeated hostile'+(victims.length===1?'':'s')+'.'+(levels?' LEVEL '+hero.level+'! +'+(levels*4)+' maximum health and '+levels+' skill point'+(levels===1?'':'s')+'.':'');
   hero.lastReward={id:latest.revision+':'+latest.stateRevision+':'+String(data.turn),text:summary};text+=' '+summary;
  }
 }
 next={...data,[KEY]:hero,seed:{...data.seed,entities:data.seed.entities.map(e=>e.id==='player'?{...e,hp:Math.min(maxHp,hp),maxHp}:e)}};
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000){say('Character update exceeds room capacity. No action submitted.');return;}
 return baseCommit.call(this,next,text,options);
};
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function button(text,fn){const n=el('button',text);n.type='button';n.addEventListener('click',fn);return n;}
const host=document.getElementById('left');if(!host)return;
const style=el('style');style.textContent=`
#heroProgressDock{position:absolute;left:12px;bottom:158px;z-index:6;width:min(230px,calc(100% - 190px));padding:8px;background:#10232bed;border:1px solid #a38c64;border-radius:6px;color:#efdeb7;font:11px/1.5 monospace}
#heroProgressDock button{min-height:38px;width:100%;background:#294036;color:#ffe3aa;border:1px solid #8d9878;border-radius:4px;font:inherit;padding:5px}#heroProgressDock progress{display:block;width:100%;height:8px;margin:6px 0;accent-color:#e5c17e}#heroProgressDock p{margin:4px 0}
#heroSkillDialog{width:min(920px,calc(100% - 20px));max-height:90vh;overflow:auto;background:#101f28;color:#dbe5d7;border:3px double #ba9c6e;border-radius:8px;padding:18px;font:12px/1.6 monospace}#heroSkillDialog::backdrop{background:#031018c9}#heroSkillDialog header{display:flex;justify-content:space-between;gap:12px;align-items:center}#heroSkillDialog h2{font:25px Georgia,serif;color:#ffe1a0;margin:0}#heroSkillDialog button{min-height:42px;padding:8px 12px;background:#294237;color:#ffe3b5;border:1px solid #8da17d;border-radius:4px;font:inherit}#heroSkillDialog button:disabled{opacity:.5}#heroSkillDialog :focus-visible,#heroProgressDock :focus-visible,#heroPowerBar :focus-visible{outline:2px solid #ffe0a0;outline-offset:3px}#heroSkillBranches{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}#heroSkillBranches h3{color:#e8c88c}#heroSkillBranches article{padding:12px;margin:10px 0;background:#193039;border:1px solid #526e65;border-radius:5px}#heroSkillBranches article[data-learned=true]{border-color:#d5bd7d}#heroSkillBranches h4{margin:0;color:#f6dda6;font-size:14px}#heroSkillBranches p{margin:8px 0}#heroSkillBranches .hero-prerequisite{color:#b4c8bc;font-size:11px}#heroPowerBar{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:6;display:flex;gap:5px;max-width:calc(100% - 24px);overflow:auto;padding:4px;background:#0d2029e8;border-radius:5px}#heroPowerBar[hidden]{display:none}#heroPowerBar button{min-height:42px;min-width:88px;background:#294237;color:#ffe3b5;border:1px solid #9ca17b;border-radius:4px;padding:5px;font:10px/1.4 monospace}#heroPowerBar button:disabled{opacity:.55}#heroProgressNotice{position:absolute;left:50%;top:25%;transform:translateX(-50%);max-width:min(450px,90%);padding:12px;background:#152e32f5;border:1px solid #e7c687;border-radius:6px;color:#ffe8b3;z-index:10;pointer-events:none;font:12px/1.6 monospace}#heroProgressNotice[hidden]{display:none}
@media(max-width:640px){#heroSkillBranches{grid-template-columns:1fr}#heroProgressDock{left:8px;bottom:148px;width:min(180px,calc(100% - 185px));font-size:10px}#heroPowerBar{bottom:3px;max-width:95%}#heroPowerBar button{min-width:75px;font-size:9px}}
@media(max-height:500px){#heroProgressDock{bottom:80px;padding:5px}#heroProgressDock p{display:none}}
`;
document.head.append(style);
const dock=el('section');dock.id='heroProgressDock';dock.setAttribute('aria-label','Combat level and skills');
const openButton=button('Level 1 · Skills',open),xpBar=el('progress'),xpText=el('p');xpBar.max=1;xpBar.value=0;xpBar.setAttribute('aria-label','Combat experience toward next level');dock.append(openButton,xpBar,xpText);host.append(dock);
const notice=el('div');notice.id='heroProgressNotice';notice.hidden=true;notice.setAttribute('role','status');host.append(notice);
const dialog=el('dialog');dialog.id='heroSkillDialog';dialog.setAttribute('aria-labelledby','heroSkillTitle');
const heading=el('header'),title=el('h2','Paths of the Wayfarer');title.id='heroSkillTitle';const close=button('Return to expedition',()=>dialog.close());heading.append(title,close);
const summary=el('p'),feedback=el('p');feedback.setAttribute('role','status');
const branches=el('div');branches.id='heroSkillBranches';
const guide=el('p','Combat progression is separate from Running XP. Defeated hostiles in your current region grant XP based on maximum health, enemy type and expedition difficulty, including allied and environmental kills. Practice targets and animals grant none. Every combat level adds 4 maximum health and 1 skill point. Maximum level: 50. All room members share this character and its choices. A new expedition resets combat progression and its health bonuses.');
const rules=el('p','Powers are original takes on classic action-RPG whirlwinds, chain lightning and recovery skills. Use learned powers from the bottom bar or keys 1–4 outside menus. Each cast advances one enemy turn; cooldowns advance through played turns, not real time. Existing equipment, magic, loot and retaliation rules still apply. Skill purchases cost one point per rank and take no turn. Learning is permanent for this expedition.');
dialog.append(heading,summary,feedback,branches,guide,rules);document.body.append(dialog);
const cards=new Map();
for(const branch of ['Guardian','Vanguard','Arcanist']){
 const section=el('section');section.append(el('h3',branch));
 for(const node of nodes.filter(n=>n.branch===branch)){
  const article=el('article'),name=el('h4'),description=el('p',node.text),requirements=el('p'),buy=button('Learn · 1 point',()=>learn(node.id));requirements.className='hero-prerequisite';
  article.append(name,description,requirements,buy);section.append(article);cards.set(node.id,{article,name,requirements,buy});
 }
 branches.append(section);
}
const powerBar=el('nav');powerBar.id='heroPowerBar';powerBar.hidden=true;powerBar.setAttribute('aria-label','Learned combat powers');host.append(powerBar);
const powers=['cleave','bolt','renewal','nova'],powerButtons=new Map();
powers.forEach((id,i)=>{const b=button('',()=>cast(id));b.setAttribute('aria-keyshortcuts',String(i+1));powerBar.append(b);powerButtons.set(id,b);});
function say(text){feedback.textContent=text;notice.textContent=text;notice.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.hidden=true;},5000);}
function blocked(){return Boolean(document.querySelector('dialog[open]'))||['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu','tradePanel','travelMapPanel','pilgrimJournal','atlasPanel','itemContext','enemyInspectCard'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function ready(){const m=window.GulchMovementState;return Boolean(latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&m?.focused&&!m.inFlight&&!pending);}
function open(){if(!latest||latest.player.hp<=0||blocked())return;previousFocus=document.activeElement;Gulch.setMovement(0,0);dialog.showModal();render();close.focus({preventScroll:true});}
dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
dialog.addEventListener('close',()=>{const target=previousFocus?.isConnected&&!previousFocus.closest('[hidden],[inert]')?previousFocus:document.getElementById('board');if(target){if(target.tagName==='CANVAS')target.tabIndex=-1;target.focus({preventScroll:true});}render();});
function submit(data,text){
 if(!ready())return;
 const token=latest.revision+':'+latest.stateRevision+':hero:'+Date.now()+':'+Math.random().toString(36).slice(2);
 data={...data,[KEY]:{...state(data),receipt:token}};
 pending={source:latest.revision,base:latest.stateRevision,epoch:epoch(data),token,text};
 try{Gulch.commit(data,text);}catch(error){pending=null;say(String(error.message||error));}
 if(pending&&!window.GulchMovementState?.inFlight){pending=null;say('Action was not submitted. No points or powers spent.');}
 else if(pending)feedback.textContent='Waiting for room confirmation…';
 render();
}
function learn(id){
 if(!ready()||!dialog.open)return;
 const node=definitions.get(id),hero=state(latest.gameState);
 if(!node||hero.points<node.cost||hero.ranks[id]>=node.max||node.requires.some(([key,rank])=>hero.ranks[key]<rank))return;
 hero.ranks[id]++;
 submit({...latest.gameState,[KEY]:hero},'Learned '+node.name+' rank '+hero.ranks[id]+'.');
}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function clear(seed,map,a,b){
 let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=-Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,err=dx+dy;
 for(let i=0;i<64;i++){
  if(x===b.x&&y===b.y)return true;
  const twice=2*err;let nx=x,ny=y;if(twice>=dy){err+=dy;nx+=sx;}if(twice<=dx){err+=dx;ny+=sy;}
  if(!floor(seed,map,nx,ny)||(nx!==x&&ny!==y&&(!floor(seed,map,nx,y)||!floor(seed,map,x,ny))))return false;x=nx;y=ny;
 }return false;
}
function cooldown(id,rank){return id==='renewal'?9-rank:id==='nova'?12-rank:6-rank;}
function cast(id){
 if(!ready()||blocked())return;
 const data=latest.gameState,hero=state(data),rank=hero.ranks[id],turn=Number(data.turn)||0;
 if(!rank||Number(hero.ready[id])>turn)return;
 const seed=data.seed,p=latest.player,map=seed.maps.find(m=>m.id===p.map),enemies=seed.entities.filter(e=>hostile(e)&&e.map===p.map&&latest.lit[e.y]?.[e.x]===1),damage=new Map();
 let healing=0;
 if(id==='renewal'){
  healing=Math.min(7+5*rank,Math.max(0,p.maxHp-p.hp));if(!healing){say('Health is full. Second Wind remains ready.');return;}
 }else if(id==='cleave'||id==='nova'){
  const radius=id==='nova'?3:1+hero.ranks.reach;
  for(const e of enemies)if((id==='cleave'?Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y)):Math.hypot(e.x-p.x,e.y-p.y))<=radius&&clear(seed,map,p,e))damage.set(e.id,id==='nova'?10+7*rank:3+4*rank);
 }else if(id==='bolt'){
  const facing=data.sword?.facing,valid=Number.isInteger(facing?.dx)&&Number.isInteger(facing?.dy)&&Math.abs(facing.dx)<=1&&Math.abs(facing.dy)<=1&&(facing.dx||facing.dy),f=valid?facing:{dx:0,dy:1};
  let target=null;
  for(let n=1;n<=6;n++){
   const q={x:p.x+f.dx*n,y:p.y+f.dy*n};if(!clear(seed,map,p,q))break;
   const occupants=seed.entities.filter(e=>e.id!=='player'&&e.map===p.map&&e.x===q.x&&e.y===q.y);
   target=enemies.find(e=>e.x===q.x&&e.y===q.y);if(target||occupants.some(e=>e.faction==='friendly'))break;
  }
  if(target){
   let hit=5+5*rank;damage.set(target.id,hit);
   for(let jump=0;jump<hero.ranks.chain;jump++){
    const next=enemies.filter(e=>!damage.has(e.id)&&Math.hypot(e.x-target.x,e.y-target.y)<=3&&clear(seed,map,target,e)).sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y)||String(a.id).localeCompare(String(b.id)))[0];
    if(!next)break;target=next;hit=Math.max(1,Math.floor(hit*.75));damage.set(target.id,hit);
   }
  }
 }
 if(!healing&&!damage.size){say('No eligible target. Face an enemy or move within range. Power remains ready.');return;}
 let nextSeed={...seed,entities:seed.entities.map(e=>e.id==='player'&&healing?{...e,hp:Math.min(e.maxHp,e.hp+healing)}:damage.has(e.id)?{...e,hp:Math.max(0,(Number.isFinite(e.hp)?e.hp:4)-damage.get(e.id))}:e)};
 // Retain defeated records for the existing loot decorators; cave AI ignores zero HP.
 if(window.GulchCaveEnemies?.advance)nextSeed=window.GulchCaveEnemies.advance(nextSeed);
 hero.ready[id]=turn+1+cooldown(id,rank);
 const text=definitions.get(id).name+'! '+(healing?'Restored '+healing+' HP before retaliation.':damage.size+' hostile target'+(damage.size===1?'':'s')+' struck.');
 submit({...data,seed:nextSeed,turn:turn+1,[KEY]:hero},text);
}
function render(){
 if(!latest)return;
 const hero=state(latest.gameState),remaining=hero.level<CAP?threshold(hero.level+1)-hero.xp:0;
 openButton.textContent='Level '+hero.level+' · Skills'+(hero.points?' · '+hero.points+' point'+(hero.points===1?'':'s'):'');openButton.disabled=latest.player.hp<=0;
 xpBar.max=hero.level<CAP?threshold(hero.level+1)-threshold(hero.level):1;xpBar.value=hero.level<CAP?hero.xp-threshold(hero.level):1;
 xpText.textContent=hero.level===CAP?'Maximum combat level':remaining+' XP to next level';
 summary.textContent='Level '+hero.level+' · '+hero.xp+' combat XP · '+hero.points+' skill points · '+hero.kills+' defeated hostiles · '+latest.player.hp+' / '+latest.player.maxHp+' HP';
 for(const node of nodes){const c=cards.get(node.id),rank=hero.ranks[node.id],unlocked=node.requires.every(([key,n])=>hero.ranks[key]>=n);c.article.dataset.learned=String(rank>0);c.name.textContent=node.name+' · '+rank+'/'+node.max;c.requirements.textContent=node.requires.length?'Requires '+node.requires.map(([key,n])=>definitions.get(key).name+' '+n).join(', '):'Starting skill · no prerequisite';c.buy.textContent=rank===node.max?'Mastered':rank?'Upgrade · 1 point':'Learn · 1 point';c.buy.disabled=!ready()||!dialog.open||!unlocked||rank===node.max||hero.points<1;}
 let learned=0;
 powers.forEach((id,i)=>{const b=powerButtons.get(id),rank=hero.ranks[id],wait=Math.max(0,(Number(hero.ready[id])||0)-(Number(latest.turn)||0));b.hidden=!rank;if(rank)learned++;b.textContent=(i+1)+' · '+definitions.get(id).name+'\n'+(wait?wait+' turns':'Ready');b.disabled=!ready()||blocked()||wait>0;b.title=definitions.get(id).text;});
 powerBar.hidden=!learned||latest.player.hp<=0;
}
window.addEventListener('keydown',event=>{
 if(dialog.open){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();dialog.close();}return;}
 if(!['1','2','3','4'].includes(event.key)||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
 const target=event.target;if(target instanceof HTMLElement&&(target.matches('input,textarea,select')||target.isContentEditable))return;
 if(!ready()||blocked())return;event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)cast(powers[Number(event.key)-1]);
},true);
Gulch.register('hero-combat-progression',{snapshot(s){
 const old=latest,reset=old&&(old.revision!==s.revision||epoch(old.gameState)!==epoch(s.gameState));latest=s;
 if(reset){pending=null;signature='';if(dialog.open)dialog.close();notice.hidden=true;}
 const hero=state(s.gameState);
 if(pending&&(s.stateRevision!==pending.base||reset)){
  const request=pending;pending=null;
  say(!reset&&hero.receipt===request.token?request.text:'Room updated. Check skills and cooldowns before trying again.');
 }
 const reward=hero.lastReward;
 if(old&&!reset&&reward?.id&&reward.id!==lastNotice)say(reward.text);
 lastNotice=reward?.id||'';
 if(s.player.hp<=0&&dialog.open)dialog.close();render();
},action(a){if(a?.type==='hero-skills')open();if(a?.type==='hero-power'&&powers.includes(a.id))cast(a.id);}});
window.addEventListener('gulch:recovered',()=>queueMicrotask(()=>{if(pending&&!window.GulchMovementState?.inFlight){pending=null;feedback.textContent='Update finished. Check the confirmed character before retrying.';}render();}));
setInterval(()=>{if(document.hidden)return;const m=window.GulchMovementState,key=[m?.focused,m?.inFlight,Boolean(document.querySelector('dialog[open]')),blocked(),Boolean(pending)].join('|');if(key!==signature){signature=key;render();}},250);
window.addEventListener('load',()=>{const help=document.getElementById('keyHelp');if(help)help.append(el('p','Combat XP: defeat hostiles to level up, gain 4 maximum HP and earn a skill point. Open Level / Skills to learn and upgrade Guardian, Vanguard and Arcanist abilities. Learned powers: 1 Whirlwind, 2 Arc Lance, 3 Second Wind, 4 Starfall. Casts advance enemy turns; cooldowns use played turns. Progress and skills are shared; death does not allow resurrection through leveling.'));},{once:true});
})();
