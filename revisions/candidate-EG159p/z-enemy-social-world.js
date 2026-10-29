(function(){
'use strict';
const KEY='enemySocialLife';
let latest=null,installed=false,output=null;
const epoch=d=>String(d?.respawnSettings?.token||'original');
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function enemy(e){return e&&e.id!=='player'&&e.faction==='hostile'&&Number.isFinite(e.hp)&&e.hp>0&&!e.practiceTarget&&!e.isPlayer&&!e.playerId&&!e.clientId&&!e.ownerId&&!e.loreSpeaker&&!e.swordQuestLandmark&&!e.ecosystemLoot&&e.itemId==null&&e.caveEncounter===1;}
function species(e){return e.dreadBeast?'dreadmaw':e.enemyVariety||e.caveSprite||'crawler';}
function solitary(e){return e.dreadBeast||e.enemyVariety==='colossus';}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(q=>q.x===x&&q.y===y)&&!map.groundHazards?.cells?.some(q=>q.x===x&&q.y===y)&&!map.sinkingGround?.cells?.some(q=>q.x===x&&q.y===y)&&!map.dynamicRegion?.sites?.some(q=>q.kind==='trap'&&!q.spent&&q.x===x&&q.y===y);}
function bounded(data){return new TextEncoder().encode(JSON.stringify(data)).length<=350000;}
function populate(data){
 if(!data?.seed||data.gulchPermanentGameOver?.ended)return data;
 const p=data.seed.entities.find(e=>e.id==='player');if(!p||p.hp<=0)return data;
 const token=epoch(data),unassigned=data.seed.entities.filter(e=>enemy(e)&&e.map===p.map&&e[KEY]?.epoch!==token);
 if(!unassigned.length)return data;
 unassigned.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const updates=new Map();
 const used=new Set();
 for(const e of unassigned){
  if(used.has(e.id))continue;
  const kind=species(e),roll=hash(token+':family:'+e.id),family=!solitary(e)&&roll%100<65;
  const relatives=family?unassigned.filter(q=>q.id!==e.id&&!used.has(q.id)&&!solitary(q)&&species(q)===kind&&Math.hypot(q.x-e.x,q.y-e.y)<=10).slice(0,2):[];
  const members=[e,...relatives],isFamily=members.length>1,group=String(e.id),clan=hash(token+':clan:'+kind)%3;
  const home={x:e.x,y:e.y};
  members.forEach((q,i)=>{
   used.add(q.id);
   updates.set(q.id,{...q,[KEY]:{epoch:token,group,clan,home,role:isFamily?(i===0?'guardian':i===1?'young':'forager'):'wanderer',family:isFamily,beat:0,mood:'watching',alarm:0}});
  });
 }
 if(!updates.size)return data;
 const next={...data,seed:{...data.seed,entities:data.seed.entities.map(e=>updates.get(e.id)||e)}};
 return bounded(next)?next:data;
}
function advance(seed,base){
 const p=seed.entities.find(e=>e.id==='player');if(!p||p.hp<=0)return base(seed);
 const map=seed.maps.find(m=>m.id===p.map);if(!map)return base(seed);
 const active=seed.entities.filter(e=>enemy(e)&&e.map===p.map&&e[KEY]).slice(0,64);
 if(!active.length)return base(seed);
 const before=new Set(seed.entities.map(e=>e.id));
 const previousById=new Map();
 if(latest)for(const e of latest.seed.entities)if(!previousById.has(e.id))previousById.set(e.id,e);
 const threats=new Set(),alarmGroups=new Set();
 for(const e of active){
  const s=e[KEY];
  if(Math.hypot(e.x-p.x,e.y-p.y)<=4)threats.add(e.id);
  if(latest&&epoch(latest.gameState)===s.epoch){const old=previousById.get(e.id);if(old&&old.hp>e.hp)alarmGroups.add(s.group);}
 }
 if(latest){
  for(const e of latest.seed.entities){
   if(!enemy(e)||e.map!==p.map||!e[KEY]||e[KEY].epoch!==epoch(latest.gameState))continue;
   if(!before.has(e.id))alarmGroups.add(e[KEY].group);
  }
 }
 const social=new Set(active.filter(e=>!solitary(e)&&!e.enemyIntent&&!e.enemyRecovery&&!threats.has(e.id)&&!alarmGroups.has(e[KEY].group)&&!e[KEY].alarm).map(e=>e.id));
 // Idle creatures skip pursuit; alerted creatures retain the existing attacks and tells.
 const result=base({...seed,entities:seed.entities.map(e=>social.has(e.id)?{...e,caveEncounter:0}:e)});
 const entities=result.entities.map(e=>social.has(e.id)?{...e,caveEncounter:1}:e);
 const player=entities.find(e=>e.id==='player');if(!player||player.hp<=0)return {...result,entities};
 const events=[],byId=new Map(),groups=new Map(),tiles=new Map();
 function bucket(e){return Math.floor(e.x)+','+Math.floor(e.y);}
 function groupAdd(e,i){
  const key=e[KEY]?.group;
  let members=groups.get(key);if(!members){members=new Set();groups.set(key,members);}members.add(i);
 }
 function tileAdd(e,i){
  if(e.map!==p.map)return;
  const key=bucket(e);let members=tiles.get(key);
  if(!members){members=new Set();tiles.set(key,members);}members.add(i);
 }
 for(let i=0;i<entities.length;i++){
  const e=entities[i];let indices=byId.get(e.id);
  if(!indices){indices=[];byId.set(e.id,indices);}indices.push(i);
  groupAdd(e,i);tileAdd(e,i);
 }
 function first(id){const indices=byId.get(id);return indices?entities[indices[0]]:undefined;}
 function replace(e){
  for(const i of byId.get(e.id)||[]){
   const old=entities[i];
   if(old.map!==e.map||old.x!==e.x||old.y!==e.y){
    if(old.map===p.map){const key=bucket(old),members=tiles.get(key);members?.delete(i);if(members&&!members.size)tiles.delete(key);}
    tileAdd(e,i);
   }
   if(old[KEY]?.group!==e[KEY]?.group){groups.get(old[KEY]?.group)?.delete(i);groupAdd(e,i);}
   entities[i]=e;
  }
 }
 function local(x,y,radius,visit){
  for(let yy=Math.floor(y-radius);yy<=Math.floor(y+radius);yy++)for(let xx=Math.floor(x-radius);xx<=Math.floor(x+radius);xx++){
   const members=tiles.get(xx+','+yy);if(!members)continue;
   for(const i of members)if(visit(entities[i],i))return true;
  }
  return false;
 }
 function safe(e,x,y){
  const radius=e.enemyVariety==='colossus'?1:0;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const tx=x+dx,ty=y+dy;
   if(!floor(seed,map,tx,ty))return false;
   if(local(tx,ty,1,q=>q.id!==e.id&&q.map===p.map&&Math.abs(q.x-tx)<=(q.enemyVariety==='colossus'?1:0)&&Math.abs(q.y-ty)<=(q.enemyVariety==='colossus'?1:0)))return false;
  }
  return true;
 }
 function step(e,goal,retreat){
  const options=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).filter(q=>safe(e,q.x,q.y));
  const distance=q=>Math.abs(q.x-goal.x)+Math.abs(q.y-goal.y);
  options.sort((a,b)=>(retreat?-1:1)*(distance(a)-distance(b))||hash(e.id+':'+a.x+','+a.y)-hash(e.id+':'+b.x+','+b.y));
  const q=options[0];return q&& (retreat?distance(q)>distance(e):distance(q)<distance(e))?{...e,...q}:e;
 }
 for(const original of active){
  let e=first(original.id);if(!enemy(e))continue;
  const s=e[KEY],beat=(s.beat+1)%100000,alarm=alarmGroups.has(s.group)?4:Math.max(0,(s.alarm||0)-1),roll=hash(s.epoch+':'+e.id+':'+beat);
  let mood=e.enemyIntent?'winding up':e.enemyRecovery?'recovering':threats.has(e.id)||alarm?'defending territory':'watching';
  if(social.has(e.id)){
   const wounded=e.hp/e.maxHp<.3;
   let guardian=null,vulnerable=null,guardianIndex=Infinity,vulnerableIndex=Infinity;
   for(const i of groups.get(s.group)||[]){
    const q=entities[i];
    if(!enemy(q)||q.map!==e.map||q[KEY]?.group!==s.group||q.id===e.id)continue;
    if(q[KEY].role==='guardian'&&i<guardianIndex){guardian=q;guardianIndex=i;}
    if((q[KEY].role==='young'||q.hp/q.maxHp<.5)&&i<vulnerableIndex){vulnerable=q;vulnerableIndex=i;}
   }
   if(wounded){mood='retreating home';e=step(e,s.home,false);}
   else if(s.role==='young'&&guardian&&Math.hypot(e.x-guardian.x,e.y-guardian.y)>3){mood='following family';e=step(e,guardian,false);}
   else if(s.role==='guardian'&&vulnerable&&Math.hypot(e.x-vulnerable.x,e.y-vulnerable.y)>4){mood='guarding family';e=step(e,vulnerable,false);}
   else if(beat%12<3){mood='resting';}
   else if(beat%2===0){
    mood='foraging';
    const phase=Math.floor(beat/6),r=hash(s.group+':trail:'+phase),goal={x:s.home.x+(r%9)-4,y:s.home.y+((r>>>8)%9)-4};
    e=step(e,goal,false);
   }else mood='listening';
  }
  e={...e,[KEY]:{...s,beat,mood,alarm}};replace(e);
 }
 const fought=new Set();
 for(const original of active){
  let a=first(original.id);if(!enemy(a)||fought.has(a.id)||a.enemyIntent||a.enemyRecovery||Math.hypot(a.x-p.x,a.y-p.y)<=2)continue;
  const s=a[KEY],rivals=[];
  local(a.x,a.y,1,(b,i)=>{
   if(enemy(b)&&b.map===a.map&&!fought.has(b.id)&&b[KEY]&&b[KEY].group!==s.group&&b[KEY].clan!==s.clan&&!b.enemyIntent&&!b.enemyRecovery&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1&&Math.hypot(b.x-p.x,b.y-p.y)>2)rivals.push(i);
   return false;
  });
  rivals.sort((i,j)=>String(entities[i].id).localeCompare(String(entities[j].id))||i-j);
  const b=rivals.length?entities[rivals[0]]:null;if(!b)continue;
  const pair=[String(a.id),String(b.id)].sort().join('|');
  if(hash(s.epoch+':skirmish:'+pair+':'+s.beat)%100>=30)continue;
  fought.add(a.id);fought.add(b.id);
  const strength=e=>solitary(e)?4:e.enemyVariety==='brute'?3:e[KEY].role==='young'?1:2;
  const ahp=Math.max(0,a.hp-strength(b)),bhp=Math.max(0,b.hp-strength(a));
  replace({...a,hp:ahp,[KEY]:{...s,mood:ahp?'fighting a rival':'fallen',alarm:3}});
  replace({...b,hp:bhp,[KEY]:{...b[KEY],mood:bhp?'fighting a rival':'fallen',alarm:3}});
  events.push({a:a.id,b:b.id,x:a.x,y:a.y,text:String(a.name||'Creature')+' and '+String(b.name||'creature')+' clash over territory.'});
 }
 return {...result,entities,enemySocialEvents:{turn:Number(latest?.turn||0)+1,events:events.slice(0,8)}};
}
function render(){
 if(!output||!latest||!output.parentElement.open)return;
 const p=latest.player,rows=latest.seed.entities.filter(e=>enemy(e)&&e.map===p.map&&e[KEY]&&latest.lit[e.y]?.[e.x]===1);
 output.replaceChildren();
 for(const e of rows.slice(0,20)){
  const s=e[KEY],family=latest.seed.entities.filter(q=>enemy(q)&&q.map===e.map&&q[KEY]?.group===s.group),line=document.createElement('li');
  line.textContent=(e.name||e.id)+' · '+(s.family?s.role+' · '+family.length+' family members remaining':'solitary wanderer')+' · '+s.mood+' · '+e.x+', '+e.y;
  output.append(line);
 }
 if(!rows.length){const line=document.createElement('li');line.textContent='No creature groups currently in sight.';output.append(line);}
 const events=latest.seed.enemySocialEvents;
 if(events?.turn===Number(latest.turn))for(const event of events.events||[]){if(latest.lit[event.y]?.[event.x]!==1)continue;const line=document.createElement('li');line.textContent=event.text;output.append(line);}
}
Gulch.register('enemy-social-world',{snapshot(s){latest=s;render();}});
function install(){
 if(installed)return;installed=true;
 const cave=window.GulchCaveEnemies;
 if(cave?.advance)window.GulchCaveEnemies=Object.freeze({...cave,advance(seed){return advance(seed,cave.advance);}});
 const commit=Gulch.commit;
 Gulch.commit=function(data,activity,options){return commit.call(this,populate(data),activity,options);};
 const host=document.getElementById('livingPanel')||document.getElementById('keyHelp');
 if(host){
  const section=document.createElement('details'),title=document.createElement('summary'),text=document.createElement('p');
  title.textContent='Creature families & rival territories';
  text.textContent='Some nearby creatures of the same kind form families: guardians stay near young and foragers. Away from danger they roam local trails, listen and rest. Injured wanderers return toward their home. Attacks or a family death alert surviving relatives for several turns. Giants remain solitary. Adjacent rival clans away from you have a 30% chance per played turn to exchange blows; family members never fight each other. Existing attack warnings and player combat remain active. Menus do not advance these routines.';
  output=document.createElement('ul');section.append(title,text,output);host.append(section);section.addEventListener('toggle',render);render();
 }
}
if(document.readyState==='complete')install();else window.addEventListener('load',install,{once:true});
})();
