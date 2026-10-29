(function(){
'use strict';
const KEY='travelCartography';
const epoch=d=>String(d.respawnSettings?.token||'original');
function shape(map){return {w:Math.max(0,...map.ascii.map(r=>r.length)),h:map.ascii.length};}
function memory(data){const old=data[KEY];return old?.epoch===epoch(data)&&old.maps&&typeof old.maps==='object'?old.maps:{};}
function read(map,record){const {w,h}=shape(map),length=Math.ceil(w*h/4);return record?.w===w&&record.h===h&&typeof record.bits==='string'&&record.bits.length===length&&/^[0-9a-f]*$/.test(record.bits)?record.bits:'0'.repeat(length);}
function seen(bits,w,x,y){const i=y*w+x;return Boolean(parseInt(bits[Math.floor(i/4)]||'0',16)&(1<<(i%4)));}
function utf8Bytes(text){
 if(text===undefined)return 0;
 text=String(text);
 let bytes=0;
 for(let i=0;i<text.length;i++){
  const code=text.charCodeAt(i);
  if(code<128)bytes++;
  else if(code<2048)bytes+=2;
  else if(code>=55296&&code<=56319&&i+1<text.length&&text.charCodeAt(i+1)>=56320&&text.charCodeAt(i+1)<=57343){bytes+=4;i++;}
  else bytes+=3;
 }
 return bytes;
}
function chart(data){
 const seed=data?.seed,p=seed?.entities?.find(e=>e.id==='player'),map=seed?.maps?.find(m=>m.id===p?.map);
 if(!map||!Number.isInteger(p.x)||!Number.isInteger(p.y))return data;
 const {w,h}=shape(map);if(!w||!h||w*h>131072)return data;
 const old=memory(data),bits=read(map,old[map.id]).split('');
 const supplied=Number(seed.meta?.fov?.radius),r=Number.isFinite(supplied)&&supplied>0?Math.min(8,supplied):8;
 let changed=false;
 for(let y=Math.max(0,Math.ceil(p.y-r));y<=Math.min(h-1,Math.floor(p.y+r));y++)for(let x=Math.max(0,Math.ceil(p.x-r));x<=Math.min(map.ascii[y].length-1,Math.floor(p.x+r));x++){
  if(Math.hypot(x-p.x,y-p.y)>r)continue;
  const i=y*w+x,k=Math.floor(i/4),before=parseInt(bits[k],16),after=before|(1<<(i%4));
  if(before!==after){bits[k]=after.toString(16);changed=true;}
 }
 const retained=Object.keys(old).filter(id=>seed.maps.some(m=>m.id===id)&&id!==map.id).slice(-31);
 const maps=Object.fromEntries(retained.map(id=>[id,old[id]]));
 maps[map.id]={w,h,bits:bits.join('')};
 if(!changed&&old[map.id]&&Object.keys(old).length===Object.keys(maps).length)return data;
 const next={...data,[KEY]:{epoch:epoch(data),maps}};
 return utf8Bytes(JSON.stringify(next))<=350000?next:data;
}
globalThis.GulchCartographyEffects=Object.freeze({epoch,shape,memory,read,seen,chart});
})();
