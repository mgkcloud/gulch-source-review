import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';

const failure=(status,message)=>Object.assign(new Error(message),{status});

function previewParity(){
  const epoch=d=>String(d?.respawnSettings?.token||'original');
  const number=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
  const player=d=>d?.seed?.entities?.find(e=>e.id==='player');
  const numeric=(v,f)=>v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):f;
  const dead=d=>d?.gulchPermanentGameOver?.ended===true||Boolean(player(d)&&numeric(player(d).hp,1)<=0);
  const setHP=(d,hp)=>({...d,seed:{...d.seed,entities:d.seed.entities.map(e=>e.id==='player'?{...e,hp}:e)}});
  function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0]);}
  function dread(seed,advance){
    const p=seed.entities.find(e=>e.id==='player');
    if(!p||p.hp<=0)return advance(seed);
    const map=seed.maps.find(m=>m.id===p.map);
    const attackers=seed.entities.filter(e=>e.dreadBeast&&e.hp>0&&e.map===p.map&&Math.max(Math.abs(e.x-p.x),Math.abs(e.y-p.y))<=1&&(!(e.x!==p.x&&e.y!==p.y)||(floor(seed,map,e.x,p.y)&&floor(seed,map,p.x,e.y))));
    const advanced=advance(seed);
    // The old wrapper replaces base cave damage with eight, before variety adds its damage.
    return attackers.length?{...advanced,entities:advanced.entities.map(e=>e.id==='player'?{...e,hp:Math.max(0,p.hp-8)}:e)}:advanced;
  }
  function latch(data,before){
    const p=player(data);
    const fallen=d=>d?.gulchPermanentGameOver?.ended===true||Boolean(player(d)&&player(d).hp!==null&&player(d).hp!==undefined&&player(d).hp!==''&&Number.isFinite(Number(player(d).hp))&&Number(player(d).hp)<=0);
    if(!p||!(epoch(before)===epoch(data)&&fallen(before))&&!fallen(data))return data;
    return {...setHP(data,0),gulchPermanentGameOver:{...data.gulchPermanentGameOver,ended:true}};
  }
  function contact(data,activity,before){
    if(epoch(data)!==epoch(before)||!(Number(data.turn)>Number(before.turn)))return {data,activity};
    const p=player(data);
    if(!p||!(Number(p.hp)>0))return {data,activity};
    const map=data.seed.maps.find(m=>m.id===p.map);
    const attackers=data.seed.entities.filter(e=>{
      if(e.id==='player'||e.faction!=='hostile'||e.ai!=='chase'||e.caveEncounter===1||e.practiceTarget||e.isPlayer||e.playerId||e.clientId||e.ownerId||e.loreSpeaker||e.itemId!=null||e.map!==p.map||(e.hp!=null&&Number(e.hp)<=0))return false;
      if(/(^|[^a-z])rats?([^a-z]|$)/i.test([e.id,e.name,e.species,e.type,e.kind].join(' ')))return false;
      const dx=p.x-e.x,dy=p.y-e.y;
      return Math.max(Math.abs(dx),Math.abs(dy))<=1&&(!(dx&&dy)||(floor(data.seed,map,e.x+dx,e.y)&&floor(data.seed,map,e.x,e.y+dy)));
    });
    const damage=Math.min(2,attackers.length);
    return damage?{data:setHP(data,Math.max(0,Number(p.hp)-damage)),activity:(activity||'')+' Nearby enemies strike for '+damage+' base damage.'}:{data,activity};
  }
  function finish(data,activity,before){
    const modes={easy:.5,normal:1,hard:2,nightmare:3};
    const requested=before?.respawnSettings?.difficulty;
    const selected=Object.prototype.hasOwnProperty.call(modes,requested)?requested:'hard';
    const old=player(before),after=player(data);
    let next=data;
    if(old&&after&&Number.isFinite(old.hp)&&Number.isFinite(after.hp)&&after.hp<old.hp)next=setHP(next,Math.max(0,old.hp-(old.hp-after.hp)*modes[selected]));
    next={...next,respawnSettings:{...next.respawnSettings,difficulty:selected,hardcore:true}};
    const p=player(next);
    if(!p)return {data:next,activity};
    const same=epoch(before)===epoch(next),maximum=Math.max(1,numeric(p.maxHp,20));
    const ended=Boolean(same&&dead(before))||dead(next);
    const hp=ended?0:Math.max(0,Math.min(maximum,numeric(p.hp,maximum)));
    next={...next,seed:{...next.seed,entities:next.seed.entities.map(e=>e.id==='player'?{...e,hp,maxHp:maximum}:e)},gulchPermanentGameOver:{...next.gulchPermanentGameOver,ended:hp<=0}};
    return {data:next,activity:(activity||'')+(dead(next)&&same&&!dead(before)?' You have fallen. This expedition has ended.':'')};
  }
  function harvest(data,before){
    if(!data?.seed||epoch(data)!==epoch(before)||!(Number(data.turn)>Number(before.turn)))return data;
    const seed=data.seed,p=player(data);
    if(!p||p.hp<=0||data.gulchPermanentGameOver?.ended)return data;
    const old=data.villageHarvest,state=old?.epoch===epoch(data)?old:{epoch:epoch(data),plots:{}};
    const plots={},ids=new Set(seed.entities.map(e=>e.id));let entities=seed.entities.slice();
    function walk(map,x,y){return floor(seed,map,x,y)&&map.ascii[y]?.[x]!=='>'&&!map.exits?.some(e=>e.x===x&&e.y===y);}
    const lines={farm:['These rows need patient hands. The harvest will be worth it.','I will leave a basket for travelers when these crops ripen.','A few more days of tending, and we can share supper.'],water:['The seedlings drink before I do.','I like the sound of the bucket coming back full.','The well is where everyone brings their news.'],carry:['I hope I can reach the beans without spilling this.','Water for the garden, then a moment in the shade.','A full bucket makes a surprisingly long walk.'],rest:['I wonder what lies beyond the next village.','There should always be a spare place at the table.','Tomorrow I might plant flowers beside the door.'],shelter:['The fields can wait. Everyone needs to get home.']};
    for(const map of seed.maps)for(const district of map.villageLife?.districts||[]){
      const prior=state.plots?.[district.id]||{},plot={work:Math.min(11,number(prior.work)),harvests:Math.min(9999,number(prior.harvests)),ready:Boolean(prior.ready)};
      plots[district.id]=plot;
      if(map.id!==p.map)continue;
      const workers=entities.filter(e=>e.map===map.id&&e.villageResident?.district===district.id);
      const tending=workers.filter(e=>e.villageResident.task==='farm'&&e.villageResident.working);
      if(tending.length&&!plot.ready){plot.work=Math.min(12,plot.work+tending.length);if(plot.work>=12)plot.ready=true;}
      const baskets=entities.filter(e=>e.villageHarvestBasket===district.id);
      if(plot.ready&&tending.length&&baskets.length<2&&entities.filter(e=>e.villageHarvestBasket).length<32){
        const occupied=new Set(entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
        const reserved=[...(map.groundHazards?.cells||[]),...(map.dynamicRegion?.sites||[]),...(data.wayfarerPilgrimage?.sites||[]).filter(s=>s.map===map.id),...(data.legendarySwordQuest?.sites||[]).filter(s=>s.map===map.id)];
        const candidates=[];
        for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
          const x=district.well.x+dx,y=district.well.y+dy;
          if(Math.abs(dx)+Math.abs(dy)<2||!walk(map,x,y)||occupied.has(x+','+y)||reserved.some(s=>s.x===x&&s.y===y)||district.garden.some(s=>s.x===x&&s.y===y))continue;
          if(![[1,0],[-1,0],[0,1],[0,-1]].every(([a,b])=>walk(map,x+a,y+b)&&!occupied.has((x+a)+','+(y+b))))continue;
          candidates.push({x,y,d:Math.abs(dx)+Math.abs(dy)});
        }
        candidates.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
        const spot=candidates[0];
        if(spot){
          let id='village-harvest:'+district.id+':'+plot.harvests;while(ids.has(id))id+='x';ids.add(id);
          entities.push({id,map:map.id,x:spot.x,y:spot.y,name:district.name+' harvest basket',kind:'resource',regionFood:true,quantity:3,glyph:'▤',color:'#e6c17f',villageHarvestBasket:district.id});
          plot.work=0;plot.ready=false;plot.harvests=Math.min(9999,plot.harvests+1);
        }
      }
      entities=entities.map(e=>{
        if(e.map!==map.id||e.villageResident?.district!==district.id)return e;
        const v=e.villageResident,pool=lines[v.task]||lines.rest;
        const season=(Math.floor(Number(data.turn)/24)+number(v.offset))%3;
        const thought=plot.ready&&v.task==='farm'?'The crops are ready. We need a clear place near the well for another basket.':pool[season%pool.length];
        return {...e,villageResident:{...v,thought},dialogue:'I am the '+v.job+' of '+district.name+'. '+thought+' Our garden has provided '+plot.harvests+' harvests. Travelers may take food from the baskets beside the well.'};
      });
    }
    const next={...data,seed:{...seed,entities},villageHarvest:{epoch:epoch(data),plots}};
    return globalThis.GulchLivingWorldEffects.utf8Bytes(JSON.stringify(next))<350000?next:data;
  }
  function enrich(data){
    const VERSION=1;
    const items={image_handaxe:{id:'image_handaxe',name:'Woodcutter axe',glyph:'⚔'},image_pickaxe:{id:'image_pickaxe',name:'Miner pickaxe',glyph:'⚔'},image_sickle:{id:'image_sickle',name:'Harvest sickle',glyph:'⚔'},image_bow:{id:'image_bow',name:'Hunting bow',glyph:'⚔'},image_red_potion:{id:'image_red_potion',name:'Crimson healing potion',glyph:'✚'},image_satchel:{id:'image_satchel',name:'Leather satchel',glyph:'◈'},image_silver_bar:{id:'image_silver_bar',name:'Silver ingot',glyph:'◆'}};
    function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
    function random(text){let h=hash(text);return ()=>{h=(h+0x6d2b79f5)|0;let t=Math.imul(h^(h>>>15),h|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
    function bytes(text){let n=0;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c<128)n++;else if(c<2048)n+=2;else if(c>=55296&&c<=56319&&i+1<text.length&&text.charCodeAt(i+1)>=56320&&text.charCodeAt(i+1)<=57343){n+=4;i++;}else n+=3;}return n;}
    const seed=data.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
    if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map.landscapeLife?.version===VERSION)return data;
    const rng=random(String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':detail:'+map.id);
    const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
    for(let i=0;i<queue.length&&queue.length<10000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;
      if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);queue.push({x,y});}
    }
    const entities=seed.entities.slice(),ids=new Set(entities.map(e=>e.id));
    const occupied=new Set(entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
    const exits=map.exits||[],refuges=entities.filter(e=>e.map===map.id&&(e.townRefuge||e.outsideNPC||e.swordQuestLandmark));
    const candidates=queue.filter(q=>!occupied.has(q.x+','+q.y)&&map.ascii[q.y][q.x]!=='>'&&exits.every(e=>Math.hypot(q.x-e.x,q.y-e.y)>3));
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    let serial=0;
    function take(min,max,safe){const index=candidates.findIndex(q=>{const d=Math.hypot(q.x-p.x,q.y-p.y);return d>=min&&d<=max&&(!safe||refuges.every(e=>Math.hypot(q.x-e.x,q.y-e.y)>8));});return index<0?null:candidates.splice(index,1)[0];}
    function add(q,values){let id='landscape:'+map.id+':'+serial++;while(ids.has(id))id+='x';ids.add(id);entities.push({id,map:map.id,...q,...values,landscapeEntity:true});}
    const outdoors=!/cave|cavern|mine|dungeon|underground/i.test([map.biome,map.name].join(' '));
    const discoveries=['image_handaxe','image_pickaxe','image_sickle','image_bow','image_red_potion','image_satchel','image_silver_bar'];
    let tools=0,animals=0,beasts=0;
    const existing=entities.filter(e=>e.landscapeEntity).length,budget=Math.max(0,100-existing);
    for(let i=0;i<Math.min(6,budget);i++){
      const q=take(3,Infinity,false);if(!q)break;
      const item=discoveries[Math.floor(rng()*discoveries.length)],definition=items[item];if(!definition)continue;
      add(q,{name:'Abandoned '+definition.name.toLowerCase(),kind:'loot',ecosystemLoot:true,landscapeTool:item,contents:{[item]:1},glyph:' ',color:'#ecd6a0'});tools++;
    }
    if(outdoors)for(let i=0;i<Math.min(5,Math.max(0,budget-tools));i++){
      const q=take(5,Infinity,false);if(!q)break;const species=['deer','rabbit','sheep','fox'][Math.floor(rng()*4)];
      add(q,{name:'Wild '+species,kind:'animal',species,outsideAnimal:species,faction:'friendly',glyph:' ',dialogue:'The '+species+' pauses among the wildflowers, ears alert to the wind.'});animals++;
    }
    const globalBeasts=entities.filter(e=>e.dreadBeast&&e.hp>0).length;
    const desired=queue.length>900?2:queue.length>180?1:0;
    for(let i=0;i<Math.min(desired,Math.max(0,12-globalBeasts),Math.max(0,budget-tools-animals));i++){
      const q=take(15,Infinity,true);if(!q)break;
      const hp={easy:22,normal:30,hard:38,nightmare:48}[data.respawnSettings?.difficulty]||38;
      add(q,{name:'Crimson Dreadmaw',kind:'cave-creature',faction:'hostile',caveEncounter:1,caveSprite:'beetle',dreadBeast:true,hp,maxHp:hp,glyph:' ',color:'#ff403b'});beasts++;
    }
    const detail={version:VERSION,outdoors,tools,animals,beasts};
    const next={...data,seed:{...seed,entities,maps:seed.maps.map(m=>m.id===map.id?{...m,landscapeLife:detail}:m)}};
    return bytes(JSON.stringify(next))<=335000?next:data;
  }
  function frontier(data,before){
    const KEY='frontierArchitecture',VERSION=1;
    const types=[
      {name:'Raincatcher cistern',color:'#81b6bd',loot:{glass:2,wire:1}},
      {name:'Spore oracle shrine',color:'#b6a1d2',loot:{spore:3,spark:1}},
      {name:'Scrapwright workshop',color:'#d6a16a',loot:{scrap:3,wire:2}},
      {name:'Caravan windbreak',color:'#cbbd83',loot:{fiber:3,hide:1}},
      {name:'Broken signal tower',color:'#b8c4ac',loot:{scrap:2,spark:2}},
      {name:'Buried memory vault',color:'#8ebda0',loot:{relic:1,glass:2}}
    ];
    function hash(text){let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);n^=n>>>16;n=Math.imul(n,0x7feb352d);return (n^(n>>>15))>>>0;}
    function floor(seed,map,x,y){const c=map.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y);}
    function bounded(data){return globalThis.GulchLivingWorldEffects.utf8Bytes(JSON.stringify(data))<325000;}
    function populate(data){
      const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
      if(!map||p.hp<=0||data.gulchPermanentGameOver?.ended||map[KEY]?.version===VERSION)return data;
      const area=map.ascii.reduce((n,r)=>n+r.length,0);if(area>16000)return data;
      const reserved=new Set();
      function reserve(x,y,r){if(!Number.isFinite(x)||!Number.isFinite(y))return;for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)reserved.add(xx+','+yy);}
      function rectangle(x,y,w,h){for(let yy=y-1;yy<=y+h;yy++)for(let xx=x-1;xx<=x+w;xx++)reserve(xx,yy,0);}
      reserve(p.x,p.y,4);
      for(const e of seed.entities)if(e.map===map.id)reserve(e.x,e.y,1);
      for(const q of [...(map.exits||[]),...(map.landmarks||[]),...(map.dynamicRegion?.sites||[]),...(map.groundHazards?.cells||[]),...(map.sinkingGround?.cells||[]),...(map.wildPlantGarden?.plants||[]).filter(q=>q.harvest)])reserve(q.x,q.y,1);
      for(const d of map.blockSettlements?.designs||[])rectangle(d.kind==='great-tree'?d.x-2:d.x,d.kind==='great-tree'?d.y-2:d.y,d.kind==='great-tree'?5:d.w,d.kind==='great-tree'?5:d.h);
      for(const d of map.npcConstruction?.sites||[])rectangle(d.x,d.y,d.w,d.h);
      for(const d of map.villageLife?.districts||[]){reserve(d.well.x,d.well.y,1);for(const q of d.garden)reserve(q.x,q.y,1);}
      for(const list of [data.legendarySwordQuest?.sites,data.wayfarerPilgrimage?.sites,data.npcConversations?.treasures])for(const q of list||[])if(q.map===map.id)reserve(q.x,q.y,2);
      const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
      for(let i=0;i<queue.length&&queue.length<16000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(!seen.has(k)&&floor(seed,map,x,y)){seen.add(k);queue.push({x,y});}}
      const salt=String(data.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':architecture:'+map.id;
      const candidates=queue.map(q=>({...q,roll:hash(salt+':'+q.x+','+q.y)})).sort((a,b)=>a.roll-b.roll||a.y-b.y||a.x-b.x);
      const sites=[],maximum=Math.min(8,Math.max(2,Math.floor(queue.length/280)));
      const cave=/cave|cavern|mine|underground|grotto|dungeon/i.test([map.name,map.biome].join(' '));
      for(const q of candidates){
        if(sites.length>=maximum)break;
        const w=q.roll%3===0?5:3,h=3;
        let safe=true;
        for(let y=q.y-1;y<=q.y+h&&safe;y++)for(let x=q.x-1;x<=q.x+w;x++){
          const material=seed.legend[map.ascii[y]?.[x]]?.[1];
          if(!seen.has(x+','+y)||reserved.has(x+','+y)||!floor(seed,map,x,y)||['wood','plank'].includes(material)){safe=false;break;}
        }
        if(!safe||sites.some(s=>Math.hypot(s.x-q.x,s.y-q.y)<8))continue;
        let type=q.roll%types.length;if(cave&&type===3)type=1;
        const ancient=type===4||type===5;
        sites.push({id:'frontier-site:'+map.id+':'+sites.length,x:q.x,y:q.y,w,h,type,variant:(q.roll>>>8)%3,progress:ancient?24:0,total:24,rewardPlaced:false,ancient});
        rectangle(q.x,q.y,w,h);
      }
      const next={...data,seed:{...seed,maps:seed.maps.map(m=>m.id===map.id?{...m,[KEY]:{version:VERSION,sites}}:m)}};
      return bounded(next)?next:data;
    }
    function evolve(data,before){
      if(!before||epoch(data)!==epoch(before)||Number(data.turn)<=Number(before.turn))return data;
      const seed=data.seed,p=seed.entities.find(e=>e.id==='player');if(!p||p.hp<=0||data.gulchPermanentGameOver?.ended)return data;
      let changed=false,entities=seed.entities.slice();
      const ids=new Set(entities.map(e=>e.id));let capacity=Math.max(0,32-entities.filter(e=>e.frontierSalvage).length);
      const maps=seed.maps.map(map=>{
        if(map.id!==p.map||!map[KEY]?.sites?.length)return map;
        const sites=map[KEY].sites.map(site=>{
          const threatened=entities.some(e=>e.map===map.id&&e.faction==='hostile'&&e.hp>0&&Math.hypot(e.x-(site.x+site.w/2),e.y-(site.y+1))<5);
          let next=site;
          if(!threatened&&site.progress<site.total){next={...site,progress:site.progress+1};changed=true;}
          if(next.progress>=next.total&&!next.rewardPlaced&&capacity>0&&!threatened){
            const x=site.x+Math.floor(site.w/2),y=site.y+1;
            if(floor(seed,map,x,y)&&!entities.some(e=>e.map===map.id&&e.x===x&&e.y===y)&&!map.groundHazards?.cells?.some(c=>c.x===x&&c.y===y)&&!map.sinkingGround?.cells?.some(c=>c.x===x&&c.y===y)){
              const type=types[site.type];let id=site.id+':salvage';while(ids.has(id))id+='x';ids.add(id);
              entities.push({id,map:map.id,x,y,name:type.name+' salvage',kind:'loot',ecosystemLoot:true,frontierSalvage:true,contents:{...type.loot},glyph:'▣',color:type.color});
              next={...next,rewardPlaced:true};capacity--;changed=true;
            }
          }
          return next;
        });
        return {...map,[KEY]:{...map[KEY],sites}};
      });
      if(!changed)return data;
      const next={...data,seed:{...seed,maps,entities}};return bounded(next)?next:data;
    }
    if(!data?.seed)return data;
    return evolve(populate(data),before);
  }
  return {dead,dread,latch,contact,finish,harvest,enrich,frontier};
}

function simulationWorker(){
  const {parentPort,workerData}=require('node:worker_threads');
  const vm=require('node:vm');
  const {performance}=require('node:perf_hooks');
  const validation=workerData.validation===true;
  const stages=new Set(['core','fox','fox-search','fox-select','fox-collect','fox-finalize','social','social-turn','chest','frontier','sinking','construction','village','hazard','structures','cartography','enemy-init','enemy-turn-advance','enemy-population','contact','region','living','assistance','progression','treasure','stringify','cave','cave-turn','harvest','finish','input','compile']);
  let stage='compile',previousStage='compile',started=performance.now(),stageStarted=started,context;
  let intervals=[];
  function resetTiming(name){
    started=performance.now();stageStarted=started;stage=name;previousStage=name;intervals=[];
  }
  function markStage(name){
    if(!validation||typeof name!=='string'||!stages.has(name))return;
    const now=performance.now();
    intervals.push({name:stage,ms:Math.min(60000,Math.max(0,Math.round(now-stageStarted)))});
    if(intervals.length>24)intervals.shift();
    previousStage=stage;stage=name;stageStarted=now;
  }
  const stageSetter=Object.freeze(Object.setPrototypeOf(function(name){markStage(name);},null));
  function diagnostic(error){
    if(!validation)return {};
    const now=performance.now();
    const milliseconds=start=>Math.min(60000,Math.max(0,Math.round(now-start)));
    let name='Error',timeout=false;
    try{
      const n=Object.getOwnPropertyDescriptor(error,'name')?.value;
      const code=Object.getOwnPropertyDescriptor(error,'code')?.value;
      timeout=code==='ERR_SCRIPT_EXECUTION_TIMEOUT';
      if(['Error','TypeError','RangeError','ReferenceError','SyntaxError','EvalError','URIError'].includes(n))name=n;
      else if(error instanceof SyntaxError)name='SyntaxError';
    }catch{}
    return {diagnostic:{stage,previousStage,intervals:intervals.map(({name,ms})=>({name,ms})),elapsedInStageMs:milliseconds(stageStarted),errorName:name,errorMessage:timeout?'Script execution timed out after 100ms':name+' during movement simulation (message redacted)',elapsedMs:milliseconds(started),limitMs:100}};
  }
  const specs=[['core','source'],['progression','effectsSource'],['living','livingSource'],['cave','caveSource'],['enemy','varietySource'],['village','villageSource'],['construction','constructionSource'],['cartography','cartographySource'],['hazard','hazardSource']];
  const scripts={};
  try{
    for(const [name,key] of specs){resetTiming('compile');markStage(name==='enemy'?'enemy-init':name);scripts[name]=new vm.Script(workerData[key],{filename:'shared-'+name+'.js'});}
  }catch(error){parentPort.postMessage({fatal:true,...diagnostic(error)});return;}
  parentPort.on('message',message=>{
    resetTiming('input');context=null;
    try{
      context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false},microtaskMode:'afterEvaluate'});
      Object.defineProperty(context,'structuredClone',{value:globalThis.structuredClone,writable:false,configurable:false,enumerable:false});
      if(validation)Object.defineProperty(context,'__gulchDiagnosticStage',{set:stageSetter,configurable:false,enumerable:false});
      for(const name of ['core','cave','enemy','living','progression','village','construction','hazard','cartography']){
        markStage(name==='enemy'?'enemy-init':name);
        scripts[name].runInContext(context,{timeout:4000});
      }
      markStage('input');
      const input=JSON.stringify(message.input);
      const mark=name=>validation?'globalThis.__gulchDiagnosticStage='+JSON.stringify(name)+';':'';
      markStage('compile');
      const script=new vm.Script('(()=>{'+mark('input')+'const input=JSON.parse('+JSON.stringify(input)+');const parity=('+previewParity.toString()+')();if(input.action?.inFlight||parity.dead(input.world))return "null";'+
        mark('core')+'if(typeof globalThis.GulchWorldEngine?.apply!=="function")throw Error("Missing core");'+
        mark('cave')+'if(typeof globalThis.GulchCaveEffects?.advanceBase!=="function")throw Error("Missing cave helper");'+
        mark('enemy-init')+'if(typeof globalThis.GulchEnemyVarietyEffects?.advance!=="function"||typeof globalThis.GulchEnemyVarietyEffects?.populate!=="function")throw Error("Missing enemy-variety helper");'+
        mark('living')+'if(typeof globalThis.GulchLivingWorldEffects?.apply!=="function")throw Error("Missing living-world helper");'+
        mark('progression')+'if(typeof globalThis.GulchTurnEffects?.progression!=="function")throw Error("Missing progression helper");'+
        mark('village')+'if(typeof globalThis.GulchVillageLifeEffects?.apply!=="function")throw Error("Missing village helper");'+
        mark('construction')+'if(typeof globalThis.GulchConstructionEffects?.apply!=="function")throw Error("Missing construction helper");'+
        mark('hazard')+'if(typeof globalThis.GulchGroundHazardEffects?.apply!=="function")throw Error("Missing ground-hazard helper");'+
        mark('cartography')+'if(typeof globalThis.GulchCartographyEffects?.chart!=="function")throw Error("Missing cartography helper");'+
        mark('social')+'if(typeof globalThis.GulchSocialMovementPreview!=="function"||!Number.isSafeInteger(input.action.previewBase))throw Error("Missing social preview context");'+
        'const social=globalThis.GulchSocialMovementPreview(input.world,input.action.previewBase);'+
        mark('core')+'let prediction=globalThis.GulchWorldEngine.apply(input.world,input.action,{advanceCaves:seed=>{'+mark('social-turn')+'const advanced=social.advance(seed,s=>{'+mark('enemy-turn-advance')+'const varied=globalThis.GulchEnemyVarietyEffects.advance(s,t=>{'+mark('cave-turn')+'const dreaded=parity.dread(t,u=>globalThis.GulchCaveEffects.advanceBase(u));'+mark('enemy-turn-advance')+'return dreaded;});'+mark('social-turn')+'return varied;});'+mark('core')+'return advanced;}});'+
        'if(prediction!==null){'+
          'if(!prediction||typeof prediction!=="object"||Array.isArray(prediction)||!prediction.data||typeof prediction.data!=="object"||Array.isArray(prediction.data)||typeof prediction.activity!=="string")throw Error("Invalid core prediction");'+
          'const bounded=globalThis.GulchBoundedMovementPreview;'+
          'if(typeof bounded?.chests!=="function"||typeof bounded?.sinking!=="function"||typeof bounded?.chance!=="function")throw Error("Missing bounded movement helpers");'+
          'if(typeof globalThis.GulchFoxMovementPreview!=="function")throw Error("Missing fox preview context");'+
          'const foxPreview=globalThis.GulchFoxMovementPreview(input.world,input.action.previewBase);'+
          'if(typeof foxPreview?.transform!=="function")throw Error("Missing fox movement helper");'+
          mark('fox')+'const foxResult=foxPreview.transform(prediction.data);'+
          'if(!foxResult||typeof foxResult!=="object"||Array.isArray(foxResult)||!foxResult.data||typeof foxResult.data!=="object"||Array.isArray(foxResult.data)||typeof foxResult.activity!=="string")throw Error("Invalid fox movement result");'+
          mark('social')+'const socialData=social.populate(foxResult.data);'+
          'if(!socialData||typeof socialData!=="object"||Array.isArray(socialData))throw Error("Invalid social population result");'+
          'if(typeof globalThis.GulchAdventurerMovementPreview!=="function")throw Error("Missing adventurer preview context");'+
          'const adventurer=globalThis.GulchAdventurerMovementPreview(input.world,input.action.previewBase);'+
          'if(typeof adventurer.populate!=="function"||typeof adventurer.advance!=="function"||typeof adventurer.transform!=="function")throw Error("Missing adventurer movement helpers");'+
          'const adventurerData=adventurer.transform(socialData);'+
          'if(!adventurerData||typeof adventurerData!=="object"||Array.isArray(adventurerData))throw Error("Invalid adventurer transform result");'+
          mark('chest')+'const chestData=bounded.chests(adventurerData);'+
          'if(!chestData||typeof chestData!=="object"||Array.isArray(chestData))throw Error("Invalid chest generation result");'+
          mark('frontier')+'const frontierData=parity.frontier(chestData,input.world);'+
          'if(!frontierData||typeof frontierData!=="object"||Array.isArray(frontierData))throw Error("Invalid frontier architecture result");'+
          mark('sinking')+'const sinkingResult=bounded.sinking(frontierData,prediction.activity+foxResult.activity,input.world,input.action?.inFlight);'+
          'if(!sinkingResult)return "null";'+
          'if(!sinkingResult.data||typeof sinkingResult.data!=="object"||Array.isArray(sinkingResult.data)||typeof sinkingResult.activity!=="string")throw Error("Invalid sinking result");'+
          'const activity=sinkingResult.activity;const previousSnapshot={gameState:input.world,turn:input.world.turn};'+
          mark('harvest')+'const harvested=parity.harvest(sinkingResult.data,input.world);'+
          mark('construction')+'const constructed=globalThis.GulchConstructionEffects.apply(harvested,previousSnapshot);'+
          'if(!constructed||typeof constructed!=="object"||Array.isArray(constructed))throw Error("Invalid construction result");'+
          mark('village')+'const villageData=globalThis.GulchVillageLifeEffects.apply(constructed,previousSnapshot);'+
          'if(!villageData||typeof villageData!=="object"||Array.isArray(villageData))throw Error("Invalid village result");'+
          mark('hazard')+'const hazardResult=globalThis.GulchGroundHazardEffects.apply(villageData,activity,previousSnapshot);'+
          'if(!hazardResult||typeof hazardResult!=="object"||Array.isArray(hazardResult)||!hazardResult.data||typeof hazardResult.data!=="object"||Array.isArray(hazardResult.data)||typeof hazardResult.activity!=="string")throw Error("Invalid ground-hazard result");'+
          'if(typeof globalThis.GulchEnvironmentPreview?.structures!=="function"||typeof globalThis.GulchEnvironmentPreview?.population!=="function")throw Error("Missing environment preview helpers");'+
          mark('structures')+'const structured=globalThis.GulchEnvironmentPreview.structures(hazardResult.data);'+
          'if(!structured||typeof structured!=="object"||Array.isArray(structured))throw Error("Invalid world structures result");'+
          mark('cartography')+'const charted=globalThis.GulchCartographyEffects.chart(structured);'+
          'if(!charted||typeof charted!=="object"||Array.isArray(charted))throw Error("Invalid cartography result");'+
          mark('enemy-population')+'const populated=globalThis.GulchEnemyVarietyEffects.populate(charted);'+
          'if(!populated||typeof populated!=="object"||Array.isArray(populated))throw Error("Invalid enemy population result");'+
          mark('contact')+'const contactResult=parity.contact(parity.enrich(parity.latch(populated,input.world)),hazardResult.activity,input.world);'+
          mark('region')+'const regionData=globalThis.GulchEnvironmentPreview.population(contactResult.data);'+
          'if(!regionData||typeof regionData!=="object"||Array.isArray(regionData))throw Error("Invalid region population result");'+
          mark('living')+'const livingData=globalThis.GulchLivingWorldEffects.apply(input.world,regionData);'+
          'if(!livingData||typeof livingData!=="object"||Array.isArray(livingData))throw Error("Invalid living-world result");'+
          mark('assistance')+'const assistance=social.aid(livingData,contactResult.activity);'+
          'if(!assistance||!assistance.data||typeof assistance.data!=="object"||Array.isArray(assistance.data)||typeof assistance.activity!=="string")throw Error("Invalid friendly assistance result");'+
          mark('finish')+'const finalResult=parity.finish(assistance.data,assistance.activity,input.world);'+
          mark('progression')+'const data=globalThis.GulchTurnEffects.progression(input.world,finalResult.data);'+
          'if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Invalid progression result");'+
          mark('treasure')+'const chanceResult=bounded.chance(data,finalResult.activity,input.world);'+
          'if(!chanceResult||!chanceResult.data||typeof chanceResult.data!=="object"||Array.isArray(chanceResult.data)||typeof chanceResult.activity!=="string")throw Error("Invalid treasure chance result");'+
          'prediction={...prediction,data:chanceResult.data,activity:chanceResult.activity};}'+
        mark('stringify')+'const result=JSON.stringify(prediction);'+
        'if(typeof result!=="string"||result.length>250000)throw Error("Invalid prediction");return result;})()');
      const result=script.runInContext(context,{timeout:4000});
      parentPort.postMessage({id:message.id,result});
    }catch(error){parentPort.postMessage({id:message.id,failed:true,...diagnostic(error)});}
  });
}

export function verifyLandscapeFixtures(clientEnrich){
  if(typeof clientEnrich!=='function')throw Error('Supply enrich captured from the receipt-matched client landscape module with both catalog modules loaded');
  const enrich=previewParity().enrich;
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  const serialize=value=>JSON.stringify(canonical(value));
  let checked=0;
  const found=new Set();
  function check(data,label){
    const before=serialize(data),left=structuredClone(data),right=structuredClone(data);
    const expected=clientEnrich(left),actual=enrich(right);
    if(serialize(expected)!==serialize(actual))throw Error('Landscape fixture mismatch: '+label);
    if(serialize(left)!==before||serialize(right)!==before)throw Error('Landscape fixture mutated input: '+label);
    if((expected===left)!==(actual===right))throw Error('Landscape fallback mismatch: '+label);
    for(const entity of actual.seed.entities)if(entity.landscapeTool)found.add(entity.landscapeTool);
    checked++;return actual;
  }
  function fixture(seed,biome='meadow',difficulty='hard',width=40,height=30){
    return {turn:1,respawnSettings:{generationSeed:seed,token:'fixture',difficulty},seed:{meta:{seed:'fallback'},legend:{'.':['floor','grass'],'#':['wall','stone'],'~':['water','water'],'>':['floor','stone']},maps:[{id:'fixture',biome,ascii:Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>!x||!y||x===width-1||y===height-1?'#':'.').join('')),exits:[{x:width-3,y:height-3,to:'elsewhere',at:{x:1,y:1}}]}],entities:[{id:'player',map:'fixture',x:3,y:3,hp:100,maxHp:100}]}};
  }
  for(let i=0;i<32;i++)for(const biome of ['meadow','cavern']){
    const data=fixture('landscape-fixture-'+i,biome,['easy','normal','hard','nightmare'][i%4]);
    data.seed.entities.push({id:'landscape:fixture:0',map:'elsewhere',x:1,y:1},{id:'landscape:fixture:0x',map:'elsewhere',x:2,y:1},{id:'refuge',map:'fixture',x:25,y:15,townRefuge:true});
    const result=check(data,biome+' '+i);check(result,'already enriched '+i);
  }
  for(const count of [89,94,99,100,101]){
    const data=fixture('budget-'+count);
    for(let i=0;i<count;i++)data.seed.entities.push({id:'existing-'+i,map:'elsewhere',x:i,y:1,landscapeEntity:true});
    const result=check(data,'entity budget '+count);
    if(result.seed.entities.filter(e=>e.landscapeEntity).length>Math.max(count,100))throw Error('Landscape entity budget exceeded');
  }
  for(const count of [11,12,13]){
    const data=fixture('beast-budget-'+count);
    for(let i=0;i<count;i++)data.seed.entities.push({id:'beast-'+i,map:'elsewhere',x:i,y:1,dreadBeast:true,hp:1});
    const result=check(data,'beast budget '+count);
    if(result.seed.entities.filter(e=>e.dreadBeast&&e.hp>0).length>Math.max(count,12))throw Error('Dreadmaw cap exceeded');
  }
  for(const [width,height] of [[10,10],[20,12],[40,30],[110,110]])check(fixture('area', 'meadow','hard',width,height),'area '+width+'x'+height);
  const terrain=fixture('terrain');
  terrain.seed.maps[0].ascii=terrain.seed.maps[0].ascii.map((row,y)=>y===10?'#'+ '~'.repeat(15)+'.'+ '#'.repeat(22)+'#':row);
  check(terrain,'water walls and disconnected terrain');
  const dead=fixture('dead');dead.seed.entities[0].hp=0;check(dead,'dead player');
  const ended=fixture('ended');ended.gulchPermanentGameOver={ended:true};check(ended,'ended expedition');
  const missing=fixture('missing');missing.seed.maps=[];check(missing,'missing map');
  const sized=fixture('size');sized.padding='';
  const enriched=enrich(sized),base=Buffer.byteLength(JSON.stringify(enriched));
  for(const delta of [-1,0,1]){
    const data=structuredClone(sized);data.padding='x'.repeat(Math.max(0,335000-base+delta));
    const result=check(data,'335000-byte boundary '+delta);
    if((result!==data)&&Buffer.byteLength(JSON.stringify(result))>335000&&serialize(result)!==serialize(data))throw Error('Landscape size cap exceeded');
  }
  const unicode=fixture('unicode');unicode.padding='🌲'.repeat(84000);check(unicode,'UTF-8 overflow fallback');
  for(const id of ['image_handaxe','image_pickaxe','image_sickle','image_bow','image_red_potion','image_satchel','image_silver_bar'])if(!found.has(id))throw Error('Fixture lacks item coverage: '+id);
  return {checked,items:[...found].sort()};
}

export function createMovementPreview({validation=false}={}){
  validation=validation===true;
  let worker=null,key=null,revision=null,nextId=0;
  const pending=new Map();
  function reset(error=failure(503,'Movement preview worker reset')){
    const old=worker;worker=null;key=null;revision=null;
    for(const entry of pending.values()){
      clearTimeout(entry.timer);entry.reject(error);
    }
    pending.clear();
    if(old)void old.terminate().catch(()=>{});
  }
  function invalidate(currentRevision){
    if(worker&&revision!==currentRevision)reset(failure(409,'Source revision changed; refresh before previewing'));
  }
  function run({source,effectsSource,livingSource,caveSource,varietySource,villageSource,constructionSource,cartographySource,hazardSource,revision:requestedRevision,world,action}){
    if(typeof source!=='string'||!source.trim()||Buffer.byteLength(source)>200000)
      return Promise.reject(failure(503,'Current shared movement core is unavailable'));
    if(typeof effectsSource!=='string'||!effectsSource.trim()||Buffer.byteLength(effectsSource)>200000)
      return Promise.reject(failure(503,'Current shared progression helper is unavailable'));
    if(typeof livingSource!=='string'||!livingSource.trim()||Buffer.byteLength(livingSource)>200000)
      return Promise.reject(failure(503,'Current shared living-world helper is unavailable'));
    if(typeof caveSource!=='string'||!caveSource.trim()||Buffer.byteLength(caveSource)>200000)
      return Promise.reject(failure(503,'Current shared cave helper is unavailable'));
    if(typeof varietySource!=='string'||!varietySource.trim()||Buffer.byteLength(varietySource)>200000)
      return Promise.reject(failure(503,'Current shared enemy-variety helper is unavailable'));
    if(typeof villageSource!=='string'||!villageSource.trim()||Buffer.byteLength(villageSource)>200000)
      return Promise.reject(failure(503,'Current shared village helper is unavailable'));
    if(typeof constructionSource!=='string'||!constructionSource.trim()||Buffer.byteLength(constructionSource)>200000)
      return Promise.reject(failure(503,'Current shared construction helper is unavailable'));
    if(typeof cartographySource!=='string'||!cartographySource.trim()||Buffer.byteLength(cartographySource)>200000)
      return Promise.reject(failure(503,'Current shared cartography helper is unavailable'));
    if(typeof hazardSource!=='string'||!hazardSource.trim()||Buffer.byteLength(hazardSource)>200000)
      return Promise.reject(failure(503,'Current shared ground-hazard helper is unavailable'));
    const requestedKey=String(requestedRevision)+':'+createHash('sha256').update(source).digest('hex')+
      ':'+createHash('sha256').update(effectsSource).digest('hex')+
      ':'+createHash('sha256').update(livingSource).digest('hex')+
      ':'+createHash('sha256').update(caveSource).digest('hex')+
      ':'+createHash('sha256').update(varietySource).digest('hex')+
      ':'+createHash('sha256').update(villageSource).digest('hex')+
      ':'+createHash('sha256').update(constructionSource).digest('hex')+
      ':'+createHash('sha256').update(cartographySource).digest('hex')+
      ':'+createHash('sha256').update(hazardSource).digest('hex');
    if(worker&&key!==requestedKey)reset(failure(409,'Shared movement source changed; refresh before previewing'));
    if(pending.size>=4)return Promise.reject(failure(503,'Movement preview capacity reached; retry shortly'));
    if(!worker){
      try{
        const current=new Worker('const previewParity='+previewParity.toString()+';('+simulationWorker.toString()+')()',{
          eval:true,workerData:{source,effectsSource,livingSource,caveSource,varietySource,villageSource,constructionSource,cartographySource,hazardSource,validation},env:{},execArgv:[],
          resourceLimits:{maxOldGenerationSizeMb:32,maxYoungGenerationSizeMb:8,stackSizeMb:2}
        });
        worker=current;key=requestedKey;revision=requestedRevision;
        current.on('message',message=>{
          if(worker!==current)return;
          if(message?.fatal||message?.failed){
            const error=failure(503,'Shared movement simulation failed or exceeded its execution limit');
            const d=message.diagnostic;
            const stages=['core','fox','fox-search','fox-select','fox-collect','fox-finalize','social','social-turn','chest','frontier','sinking','construction','village','hazard','structures','cartography','enemy-init','enemy-turn-advance','enemy-population','contact','region','living','assistance','progression','treasure','stringify','cave','cave-turn','harvest','finish','input','compile'];
            const names=['Error','TypeError','RangeError','ReferenceError','SyntaxError','EvalError','URIError'];
            if(validation&&d&&stages.includes(d.stage)&&stages.includes(d.previousStage)&&names.includes(d.errorName)&&
              Number.isSafeInteger(d.elapsedInStageMs)&&d.elapsedInStageMs>=0&&d.elapsedInStageMs<=60000&&
              Number.isSafeInteger(d.elapsedMs)&&d.elapsedMs>=0&&d.elapsedMs<=60000&&d.elapsedInStageMs<=d.elapsedMs&&d.limitMs===100&&
              Array.isArray(d.intervals)&&d.intervals.length<=24&&
              d.intervals.every(interval=>interval&&typeof interval==='object'&&!Array.isArray(interval)&&
                Object.keys(interval).length===2&&Object.hasOwn(interval,'name')&&Object.hasOwn(interval,'ms')&&
                stages.includes(interval.name)&&Number.isSafeInteger(interval.ms)&&interval.ms>=0&&interval.ms<=d.elapsedMs)&&
              (!d.intervals.length||d.intervals.at(-1).name===d.previousStage)&&
              (d.errorMessage==='Script execution timed out after 100ms'||d.errorMessage===d.errorName+' during movement simulation (message redacted)')){
              error.diagnostic={stage:d.stage,previousStage:d.previousStage,intervals:d.intervals.map(({name,ms})=>({name,ms})),elapsedInStageMs:d.elapsedInStageMs,errorName:d.errorName,errorMessage:d.errorMessage,elapsedMs:d.elapsedMs,limitMs:100};
            }
            if(message.failed){
              const entry=pending.get(message.id);
              if(entry){clearTimeout(entry.timer);pending.delete(message.id);entry.reject(error);}
              reset(failure(503,'Shared movement simulation failed or exceeded its execution limit'));
            }else reset(error);
            return;
          }
          const entry=pending.get(message?.id);if(!entry)return;
          try{
            if(typeof message.result!=='string'||Buffer.byteLength(message.result)>250000)throw Error();
            const prediction=JSON.parse(message.result);
            if(prediction!==null&&(!prediction||typeof prediction!=='object'||Array.isArray(prediction)||
              !prediction.data||typeof prediction.data!=='object'||Array.isArray(prediction.data)||typeof prediction.activity!=='string'))throw Error();
            clearTimeout(entry.timer);pending.delete(message.id);entry.resolve(prediction);
          }catch{reset(failure(503,'Shared movement core returned an invalid prediction'));}
        });
        current.on('error',()=>{if(worker===current)reset(failure(503,'Movement preview worker failed'));});
        current.on('exit',()=>{if(worker===current)reset(failure(503,'Movement preview worker exited'));});
      }catch{reset();return Promise.reject(failure(503,'Movement preview worker could not start'));}
    }
    return new Promise((resolve,reject)=>{
      const id=++nextId;
      const timer=setTimeout(()=>reset(failure(503,'Movement preview timed out')),10000);
      pending.set(id,{resolve,reject,timer});
      try{worker.postMessage({id,input:{world:structuredClone(world),action:structuredClone(action)}});}
      catch{reset(failure(503,'Movement preview snapshot could not be copied'));}
    });
  }
  return {run,invalidate,close:()=>reset(failure(503,'Movement preview is shutting down'))};
}
