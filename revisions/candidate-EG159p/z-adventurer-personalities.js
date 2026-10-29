(function(){
'use strict';
const KEY='adventurerLife';
let latest=null,attempt='',installed=false;
const epoch=d=>String(d?.respawnSettings?.token||'original');
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const profiles=[
 {name:'Iona the Wayfarer',trait:'Compassionate protector',courage:78,empathy:92,temper:25,curiosity:60,line:'Nobody should have to walk this road alone.'},
 {name:'Bramble the Seeker',trait:'Curious, anxious optimist',courage:42,empathy:70,temper:18,curiosity:95,line:'I am frightened too. I still want to see what comes next.'},
 {name:'Sable the Veteran',trait:'Proud, guarded survivor',courage:91,empathy:38,temper:77,curiosity:35,line:'Trust is earned by returning when the fighting is over.'}
];
function hostile(e){return e&&e.id!=='player'&&e.faction==='hostile'&&Number.isFinite(e.hp)&&e.hp>0&&!e.practiceTarget&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.loreSpeaker&&!e.ecosystemLoot&&e.itemId==null&&!/loot|item|prop|weapon|armor/i.test(e.kind||'');}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(q=>q.x===x&&q.y===y)&&!map.groundHazards?.cells?.some(q=>q.x===x&&q.y===y)&&!map.sinkingGround?.cells?.some(q=>q.x===x&&q.y===y)&&!map.dynamicRegion?.sites?.some(q=>q.kind==='trap'&&!q.spent&&q.x===x&&q.y===y);}
function adjacent(seed,map,a,b){const dx=b.x-a.x,dy=b.y-a.y;return Math.max(Math.abs(dx),Math.abs(dy))===1&&floor(seed,map,b.x,b.y)&&(!(dx&&dy)||(floor(seed,map,a.x+dx,a.y)&&floor(seed,map,a.x,a.y+dy)));}
function populate(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map.adventurerLifeVersion===1)return data;
 if(map.ascii.reduce((n,r)=>n+r.length,0)>20000)return data;
 const entities=seed.entities.slice(),capacity=Math.max(0,12-entities.filter(e=>e[KEY]).length);
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length&&queue.length<20000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);queue.push({x,y});}}
 const salt=String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':adventurers:'+map.id;
 const spots=queue.filter(q=>Math.hypot(q.x-p.x,q.y-p.y)>=4&&Math.hypot(q.x-p.x,q.y-p.y)<=12&&!entities.some(e=>e.map===map.id&&Math.hypot(e.x-q.x,e.y-q.y)<2)&&entities.every(e=>e.map!==map.id||!hostile(e)||Math.hypot(e.x-q.x,e.y-q.y)>4)).sort((a,b)=>hash(salt+a.x+','+a.y)-hash(salt+b.x+','+b.y));
 let added=0;
 for(let i=0;i<Math.min(3,capacity);i++){
  const q=spots.find(q=>!entities.some(e=>e.map===map.id&&Math.hypot(e.x-q.x,e.y-q.y)<3));if(!q)break;
  const profile=profiles[i];let id='adventurer:'+map.id+':'+i;while(entities.some(e=>e.id===id))id+='x';
  entities.push({id,map:map.id,x:q.x,y:q.y,name:profile.name,kind:'adventurer',faction:'friendly',hp:24,maxHp:24,dialogue:profile.line,[KEY]:{epoch:epoch(data),profile:i,home:{x:q.x,y:q.y},fear:15,hope:70,anger:5,grief:0,trust:30,bond:30,mood:'watchful',thought:profile.line,memories:['Arrived in this region seeking a new adventure.'],battles:0}});added++;
 }
 if(!added&&capacity>0)return data;
 return {...data,seed:{...seed,entities,maps:seed.maps.map(m=>m.id===map.id?{...m,adventurerLifeVersion:1}:m)}};
}
function advance(data,before){
 if(!before||epoch(data)!==epoch(before)||!(Number(data.turn)>Number(before.turn)))return data;
 const seed=data.seed,p=seed.entities.find(e=>e.id==='player'),map=seed.maps.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended)return data;
 let entities=seed.entities.slice();const old=new Map(before.seed.entities.map(e=>[e.id,e]));
 const members=entities.filter(e=>e.map===p.map&&e[KEY]?.epoch===epoch(data)&&e.hp>0).slice(0,12),events=[];
 const replace=e=>{entities=entities.map(v=>v.id===e.id?e:v);};
 function move(e,goal,away){
  const distance=q=>Math.abs(q.x-goal.x)+Math.abs(q.y-goal.y);
  const choices=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).filter(q=>floor(seed,map,q.x,q.y)&&!entities.some(v=>v.id!==e.id&&v.map===e.map&&Math.abs(v.x-q.x)<=(v.enemyVariety==='colossus'?1:0)&&Math.abs(v.y-q.y)<=(v.enemyVariety==='colossus'?1:0)));
  choices.sort((a,b)=>(away?-1:1)*(distance(a)-distance(b))||hash(e.id+':'+a.x+','+a.y)-hash(e.id+':'+b.x+','+b.y));
  const q=choices[0];return q&&(away?distance(q)>distance(e):distance(q)<distance(e))?{...e,...q}:e;
 }
 for(const original of members){
  let e=entities.find(v=>v.id===original.id);if(!e||e.hp<=0)continue;
  const state=e[KEY],profile=profiles[state.profile]||profiles[0],s={...state,memories:(state.memories||[]).slice(0,5)};
  const remember=text=>{s.memories=[text,...s.memories.filter(v=>v!==text)].slice(0,5);};
  const enemies=entities.filter(v=>hostile(v)&&v.map===e.map&&Math.hypot(v.x-e.x,v.y-e.y)<=6).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y)||String(a.id).localeCompare(String(b.id)));
  const friends=members.filter(v=>v.id!==e.id&&Math.hypot(v.x-e.x,v.y-e.y)<=5&&entities.some(q=>q.id===v.id&&q.hp>0));
  const loss=before.seed.entities.some(v=>v[KEY]?.epoch===s.epoch&&v.id!==e.id&&v.map===e.map&&v.hp>0&&Math.hypot(v.x-e.x,v.y-e.y)<=7&&!entities.some(q=>q.id===v.id&&q.hp>0));
  const helped=before.seed.entities.some(v=>hostile(v)&&v.map===e.map&&Math.hypot(v.x-e.x,v.y-e.y)<=4&&Math.max(Math.abs(v.x-(old.get('player')?.x??p.x)),Math.abs(v.y-(old.get('player')?.y??p.y)))<=1&&!entities.some(q=>q.id===v.id&&q.hp>0));
  s.fear=clamp(s.fear+(enemies.length?5+enemies.length*2-profile.courage/20:-4)+(e.hp<e.maxHp*.4?8:0)-(friends.length?3:0));
  s.anger=clamp(s.anger+(enemies.length?profile.temper/20:-3));
  s.hope=clamp(s.hope+(enemies.length?-2:2)+(friends.length?1:0));
  s.grief=clamp(s.grief+(loss?30:-1));s.bond=clamp(s.bond+(friends.length?1:0));
  s.trust=clamp(s.trust+(helped?6:0));
  if(loss){remember('Lost a fellow adventurer nearby.');s.hope=clamp(s.hope-20);}
  if(helped)remember('Saw a nearby threat fall while you fought beside it.');
  const target=enemies.find(v=>adjacent(seed,map,e,v));
  const roll=hash(s.epoch+':'+e.id+':battle:'+data.turn)%100;
  let fighting=false;
  if(target&&roll<20){
   fighting=true;const damage=profile.temper>60?4:3,hp=Math.max(0,target.hp-damage);
   replace({...target,hp});s.battles=Math.min(100000,(s.battles||0)+1);s.anger=clamp(s.anger+7);
   remember((hp?'Exchanged blows with ':'Defeated ')+(target.name||'an enemy')+'.');
   events.push(e.name+' strikes '+(target.name||'an enemy')+' for '+damage+'.');
   if(hp>0){const retaliation=target.enemyVariety==='colossus'?8:target.dreadBeast?6:target.enemyVariety==='brute'?4:2;e={...e,hp:Math.max(0,e.hp-retaliation)};s.fear=clamp(s.fear+12);events.push((target.name||'Enemy')+' retaliates against '+e.name+' for '+retaliation+'.');}
   else{s.hope=clamp(s.hope+10);s.fear=clamp(s.fear-8);}
  }
  const retreat=e.hp<e.maxHp*.35||s.fear>80;
  if(!fighting&&enemies.length){if(retreat)e=move(e,enemies[0],true);else if(profile.courage+s.anger>s.fear+45)e=move(e,enemies[0],false);}
  else if(!fighting&&!enemies.length){
   if(Number(data.turn)%5===0)e={...e,hp:Math.min(e.maxHp,e.hp+1)};
   if(Number(data.turn)%2===0){const phase=hash(e.id+':trail:'+Math.floor(Number(data.turn)/8)),r=profile.curiosity>80?6:4;e=move(e,{x:s.home.x+(phase%(2*r+1))-r,y:s.home.y+((phase>>>8)%(2*r+1))-r},false);}
  }
  s.mood=e.hp<=0?'fallen':fighting?'embattled':retreat&&enemies.length?'afraid':s.grief>20?'grieving':s.anger>50?'defiant':friends.length&&s.bond>45?'connected':s.hope>65?'hopeful':'reflective';
  const thoughts={fallen:'My journey ends here. May the others find shelter.',embattled:'Hold your ground. Someone is counting on us.',afraid:'I want to help, but I need to survive this.',grieving:'I keep expecting to hear their footsteps behind me.',defiant:'I have lost enough to these creatures.',connected:'Their company makes this wilderness feel less empty.',hopeful:profile.curiosity>80?'Perhaps the next bend holds something wonderful.':'There is still good worth protecting out here.',reflective:profile.line};
  s.thought=thoughts[s.mood];
  e={...e,[KEY]:s,dialogue:profile.trait+'. “'+s.thought+'” '+(s.trust>=60?'I trust you to stand with us.':'We are still learning to trust one another.')};
  replace(e);
  if(e.hp<=0)events.push(e.name+' falls in battle.');
 }
 return {...data,seed:{...seed,entities},adventurerBattles:{epoch:epoch(data),turn:data.turn,events:events.slice(-12)}};
}
function transform(data){let next=advance(data,latest?.gameState);next=populate(next);return new TextEncoder().encode(JSON.stringify(next)).length<=350000?next:data;}
const host=document.getElementById('left');if(!host)return;
const button=document.createElement('button');button.type='button';button.id='adventurerJournalToggle';button.textContent='Adventurers';button.setAttribute('aria-haspopup','dialog');
const dialog=document.createElement('dialog');dialog.id='adventurerJournal';dialog.setAttribute('aria-labelledby','adventurerJournalTitle');
const title=document.createElement('h2');title.id='adventurerJournalTitle';title.textContent='Fellow adventurers';
const intro=document.createElement('p');intro.textContent='Each adventurer has a 20% attack chance per played turn when beside an enemy. A surviving enemy immediately retaliates against that adventurer. Personality, injuries, fear and companionship shape their choices. Safe rest slowly restores their health. Menus do not advance their lives.';
const list=document.createElement('div'),close=document.createElement('button');close.type='button';close.textContent='Return to expedition';close.addEventListener('click',()=>dialog.close());dialog.append(title,intro,list,close);document.body.append(dialog);host.append(button);
const style=document.createElement('style');style.textContent='#adventurerJournalToggle{position:absolute;left:12px;top:252px;z-index:5;padding:8px 10px;min-height:40px;border:1px solid #819777;border-radius:5px;background:#142b2d;color:#eed8aa;font:11px monospace}#adventurerJournal{width:min(650px,calc(100% - 24px));max-height:85vh;overflow:auto;background:#10252b;color:#dce6d5;border:3px double #b7a278;padding:20px;font:12px/1.65 monospace}#adventurerJournal::backdrop{background:#040d16bb}#adventurerJournal h2,#adventurerJournal h3{color:#f0d69d}#adventurerJournal article{border-top:1px solid #537367;padding:12px 0}#adventurerJournal button{min-height:44px;padding:9px 14px;background:#284536;color:#ffe2ae;border:1px solid #91a47e}#adventurerJournal :focus-visible,#adventurerJournalToggle:focus-visible{outline:2px solid #ffe2ae;outline-offset:3px}';document.head.append(style);
function paragraph(parent,text){const p=document.createElement('p');p.textContent=text;parent.append(p);}
function render(){
 button.disabled=!latest||latest.player.hp<=0;if(!dialog.open||!latest)return;
 list.replaceChildren();const members=latest.seed.entities.filter(e=>e[KEY]?.epoch===epoch(latest.gameState)&&e.map===latest.mapId&&latest.lit[e.y]?.[e.x]===1);
 for(const e of members){const s=e[KEY],profile=profiles[s.profile]||profiles[0],article=document.createElement('article'),h=document.createElement('h3');h.textContent=e.name+' · '+e.hp+'/'+e.maxHp+' HP';article.append(h);paragraph(article,profile.trait+' · '+s.mood+' · '+e.x+', '+e.y);paragraph(article,'“'+s.thought+'”');paragraph(article,'Fear '+s.fear+' · Hope '+s.hope+' · Anger '+s.anger+' · Grief '+s.grief+' · Trust '+s.trust+' · Companionship '+s.bond);paragraph(article,'Battles joined: '+s.battles);for(const text of s.memories||[])paragraph(article,'Memory: '+text);list.append(article);}
 if(!members.length)paragraph(list,'No fellow adventurers in sight. Explore nearby safe paths.');
}
button.addEventListener('click',()=>{if(!latest||latest.player.hp<=0||document.querySelector('dialog[open]'))return;Gulch.setMovement(0,0);dialog.showModal();render();close.focus();});
dialog.addEventListener('close',()=>{if(!button.disabled&&!button.closest('[inert]'))button.focus({preventScroll:true});});
window.addEventListener('keydown',event=>{if(!dialog.open)return;if(event.key==='Escape'){event.preventDefault();dialog.close();}if(event.key!=='Tab'&&event.key!=='Enter'&&event.key!==' ')event.stopImmediatePropagation();},true);
function setup(){if(!installed||!latest||document.hidden||window.GulchMovementState?.inFlight)return;const key=latest.revision+':'+latest.stateRevision+':'+epoch(latest.gameState);if(key===attempt)return;const next=populate(latest.gameState);if(next===latest.gameState)return;attempt=key;Gulch.commit(next,'Fellow adventurers arrive with their own hopes, fears and stories.');}
Gulch.register('adventurer-personalities',{snapshot(s){const reset=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;if((reset||s.player.hp<=0)&&dialog.open)dialog.close();render();setup();}});
function install(){if(installed)return;installed=true;const commit=Gulch.commit;Gulch.commit=function(data,activity,options){if(!data?.seed||window.GulchMovementState?.inFlight)return commit.call(this,data,activity,options);const next=transform(data);return commit.call(this,next,activity,options);};setup();}
if(document.readyState==='complete')install();else window.addEventListener('load',install,{once:true});
window.addEventListener('gulch:recovered',()=>queueMicrotask(setup));
})();
