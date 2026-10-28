(function(){
'use strict';
const base=globalThis.GulchGroundHazardEffects;
if(!base)return;
function clusters(cells){
 const remaining=new Map(cells.map(c=>[c.kind+':'+c.x+','+c.y,c])),groups=[];
 while(remaining.size){
  const first=remaining.values().next().value,group=[first];remaining.delete(first.kind+':'+first.x+','+first.y);
  for(let i=0;i<group.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const c=group[i],key=c.kind+':'+(c.x+dx)+','+(c.y+dy),next=remaining.get(key);
   if(next){remaining.delete(key);group.push(next);}
  }
  groups.push(group);
 }
 return groups;
}
function bounds(group){
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const c of group){left=Math.min(left,c.x);right=Math.max(right,c.x);top=Math.min(top,c.y);bottom=Math.max(bottom,c.y);}
 return {x:(left+right)/2,y:(top+bottom)/2};
}
function resize(data){
 if(!data?.seed?.maps)return data;
 let changed=false;
 const maps=data.seed.maps.map(map=>{
  const hazards=map.groundHazards;
  if(!Array.isArray(hazards?.cells)||hazards.sizeMultiplier===1.5)return map;
  const originals=hazards.cells.filter(c=>Number.isInteger(c.x)&&Number.isInteger(c.y)&&['poison','lava'].includes(c.kind));
  const exits=new Set((map.exits||[]).map(e=>e.x+','+e.y));
  let previous=originals;
  if(hazards.sizeMultiplier!==3){
   const expanded=new Map(originals.map(c=>[c.x+','+c.y,{...c}]));
   for(const group of clusters(originals)){
    const center=bounds(group);
    for(const c of group)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const x=3*c.x-2*center.x+dx,y=3*c.y-2*center.y+dy,key=x+','+y;
     if(expanded.has(key)||expanded.size>=4096||exits.has(key)||!base.floor(data.seed,map,x,y))continue;
     expanded.set(key,{x,y,kind:c.kind});
    }
   }
   previous=Array.from(expanded.values());
  }
  const smaller=new Map();
  for(const group of clusters(previous)){
   const center=bounds(group);
   const allowed=new Set(group.map(c=>c.x+','+c.y));
   let added=false;
   for(const c of group){
    const x=Math.floor(center.x+(c.x-center.x)*.5+.5),y=Math.floor(center.y+(c.y-center.y)*.5+.5),key=x+','+y;
    if(!allowed.has(key)||exits.has(key)||!base.floor(data.seed,map,x,y))continue;
    if(!smaller.has(key)){smaller.set(key,{x,y,kind:c.kind});added=true;}
   }
   if(!added){
    const c=group.find(c=>!smaller.has(c.x+','+c.y)&&!exits.has(c.x+','+c.y)&&base.floor(data.seed,map,c.x,c.y));
    if(c)smaller.set(c.x+','+c.y,{...c});
   }
  }
  changed=true;
  return {...map,groundHazards:{...hazards,cells:Array.from(smaller.values()),sizeMultiplier:1.5}};
 });
 if(!changed)return data;
 const next={...data,seed:{...data.seed,maps}};
 return new TextEncoder().encode(JSON.stringify(next)).length<350000?next:data;
}
function generate(data){return resize(base.generate(data));}
globalThis.GulchGroundHazardEffects=Object.freeze({...base,generate,apply(data,activity,previousSnapshot){
 return base.apply(generate(data),activity,previousSnapshot);
}});
})();
