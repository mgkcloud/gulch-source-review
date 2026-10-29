(function(){
'use strict';
const host=document.getElementById('left'),catalog=window.GulchItemCatalog,book=window.GulchRecipeBook;
if(!host||!catalog)return;
const KEY='merchantBarter',items=catalog.items;
let latest=null,pending=null,attempt=null,chosen='',message='';
const epoch=d=>String(d.respawnSettings?.token||'original');
const count=n=>Number.isFinite(n)?Math.max(0,Math.min(999,Math.floor(n))):0;
const value=id=>Math.max(1,Number(book?.value(id)||items[id]?.craftValue)||1);
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
function state(){const v=latest?.gameState[KEY];return v?.epoch===epoch(latest.gameState)?v:null;}
function pack(){const p=latest?.gameState.itemEcosystem;return p?.epoch===epoch(latest.gameState)?p:{epoch:epoch(latest.gameState),bag:{},equipment:{},known:[],crafted:[],log:[]};}
function floor(seed,map,x,y){const c=map?.ascii[y]?.[x];return Boolean(c)&&!['#','~','>'].includes(c)&&!['wall','water'].includes(seed.legend[c]?.[0])&&!map.exits?.some(e=>e.x===x&&e.y===y);}
function random(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h=(Math.imul(h,1664525)+1013904223)|0;return (h>>>0)/4294967296;};}
function setup(){
 if(!latest||state()||latest.player.hp<=0||document.hidden||window.GulchMovementState?.inFlight||attempt===latest.stateRevision)return;
 const s=latest,seed=s.seed,map=seed.maps.find(m=>m.id===s.mapId),p=s.player;
 if(!map)return;
 const occupied=new Set(seed.entities.filter(e=>e.map===map.id).map(e=>e.x+','+e.y));
 const hazards=[...(map.groundHazards?.cells||[]),...(map.dynamicRegion?.sites||[]),...(s.gameState.legendarySwordQuest?.sites||[]).filter(e=>e.map===map.id),...(s.gameState.wayfarerPilgrimage?.sites||[]).filter(e=>e.map===map.id)];
 const queue=[{x:p.x,y:p.y}],seen=new Set([p.x+','+p.y]);
 for(let i=0;i<queue.length&&i<16000;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i].x+dx,y=queue[i].y+dy,k=x+','+y;if(!seen.has(k)&&floor(seed,map,x,y)&&!occupied.has(k)){seen.add(k);queue.push({x,y});}}
 const safe=q=>!occupied.has(q.x+','+q.y)&&Math.hypot(q.x-p.x,q.y-p.y)>4&&hazards.every(h=>Math.hypot(h.x-q.x,h.y-q.y)>2)&&seed.entities.every(e=>e.map!==map.id||e.faction!=='hostile'||Math.hypot(e.x-q.x,e.y-q.y)>5);
 const candidates=queue.filter(q=>safe(q)&&[[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy])=>seen.has((q.x+dx)+','+(q.y+dy))));
 const rng=random(String(s.gameState.respawnSettings?.generationSeed||seed.meta?.seed||'gulch')+':market:'+map.id);
 for(let i=candidates.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
 let center=null,sites=[];
 for(const q of candidates.slice(0,300)){
  const nearby=candidates.filter(v=>Math.hypot(v.x-q.x,v.y-q.y)<=11).sort((a,b)=>Math.hypot(a.x-q.x,a.y-q.y)-Math.hypot(b.x-q.x,b.y-q.y));
  const selected=[];for(const v of nearby)if(selected.every(t=>Math.hypot(t.x-v.x,t.y-v.y)>=3))selected.push(v);
  if(selected.length>=11){center=q;sites=selected.slice(0,11);break;}
 }
 if(!center){message='A trading town needs a larger safe clearing. Explore another region; merchants will settle when space is available.';render();return;}
 const entities=seed.entities.slice(),ids=new Set(entities.map(e=>e.id)),vendors={};
 function add(q,name,extra){let id='market:'+map.id+':'+entities.length;while(ids.has(id))id+='x';ids.add(id);entities.push({id,map:map.id,x:q.x,y:q.y,name,kind:'villager',faction:'friendly',outsideNPC:true,dialogue:'Welcome to Coppercross Market. Stand directly beside a trader and open Trade to barter recovered goods.',...extra});return id;}
 const types=['Weapon','Armor','Consumable','Material','Relic'];
 function merchant(q,index,roaming){const type=types[index%types.length],name=(roaming?'Road trader ':'Coppercross ')+['armsmith','armorer','apothecary','tinker','antiquarian'][index%5];const id=add(q,name,{barterMerchant:true});const stock={};for(const item of Object.values(items))if(item.type===type)stock[item.id]=item.type==='Material'?18:6;vendors[id]={stock,type};}
 for(let i=0;i<5;i++)merchant(sites[i],i,false);
 for(let i=5;i<11;i++)add(sites[i],['Mira the porter','Oren the cook','Nessa the courier','Bram the guard','Elin the gardener','Tobin the traveler'][i-5],{dialogue:'Coppercross is our trading town. Five specialist stalls exchange recipe-book goods. Roaming traders also camp along the roads.'});
 const used=sites.slice();
 for(const q of candidates){if(Object.keys(vendors).length>=8)break;if(Math.hypot(q.x-center.x,q.y-center.y)<15||used.some(v=>Math.hypot(v.x-q.x,v.y-q.y)<5))continue;merchant(q,Math.floor(rng()*5),true);used.push(q);}
 const landmarks=[...(map.landmarks||[]),{name:'Coppercross Market',type:'trading-town',map:map.id,x:center.x,y:center.y}];
 const next={...s.gameState,seed:{...seed,entities,maps:seed.maps.map(m=>m.id===map.id?{...m,landmarks}:m)},[KEY]:{epoch:epoch(s.gameState),town:{map:map.id,x:center.x,y:center.y,name:'Coppercross Market'},vendors}};
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000){message='The shared world lacks space for the trading town.';render();return;}
 attempt=s.stateRevision;Gulch.commit(next,'Coppercross Market founded: five specialist traders, six residents and roaming merchants. Open Trade for directions.');
}
const style=el('style');style.textContent='#tradeToggle{position:absolute;right:12px;top:160px;z-index:5;min-height:40px;padding:8px 12px;background:#26392e;color:#f5dfa8;border:1px solid #aa956b;border-radius:5px;font:12px monospace}#tradePanel[hidden]{display:none!important}#tradePanel{position:absolute;right:12px;top:60px;bottom:12px;width:min(520px,calc(100% - 24px));z-index:96;overflow:auto;padding:18px;background:#10252afa;border:2px solid #ac9565;border-radius:8px;color:#e3e8d6;font:12px/1.6 monospace}#tradePanel header{display:flex;justify-content:space-between;align-items:center;gap:10px}#tradePanel h2{font-size:18px;color:#f2d69a}#tradePanel select,#tradePanel input,#tradePanel button{min-height:42px;padding:8px;background:#203b35;color:#f2e4be;border:1px solid #829777;border-radius:4px;font:inherit;max-width:100%}#tradePanel label{display:block;margin:12px 0 5px}#tradePanel select{width:100%}#tradePanel input{width:100px}#tradePanel button:disabled{opacity:.5}#tradePanel :focus-visible{outline:2px solid #ffe2a0;outline-offset:2px}#tradePanel output{display:block;padding:12px;border:1px solid #637e65;margin:12px 0;white-space:pre-line}#tradePanel li{margin:8px 0}';document.head.append(style);
const toggle=button('Trade',()=>show(panel.hidden));toggle.id='tradeToggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','tradePanel');
const panel=el('section');panel.id='tradePanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-label','Merchant barter');
const header=el('header');header.append(el('h2','COPPERCROSS EXCHANGE'),button('Close',()=>show(false)));
const directions=el('p'),vendors=el('select'),offer=el('select'),want=el('select'),amount=el('input');amount.type='number';amount.min='1';amount.max='99';amount.step='1';amount.value='1';
function field(label,n,id){const l=el('label',label);l.htmlFor=id;n.id=id;panel.append(l,n);}
const quote=el('output'),trade=button('Confirm barter',barter),status=el('p'),locations=el('ul');status.setAttribute('role','status');
panel.append(header,directions,el('p','Exchange one kind of carried item for another. Prices use recipe-book values with a 20% merchant markup, rounded up. Equipped copies are reserved. Trading takes no turns. Stock is shared and finite; goods you sell become available at that stall.'));
field('Merchant',vendors,'barterVendor');field('Receive',want,'barterReceive');field('Quantity to receive',amount,'barterQuantity');field('Pay with',offer,'barterOffer');panel.append(quote,trade,status,el('h3','Town and roaming traders'),locations);host.append(toggle,panel);
let previousFocus=null;
function blocked(){return ['inventoryPanel','characterPanel','questBoard','workBoard','livingPanel','respawnScreen','interfaceMenu'].some(id=>{const n=document.getElementById(id);return n&&!n.hidden;});}
function show(open){if(open&&(!latest||latest.player.hp<=0||blocked()))return;if(open)previousFocus=document.activeElement;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open){render();vendors.focus();}else(previousFocus?.isConnected&&!previousFocus.closest('[hidden],[inert]')?previousFocus:toggle).focus();}
function nearby(e){return e&&e.map===latest.mapId&&Math.abs(e.x-latest.player.x)+Math.abs(e.y-latest.player.y)<=1;}
function free(id){const p=pack();return Math.max(0,count(p.bag?.[id])-Object.values(p.equipment||{}).filter(v=>v===id).length);}
function options(select,rows){const old=select.value;select.replaceChildren(...rows.map(([id,text])=>{const o=el('option',text);o.value=id;return o;}));if(rows.some(r=>r[0]===old))select.value=old;}
function proposal(){const s=state(),v=s?.vendors[vendors.value],receive=want.value,pay=offer.value,n=Number(amount.value);if(!v||!items[receive]||!items[pay]||pay===receive||!Number.isInteger(n)||n<1||n>99)return null;const cost=Math.ceil(value(receive)*n*1.2/value(pay));return {v,receive,pay,n,cost};}
function enabled(){return latest&&latest.player.hp>0&&!latest.gameState.gulchPermanentGameOver?.ended&&window.GulchMovementState?.focused&&!window.GulchMovementState.inFlight&&!pending&&!blocked();}
function render(){
 if(panel.hidden||!latest)return;
 const s=state();status.textContent=message;
 if(!s){directions.textContent='Seeking a safe, spacious region for Coppercross Market.';trade.disabled=true;return;}
 const town=s.town;directions.textContent=town.name+' · '+(latest.seed.maps.find(m=>m.id===town.map)?.name||town.map)+' · '+town.x+', '+town.y+'. Stand directly beside a trader to exchange goods.';
 const list=latest.seed.entities.filter(e=>s.vendors[e.id]);
 options(vendors,list.map(e=>[e.id,e.name+' · '+e.x+', '+e.y+(nearby(e)?' · NEARBY':'')]));
 if(chosen&&list.some(e=>e.id===chosen))vendors.value=chosen;
 const v=s.vendors[vendors.value];
 options(want,Object.entries(v?.stock||{}).filter(([id,n])=>items[id]&&count(n)>0).map(([id,n])=>[id,items[id].name+' · stock '+count(n)+' · value '+value(id)]));
 options(offer,Object.keys(pack().bag||{}).filter(id=>items[id]&&free(id)>0&&id!==want.value).map(id=>[id,items[id].name+' · '+free(id)+' free · value '+value(id)]));
 const q=proposal(),e=list.find(e=>e.id===vendors.value);
 quote.textContent=q?'Receive '+q.n+' × '+items[q.receive].name+'\nPay '+q.cost+' × '+items[q.pay].name+' ('+free(q.pay)+' available)\n'+(items[q.receive].description||''):'Choose stocked goods and a different carried item to offer.';
 trade.disabled=!enabled()||!nearby(e)||!q||q.cost>free(q.pay)||q.n>count(q.v.stock[q.receive])||count(pack().bag[q.receive])+q.n>999||count(q.v.stock[q.pay])+q.cost>999;
 if(!pending&&e&&!nearby(e))status.textContent='Travel to '+e.name+' at '+e.x+', '+e.y+' in '+(latest.seed.maps.find(m=>m.id===e.map)?.name||e.map)+'.';
 locations.replaceChildren(...list.map(e=>{const li=el('li');li.append(button(e.name+' · '+e.x+', '+e.y,()=>{chosen=e.id;vendors.value=e.id;render();}));return li;}));
}
function barter(){
 const q=proposal(),s=state(),merchant=latest?.seed.entities.find(e=>e.id===vendors.value);
 if(!enabled()||!q||!nearby(merchant)||q.cost>free(q.pay)||q.n>count(q.v.stock[q.receive]))return;
 const p=pack();if(count(p.bag[q.receive])+q.n>999||count(q.v.stock[q.pay])+q.cost>999)return;
 const bag={...p.bag,[q.pay]:count(p.bag[q.pay])-q.cost,[q.receive]:count(p.bag[q.receive])+q.n};
 const stock={...q.v.stock,[q.receive]:count(q.v.stock[q.receive])-q.n,[q.pay]:count(q.v.stock[q.pay])+q.cost};
 const text='Bartered '+q.cost+' '+items[q.pay].name+' for '+q.n+' '+items[q.receive].name+' with '+merchant.name+'.';
 const token=String(latest.stateRevision)+':'+Date.now()+':'+Math.random().toString(36).slice(2);
 const next={...latest.gameState,itemEcosystem:{...p,bag,known:Array.from(new Set([...(p.known||[]),q.receive])),log:[text,...(p.log||[])].slice(0,12)},[KEY]:{...s,vendors:{...s.vendors,[merchant.id]:{...q.v,stock}},receipt:token}};
 if(new TextEncoder().encode(JSON.stringify(next)).length>350000){message='Trade exceeds shared-state capacity. No goods exchanged.';render();return;}
 pending={base:latest.stateRevision,token,epoch:epoch(next),text};message='Waiting for room confirmation…';
 Gulch.commit(next,text);
 if(!window.GulchMovementState?.inFlight){pending=null;message='Trade was not submitted. Try again when the room is ready.';}render();
}
vendors.addEventListener('change',()=>{chosen=vendors.value;render();});want.addEventListener('change',render);offer.addEventListener('change',render);amount.addEventListener('input',render);
panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();show(false);}});
const canvas=el('canvas');canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2';host.append(canvas);
function paint(){const w=host.clientWidth,h=host.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));canvas.style.width=w+'px';canvas.style.height=h+'px';}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);if(!latest)return;const s=state();if(!s)return;const p=latest.player,v=window.GulchMovementState?.visual,camera=v?.map===p.map?v:p,ts=Math.max(20,Math.min(64,Number(latest.seed.meta?.tileSize)||32));for(const e of latest.seed.entities){if(!s.vendors[e.id]||e.map!==p.map||latest.lit[e.y]?.[e.x]!==1)continue;const x=w/2+(e.x-camera.x)*ts,y=h/2+(e.y-camera.y)*ts;c.fillStyle='#142821';c.fillRect(x-17,y-ts*.8,34,14);c.fillStyle='#ffdf94';c.font='10px monospace';c.textAlign='center';c.fillText('TRADE',x,y-ts*.8+10);}}
Gulch.register('merchant-barter',{snapshot(s){const reset=latest&&epoch(latest.gameState)!==epoch(s.gameState);latest=s;if(reset){pending=null;chosen='';attempt=null;message='New expedition: merchant stock resets.';}if(pending&&s.stateRevision!==pending.base){const r=pending;pending=null;message=epoch(s.gameState)===r.epoch&&state()?.receipt===r.token?r.text:'Another room update won. Check your pack and retry the trade.';}if(s.player.hp<=0&&!panel.hidden)show(false);setup();render();paint();},resize:paint});
new MutationObserver(()=>{if(!panel.hidden&&blocked())show(false);}).observe(host,{subtree:true,attributes:true,attributeFilter:['hidden']});
setInterval(()=>{if(document.hidden)return;setup();render();paint();},500);
})();
