(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
const KEY='dynamicAtlas',VERSION=1,baseCommit=Gulch.commit;
let latest=null,attempt=null,pending=null,notice='',previousFocus=null;
const climates=[
 {id:'frost',name:'Frostglass Tundra',temperature:-18,tint:'#b9ddeb',weather:['snow','snow','clear'],description:'Snowfields, blue ice and buried stone shelters.'},
 {id:'desert',name:'Saffron Dunes',temperature:38,tint:'#e4b66a',weather:['dust','clear','dust'],description:'Sun-baked dunes and old caravan refuges.'},
 {id:'marsh',name:'The Violet Fen',temperature:17,tint:'#9476af',weather:['fog','rain','fog'],description:'Purple reeds, rain-dark pools and misty crossings.'},
 {id:'autumn',name:'Copperleaf Vale',temperature:12,tint:'#cf894d',weather:['leaves','rain','clear'],description:'Copper foliage, fallen leaves and woodland settlements.'},
 {id:'volcanic',name:'Cinder Highlands',temperature:34,tint:'#ac6553',weather:['ash','ash','clear'],description:'Ash-covered rock, ember-colored ridges and isolated shelters.'},
 {id:'coast',name:'Pearlwater Coast',temperature:23,tint:'#75c7c5',weather:['rain','clear','fog'],description:'Salt-white stones and turquoise waters beside trading posts.'}
];
const seasons=['Spring','Summer','Autumn','Winter'];
function hash(value){let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function rng(value){let h=hash(value);return ()=>{h=(h+0x6d2b79f5)|0;let t=Math.imul(h^(h>>>15),h|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function epoch(data){return String(data.respawnSettings?.token||'original');}
function atlas(data){const a=data[KEY];return a?.epoch===epoch(data)?{...a,charts:Array.isArray(a.charts)?a.charts.slice(-32):[]}:{epoch:epoch(data),charts:[]};}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
function reach(seed,map,p){const list=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);for(let i=0;i<list.length&&list.length<12000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=list[i].x+dx,y=list[i].y+dy,k=x+','+y;if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);list.push({x,y});}}return list;}
function budget(data){return new TextEncoder().encode(JSON.stringify(data)).length<330000;}
function terrainSymbol(legend,kind,material){let c=Object.keys(legend).find(k=>k.length===1&&legend[k]?.[0]===kind&&legend[k]?.[1]===material&&!['#','~','>'].includes(k));if(c)return c;for(let i=0xe400;i<0xf800;i++){c=String.fromCharCode(i);if(!Object.prototype.hasOwnProperty.call(legend,c)){legend[c]=[kind,material];return c;}}throw new Error('Terrain symbol space exhausted.');}
function decorate(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map.dynamicRegion?.version===VERSION)return data;
 const cell=map.infiniteCell,root=String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch');
 const key=root+':'+(cell?cell.realm:map.id),random=rng(key+':'+(cell?cell.x+','+cell.y:map.id));
 const underground=Boolean(map.secretCave)||/cavern|underground|dungeon|grotto|mine/i.test([map.biome,map.name].join(' '));
 const index=cell?((hash(key)%6+cell.x+cell.y*3)%6+6)%6:hash(key)%6;
 const climate=climates[index],legend={...seed.legend};
 const materials=underground?['stone','fungus']:climate.id==='frost'?['stone','fungus']:climate.id==='desert'?['soil','stone']:climate.id==='marsh'?['fungus','tree']:climate.id==='autumn'?['soil','tree']:climate.id==='volcanic'?['stone','soil']:['soil','grass'];
 const symbols=materials.map(m=>terrainSymbol(legend,'floor',m));
 const protectedTiles=new Set(seed.entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
 (map.exits||[]).forEach(e=>protectedTiles.add(e.x+','+e.y));
 const rows=map.ascii.map((row,y)=>Array.from(row,(c,x)=>{
  const material=seed.legend[c]?.[1];
  if(protectedTiles.has(x+','+y)||c==='>'||!floor(seed,map,x,y)||['wood','plank'].includes(material))return c;
  const n=hash(key+':ground:'+x+':'+y)%100;
  return n<72?symbols[n%7===0?1:0]:c;
 }).join(''));
 const working={...map,ascii:rows},places=reach({...seed,legend},working,p);
 const used=new Set(protectedTiles),sites=[],entities=seed.entities.slice(),ids=new Set(entities.map(e=>e.id));
 const refuges=entities.filter(e=>e.map===map.id&&(e.townRefuge||e.outsideNPC||e.swordQuestLandmark));
 const candidates=places.filter(q=>Math.hypot(q.x-p.x,q.y-p.y)>5&&!used.has(q.x+','+q.y)&&working.ascii[q.y][q.x]!=='>'&&(map.exits||[]).every(e=>Math.hypot(q.x-e.x,q.y-e.y)>3));
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 function spot(safe){const i=candidates.findIndex(q=>!used.has(q.x+','+q.y)&&(!safe||refuges.every(e=>Math.hypot(q.x-e.x,q.y-e.y)>5)));if(i<0)return null;const q=candidates.splice(i,1)[0];used.add(q.x+','+q.y);return q;}
 let serial=0;
 function id(){let value='atlas:'+map.id+':'+serial++;while(ids.has(value))value+='x';ids.add(value);return value;}
 function add(q,values){entities.push({id:id(),map:map.id,...q,...values});}
 if(!underground){
  const q=spot(false);
  if(q){add(q,{name:climate.name+' waystation',kind:'villager',outsideNPC:true,faction:'friendly',dialogue:'Search near unusual stones for hidden passages. A sealed chart marks a buried cache in this region. Town refuges offer shelter; inspect your surroundings before stepping off the road.'});}
 }
 for(let i=0;i<(underground?2:4);i++){const q=spot(false);if(!q)break;add(q,{name:underground?'Forgotten cave coffer':'Lost traveler’s chest',kind:'loot',ecosystemLoot:true,glyph:'▣',color:'#f1cf78',contents:i%2?{image_coin:2,image_red_potion:1}:{image_silver_bar:1,relic:1}});}
 const chart=spot(false),cache=spot(false);
 if(chart&&cache){add(chart,{name:'Sealed explorer’s map',kind:'prop',atlasChart:true,glyph:'▱',color:'#ffe4a5',dialogue:'Stand beside this sealed map and read it in Explore.'});sites.push({id:'buried',kind:'cache',...cache,found:false,claimed:false});}
 if(!underground){const q=spot(false);if(q)sites.push({id:'passage',kind:'cave',...q,found:false});}
 const trapCount=underground?3:Math.min(6,Math.floor(places.length/180));
 for(let i=0;i<trapCount;i++){const q=spot(true);if(q)sites.push({id:'trap-'+i,kind:'trap',...q,found:false,spent:false,damage:climate.id==='volcanic'?3:2});}
 const region={version:VERSION,index,underground,phase:hash(key+':season')%4,sites};
 const next={...data,seed:{...seed,legend,entities,maps:seed.maps.map(m=>m.id===map.id?{...working,dynamicRegion:region}:m)},[KEY]:atlas(data)};
 return budget(next)?next:data;
}
function trigger(data){
 if(!latest||epoch(data)!==epoch(latest.gameState)||!(Number(data.turn)>Number(latest.turn)))return data;
 const p=data.seed.entities.find(e=>e.id==='player'),old=latest.player;
 if(!p||p.hp<=0||(p.map===old.map&&p.x===old.x&&p.y===old.y))return data;
 const map=data.seed.maps.find(m=>m.id===p.map),region=map?.dynamicRegion;
 const trap=region?.sites.find(s=>s.kind==='trap'&&!s.spent&&s.x===p.x&&s.y===p.y);
 if(!trap)return data;
 const receipt={id:String(latest.stateRevision)+':'+trap.id,map:p.map,text:'A concealed trap strikes for '+trap.damage+' base damage. Search nearby ground to reveal other hazards.'};
 return {...data,atlasHazard:receipt,seed:{...data.seed,entities:data.seed.entities.map(e=>e.id==='player'?{...e,hp:Math.max(0,e.hp-trap.damage)}:e),maps:data.seed.maps.map(m=>m.id===map.id?{...m,dynamicRegion:{...region,sites:region.sites.map(s=>s.id===trap.id?{...s,found:true,spent:true}:s)}}:m)}};
}
Gulch.commit=function(data,activity){if(!data?.seed)return baseCommit(data,activity);const enriched=decorate(data),next=trigger(enriched);return baseCommit(next,(activity||'')+(next!==enriched?' '+next.atlasHazard.text:''));};
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=node('style');style.textContent=`
#atlasToggle{position:absolute;left:12px;top:108px;z-index:5;min-height:40px;padding:8px 11px;background:#10252be8;color:#e9dbb7;border:1px solid #7a9580;border-radius:6px;font:11px monospace}
#atlasPanel[hidden]{display:none!important}#atlasPanel{position:absolute;left:12px;top:154px;z-index:8;width:min(360px,calc(100% - 24px));max-height:calc(100% - 175px);overflow:auto;background:#0c2027f5;border:1px solid #8a9f83;border-radius:9px;padding:15px;color:#dce6d6;font:12px/1.6 monospace;box-shadow:0 10px 35px #0007}
#atlasPanel header{display:flex;justify-content:space-between;gap:10px;align-items:center}#atlasPanel h2{margin:0;font-size:15px;color:#f0d49d}#atlasPanel p{margin:9px 0}#atlasPanel button{min-height:40px;border:1px solid #6c8878;border-radius:5px;background:#203b37;color:#f0dfb9;padding:8px;font:inherit}#atlasPanel button:disabled{opacity:.45}#atlasPanel .atlas-actions{display:grid;gap:7px}#atlasPanel ul{padding-left:18px}#atlasPanel :focus-visible,#atlasToggle:focus-visible{outline:2px solid #f0d49d;outline-offset:2px}#atlasStatus{color:#f3d29b}#atlasWeather{position:absolute;inset:0;pointer-events:none;z-index:1}
@media(max-width:700px){#atlasToggle{left:8px;top:100px}#atlasPanel{left:8px;top:146px;max-height:calc(100% - 160px)}}
`;document.head.append(style);
const toggle=node('button','Explore');toggle.id='atlasToggle';toggle.type='button';toggle.setAttribute('aria-controls','atlasPanel');toggle.setAttribute('aria-expanded','false');
const panel=node('section');panel.id='atlasPanel';panel.hidden=true;panel.setAttribute('aria-label','Regional exploration');
const header=node('header'),title=node('h2','REGIONAL EXPLORATION'),close=node('button','Close');close.type='button';header.append(title,close);
const climateText=node('p'),description=node('p'),actions=node('div');actions.className='atlas-actions';
const status=node('p');status.id='atlasStatus';status.setAttribute('role','status');
const clues=node('ul'),help=node('p','Search reveals secrets within two tiles without advancing time. Traps hurt on entry; disarm revealed traps from beside them. Read explorer maps to locate buried treasure. Weather changes every 12 turns and seasons every 48 turns.');
const controls={};
for(const [key,label] of [['search','Search nearby ground'],['chart','Read nearby secret map'],['dig','Recover marked treasure'],['disarm','Disarm adjacent trap'],['cave','Enter hidden cave']]){const b=node('button',label);b.type='button';b.addEventListener('click',()=>act(key));actions.append(b);controls[key]=b;}
panel.append(header,climateText,description,actions,status,clues,help);host.append(toggle,panel);
function show(open){if(open)previousFocus=document.activeElement;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open){render();close.focus();}else(previousFocus?.isConnected?previousFocus:toggle).focus();}
toggle.addEventListener('click',()=>show(panel.hidden));close.addEventListener('click',()=>show(false));
panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();show(false);}});
function mapNow(){return latest?.seed.maps.find(m=>m.id===latest.mapId);}
function near(s,r=1){const p=latest.player;return Math.abs(p.x-s.x)+Math.abs(p.y-s.y)<=r;}
function blocked(){return ['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function ready(){return latest&&latest.player.hp>0&&window.GulchMovementState?.focused&&!window.GulchMovementState.inFlight&&!pending&&!blocked();}
function condition(){const map=mapNow(),r=map?.dynamicRegion;if(!r)return null;const c=climates[r.index],turn=Math.max(0,Number(latest.turn)||0),season=(Math.floor(turn/48)+r.phase)%4;let weather=r.underground?'motes':c.weather[(Math.floor(turn/12)+r.phase)%c.weather.length];if(!r.underground&&season===3&&c.temperature<25)weather='snow';return {c,r,season,weather,temp:r.underground?9:c.temperature+[0,8,-4,-12][season]};}
function buildCave(data,map,site){
 const existing=site.destination&&data.seed.maps.find(m=>m.id===site.destination);
 if(existing)return {seed:{...data.seed,entities:data.seed.entities.map(e=>e.id==='player'?{...e,map:existing.id,x:3,y:3}:e)},destination:existing.id};
 if(data.seed.maps.filter(m=>m.secretCave).length>=6)throw new Error('Six secret caves are already charted. Explore those passages before starting a new expedition.');
 const legend={...data.seed.legend},stone=terrainSymbol(legend,'floor','stone'),wall=terrainSymbol(legend,'wall','stone'),fungus=terrainSymbol(legend,'floor','fungus');
 let id='secret:'+map.id;while(data.seed.maps.some(m=>m.id===id))id+='x';
 const grid=Array.from({length:25},()=>Array(37).fill(wall)),random=rng(id+':'+epoch(data));
 function room(x,y,w,h){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)grid[yy][xx]=random()<.2?fungus:stone;}
 room(1,1,8,7);room(13,3,10,9);room(26,14,9,9);room(7,16,12,7);
 for(let x=3;x<=30;x++)grid[5][x]=stone;
 for(let y=5;y<=19;y++)grid[y][30]=stone;
 for(let x=12;x<=30;x++)grid[19][x]=stone;
 grid[3][3]='>';
 const cave={id,name:climates[map.dynamicRegion.index].name+' · Hidden vault',biome:'underground',secretCave:true,ascii:grid.map(r=>r.join('')),exits:[{x:3,y:3,to:map.id,at:{x:site.x,y:site.y}}]};
 const entities=data.seed.entities.map(e=>e.id==='player'?{...e,map:id,x:3,y:3}:e),ids=new Set(entities.map(e=>e.id));
 function add(key,values){let eid=id+':'+key;while(ids.has(eid))eid+='x';ids.add(eid);entities.push({id:eid,map:id,...values});}
 add('guardian',{name:'Vault sentinel',kind:'cave-creature',faction:'hostile',caveEncounter:1,caveSprite:'wisp',x:28,y:18,hp:12,maxHp:12,glyph:' '});
 add('treasure',{name:'Hidden vault treasury',kind:'loot',ecosystemLoot:true,x:32,y:20,glyph:'▣',color:'#ffdb82',contents:{image_gold_bar:3,image_ruby:1,image_red_potion:2,relic:2}});
 return {destination:id,seed:{...data.seed,legend,entities,maps:[...data.seed.maps,cave]}};
}
function act(kind){
 if(!ready())return;
 const map=mapNow(),r=map?.dynamicRegion;if(!r)return;
 let data=latest.gameState,seed=data.seed,sites=r.sites.map(s=>({...s})),a=atlas(data),text='';
 try{
 if(kind==='search'){
  const found=sites.filter(s=>!s.found&&near(s,2));
  if(!found.length){notice='No hidden signs within two tiles. Explore further or find an explorer’s map.';render();return;}
  found.forEach(s=>{s.found=true;});text='Discovered '+found.map(s=>s.kind==='cave'?'a hidden cave':s.kind==='trap'?'a concealed trap':'buried treasure').join(', ')+'.';
 }else if(kind==='chart'){
  const chart=seed.entities.find(e=>e.map===map.id&&e.atlasChart&&near(e));
  if(!chart)return;
  const cache=sites.find(s=>s.kind==='cache');if(!cache)return;
  cache.found=true;
  a.charts=[...a.charts.filter(c=>c.map!==map.id),{map:map.id,name:map.name||map.id,x:cache.x,y:cache.y}].slice(-32);
  seed={...seed,entities:seed.entities.filter(e=>e.id!==chart.id)};
  text='Secret map decoded: buried treasure at '+cache.x+', '+cache.y+'. The location is saved in Explore.';
 }else if(kind==='dig'){
  const cache=sites.find(s=>s.kind==='cache'&&s.found&&!s.claimed&&near(s));if(!cache)return;
  cache.claimed=true;
  let id='atlas-cache:'+map.id;while(seed.entities.some(e=>e.id===id))id+='x';
  seed={...seed,entities:[...seed.entities,{id,name:'Unearthed explorer’s treasure',map:map.id,x:cache.x,y:cache.y,kind:'loot',ecosystemLoot:true,glyph:'▣',color:'#ffe094',contents:{image_gold_bar:2,image_emerald:1,image_parchment:1,image_red_potion:1}}]};
  text='Treasure unearthed. Open Inventory [I] and collect the nearby cache.';
 }else if(kind==='disarm'){
  const trap=sites.find(s=>s.kind==='trap'&&s.found&&!s.spent&&near(s));if(!trap)return;
  trap.spent=true;text='Trap safely disarmed.';
 }else if(kind==='cave'){
  const site=sites.find(s=>s.kind==='cave'&&s.found&&near(s));if(!site)return;
  const result=buildCave(data,map,site);seed=result.seed;site.destination=result.destination;
  text='Entered a hidden cave. Return to the stairs at 3, 3 and use > to leave.';
 }else return;
 seed={...seed,maps:seed.maps.map(m=>m.id===map.id?{...m,dynamicRegion:{...r,sites}}:m)};
 const next={...data,seed,[KEY]:a,...(kind==='cave'?{turn:(Number(data.turn)||0)+1}:{})};
 if(!budget(next))throw new Error('The expedition has no room for another discovery. Existing discoveries remain available.');
 pending={base:latest.stateRevision,text};notice='Waiting for the shared expedition…';Gulch.commit(next,text);
 if(!window.GulchMovementState?.inFlight){pending=null;notice='The room could not accept this action. Try again.';}
 }catch(error){pending=null;notice=String(error.message||error);}
 render();
}
function render(){
 const c=condition();if(!c){climateText.textContent='Surveying the region…';return;}
 const map=mapNow(),sites=c.r.sites;
 toggle.textContent='Explore · '+(c.r.underground?'Cave':seasons[c.season]);
 if(panel.hidden)return;
 climateText.textContent=(c.r.underground?'Hidden depths':c.c.name)+' · '+seasons[c.season]+' · '+c.temp+'°C · '+c.weather;
 description.textContent=c.r.underground?'Quiet fungal chambers hide old treasure and dangerous guardians.':c.c.description+' Towns and travelers share the existing roads.';
 const enabled=ready();controls.search.disabled=!enabled;
 controls.chart.disabled=!enabled||!latest.seed.entities.some(e=>e.map===map.id&&e.atlasChart&&near(e));
 controls.dig.disabled=!enabled||!sites.some(s=>s.kind==='cache'&&s.found&&!s.claimed&&near(s));
 controls.disarm.disabled=!enabled||!sites.some(s=>s.kind==='trap'&&s.found&&!s.spent&&near(s));
 controls.cave.disabled=!enabled||!sites.some(s=>s.kind==='cave'&&s.found&&near(s));
 status.textContent=notice;
 const rows=sites.filter(s=>s.found).map(s=>(s.kind==='cave'?'Hidden cave':s.kind==='trap'?(s.spent?'Spent trap':'TRAP'):(s.claimed?'Recovered treasure':'Buried treasure'))+' · '+s.x+', '+s.y);
 const charts=atlas(latest.gameState).charts;
 for(const chart of charts)if(chart.map!==map.id)rows.push('Secret map: '+chart.name+' · '+chart.x+', '+chart.y);
 clues.replaceChildren(...(rows.length?rows:['No secrets charted here. Look for sealed maps and search off the roads.']).map(t=>node('li',t)));
}
const canvas=node('canvas');canvas.id='atlasWeather';canvas.setAttribute('aria-hidden','true');host.append(canvas);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function paint(now){
 const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const c=condition();if(!c)return;
 const p=latest.player,map=mapNow(),v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));
 const point=(x,y)=>({x:w/2+(x-camera.x)*ts,y:h/2+(y-camera.y)*ts});
 const occupied=new Set(latest.seed.entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
 for(let y=Math.max(0,Math.floor(camera.y-h/ts/2)-1);y<Math.min(map.ascii.length,camera.y+h/ts/2+1);y++)for(let x=Math.max(0,Math.floor(camera.x-w/ts/2)-1);x<Math.min(map.ascii[y].length,camera.x+w/ts/2+1);x++){
  if(latest.lit[y]?.[x]!==1||occupied.has(x+','+y))continue;
  const q=point(x,y),n=hash(map.id+':'+x+':'+y);
  ctx.globalAlpha=c.r.underground?.12:.25;ctx.fillStyle=c.r.underground?'#8cb5bd':c.c.tint;ctx.fillRect(q.x-ts/2,q.y-ts/2,ts,ts);ctx.globalAlpha=1;
  if(!floor(latest.seed,map,x,y))continue;
  if(c.c.id==='frost'||c.season===3){ctx.fillStyle='#deedf5';ctx.globalAlpha=.35;ctx.fillRect(q.x-ts*.4,q.y-ts*.3,ts*.55,2);}
  else if(c.c.id==='desert'){ctx.strokeStyle='#f0ce8b';ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(q.x-ts*.4,q.y+ts*.2);ctx.quadraticCurveTo(q.x,q.y-ts*.05,q.x+ts*.4,q.y+ts*.15);ctx.stroke();}
  else if(n%4===0){ctx.fillStyle=c.c.id==='volcanic'?'#de815d':c.c.id==='autumn'?'#e6a34c':'#c9b5de';ctx.globalAlpha=.5;ctx.fillRect(q.x+(n%9)-4,q.y+(n%7)-3,3,2);}
  ctx.globalAlpha=1;
 }
 for(const site of c.r.sites){
  if(!latest.lit[site.y]?.[site.x])continue;
  const q=point(site.x,site.y);
  if(!site.found){ctx.fillStyle='#b7ac8b';ctx.globalAlpha=.5;ctx.fillRect(q.x-3,q.y+7,2,2);ctx.fillRect(q.x+2,q.y+5,3,2);ctx.globalAlpha=1;continue;}
  ctx.strokeStyle=site.kind==='trap'&&!site.spent?'#efa18c':'#e1d09a';ctx.lineWidth=1;ctx.strokeRect(q.x-ts*.35,q.y-ts*.35,ts*.7,ts*.7);
  ctx.font='bold '+Math.floor(ts*.5)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=ctx.strokeStyle;ctx.fillText(site.kind==='cave'?'Ω':site.kind==='trap'?(site.spent?'·':'!'):(site.claimed?'·':'×'),q.x,q.y);
 }
 const time=reduced.matches?0:now*.001;
 const amount=c.weather==='clear'?0:c.weather==='fog'?8:45;
 ctx.save();ctx.globalAlpha=.3;
 for(let i=0;i<amount;i++){
  const n=hash(map.id+':weather:'+i),speed=c.weather==='rain'?110:14;
  const x=((n%10007)/10007*w+time*(c.weather==='dust'?30:5))%(w+20)-10,y=(((n>>>8)%7919)/7919*h+time*speed*(1+i%3*.3))%(h+20)-10;
  if(c.weather==='fog'){ctx.fillStyle='#bbcad0';ctx.globalAlpha=.035;ctx.beginPath();ctx.ellipse(x,y,w*.3,40,0,0,Math.PI*2);ctx.fill();}
  else if(c.weather==='rain'){ctx.strokeStyle='#b5d6dd';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y+10);ctx.stroke();}
  else{ctx.fillStyle=c.weather==='snow'?'#ecf6ff':c.weather==='leaves'?'#e7ae5d':c.weather==='dust'?'#e2bc7c':c.weather==='motes'?'#b6e3d1':'#a9a3a1';ctx.fillRect(x,y,c.weather==='leaves'?4:2,c.weather==='leaves'?2:2);}
 }
 ctx.restore();
}
function setup(){if(!latest||document.hidden||latest.player.hp<=0||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;const next=decorate(latest.gameState);if(next===latest.gameState)return;attempt=latest.stateRevision;Gulch.commit(next,'A new climate reveals secret trails, buried maps and hidden passages.');}
let lastHazard=null;
Gulch.register('dynamic-regions',{snapshot(s){
 const changed=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;
 if(changed){pending=null;notice='A fresh expedition awaits.';attempt=null;}
 if(pending&&pending.base!==s.stateRevision){notice='Room updated. Inspect the discoveries below to confirm your action.';pending=null;}
 const hazard=s.gameState.atlasHazard;if(hazard&&hazard.id!==lastHazard){notice=hazard.text;lastHazard=hazard.id;}
 if(s.player.hp<=0&&!panel.hidden)show(false);
 setup();render();paint(performance.now());
},resize(){paint(performance.now());},action(a){if(a?.type==='search-secrets')act('search');}});
let lastPaint=0;
function frame(now){if(!document.hidden&&latest&&now-lastPaint>=100){lastPaint=now;paint(now);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
setInterval(()=>{if(!document.hidden){setup();if(!panel.hidden)render();}},700);
})();
