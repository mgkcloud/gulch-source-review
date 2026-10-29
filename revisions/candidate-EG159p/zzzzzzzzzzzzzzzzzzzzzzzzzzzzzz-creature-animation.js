(function(){
'use strict';
const base=window.GulchCaveEnemies;
if(!base||typeof base.sprite!=='function')return;
window.GulchCaveEnemies=Object.freeze({...base,sprite(ctx,e,x,y,ts,alpha){
 const live=e.hp==null||Number(e.hp)>0;
 let phase=live&&alpha===1?(window.GulchLifeAnimation?.phase()||0):0;
 let parity=0;for(const c of String(e.id))parity=(parity+c.charCodeAt(0))%2;
 if(parity)phase=-phase;
 const floating=e.enemyVariety==='storm'||e.caveSprite==='wisp';
 const amount=Math.min(1.5,ts/32);
 ctx.save();
 ctx.translate(x,y);
 if(floating)ctx.translate(phase*amount*.5,phase*amount);
 else{ctx.translate(phase*amount,0);ctx.rotate(phase*.018);}
 ctx.translate(-x,-y);
 try{base.sprite(ctx,e,x,y,ts,alpha);}finally{ctx.restore();}
}});
})();
