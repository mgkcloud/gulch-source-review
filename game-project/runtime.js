const Gulch=(()=>{
const modules=new Map();let current=null,focused=false;
const post=data=>parent.postMessage(data,'*');
function error(name,e){
  const box=document.getElementById('moduleErrors');
  box.textContent=`Module ${name}: ${String(e.message||e).slice(0,300)}`;
  post({type:'gulch:module-error',module:name,message:String(e.message||e).slice(0,300)});
}
function dispatch(method,value){for(const [name,mod] of modules){try{mod[method]?.(value);}catch(e){error(name,e);}}}
function view(s){
  const data=s.gameState,seed=data.seed,p=seed.entities.find(e=>e.id==='player');
  const map=seed.maps.find(m=>m.id===p.map),r=seed.meta.fov.radius;
  return {...s,seed,player:p,mapId:p.map,turn:data.turn,lit:map.ascii.map((row,y)=>Array.from(row,(_,x)=>Math.hypot(x-p.x,y-p.y)<=r+.5?1:0))};
}
window.addEventListener('message',e=>{
  if(e.source!==parent||!e.data||typeof e.data!=='object')return;
  if(e.data.type==='gulch:snapshot'&&e.data.snapshot?.gameState){
    current=e.data.snapshot;try{dispatch('snapshot',view(current));}catch(e){error('state',e);}
  }
  if(e.data.type==='gulch:focus'&&typeof e.data.granted==='boolean'){
    focused=e.data.granted;document.getElementById('focusHint').textContent=focused?'game keys active — Esc returns to chat':'click map for keys';
  }
  if(e.data.type==='gulch:action'&&e.data.action)dispatch('action',e.data.action);
});
function action(a){if(focused)dispatch('action',a);}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){post({type:'gulch:focus-chat'});return;}
  const keys={w:[0,-1],ArrowUp:[0,-1],s:[0,1],ArrowDown:[0,1],a:[-1,0],ArrowLeft:[-1,0],d:[1,0],ArrowRight:[1,0]};
  if(keys[e.key]){e.preventDefault();const [dx,dy]=keys[e.key];action({type:'move',dx,dy});}
  if(e.key==='>')action({type:'descend'});
});
document.addEventListener('pointerdown',()=>{focused=true;post({type:'gulch:request-focus'});});
document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const [dx,dy]=b.dataset.move.split(',').map(Number);action({type:'move',dx,dy});});
document.getElementById('descendBtn').onclick=()=>action({type:'descend'});
window.addEventListener('resize',()=>dispatch('resize'));
window.addEventListener('error',e=>error('script',e.error||e.message));
window.addEventListener('unhandledrejection',e=>error('promise',e.reason));
window.addEventListener('load',()=>post({type:'gulch:ready'}));
return {register(name,callbacks){modules.set(name,callbacks);},commit(data,activity=''){
  if(current)post({type:'gulch:commit',base:current.stateRevision,revision:current.revision,data,activity});
}};
})();
