(function(){
let snapshot;
function change(action){
  if(!snapshot)return;
  const data=structuredClone(snapshot.gameState);
  const seed=data.seed, p=seed.entities.find(e=>e.id==='player');
  let map=seed.maps.find(m=>m.id===p.map), note='';
  if(action.type==='move'){
    const x=p.x+action.dx,y=p.y+action.dy;
    const ch=map.ascii[y]?.[x], kind=seed.legend[ch]?.[0];
    const entity=seed.entities.find(e=>e.id!=='player'&&e.map===p.map&&e.x===x&&e.y===y);
    if(!ch||['wall','water'].includes(kind))note='Blocked.';
    else if(entity){
      if(entity.faction==='hostile'){entity.hp=Math.max(0,(entity.hp||4)-2);data.turn++;note=`You hit ${entity.name}.`;if(!entity.hp){seed.entities=seed.entities.filter(e=>e.id!==entity.id);note=`You defeat ${entity.name}.`;}}
      else note=`You meet ${entity.name}. ${entity.dialogue||''}`;
    }
    else {p.x=x;p.y=y;data.turn++;note=`You stand on ${seed.legend[ch]?.[1]||'ground'}.`;
      for(const e of seed.entities.filter(e=>e.ai==='chase'&&e.map===p.map)){
        const distance=Math.hypot(e.x-p.x,e.y-p.y);
        if(distance<9&&distance>1.2){
          const nx=e.x+(Math.abs(p.x-e.x)>Math.abs(p.y-e.y)?Math.sign(p.x-e.x):0);
          const ny=e.y+(nx===e.x?Math.sign(p.y-e.y):0);
          if(map.ascii[ny]?.[nx]&&!['wall','water'].includes(seed.legend[map.ascii[ny][nx]]?.[0])&&!seed.entities.some(other=>other.id!==e.id&&other.map===e.map&&other.x===nx&&other.y===ny)){e.x=nx;e.y=ny;}
        }
      }
    }
  }else if(action.type==='descend'){
    const exit=map.exits?.find(e=>e.x===p.x&&e.y===p.y);
    if(exit){p.map=exit.to;p.x=exit.at.x;p.y=exit.at.y;data.turn++;note='You descend.';}
    else note='Nothing to descend here.';
  }else return;
  Gulch.commit(data,note);
}
Gulch.register('world',{snapshot(s){snapshot=s;},action:change});
})();
