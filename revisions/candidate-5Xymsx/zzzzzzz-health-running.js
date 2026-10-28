(function(){
'use strict';
const host=document.getElementById('left');
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');style.textContent=`
#vitalPanel{position:absolute;left:18px;bottom:48px;width:min(330px,calc(100% - 185px));z-index:3;padding:12px;border:1px solid #718e77;border-radius:10px;background:#10252bf5;color:#e0e8d8;pointer-events:none;font:11px/1.5 monospace;box-shadow:0 8px 28px #0007}
#vitalPanel header{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px}#vitalName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f0dfb5}#vitalCondition{font-size:10px}
#vitalTrack{height:26px;position:relative;overflow:hidden;background:#040d12;border:1px solid #718e77;border-radius:4px;width:100%}#vitalFill{position:absolute;left:0;top:0;bottom:0;width:0;background:#77bf8c}#vitalValue{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-weight:bold;text-shadow:0 1px 3px #000,1px 0 #000}
#vitalPanel[data-health=wounded] #vitalFill{background:#c7a256}#vitalPanel[data-health=critical] #vitalFill{background:#de655b}#vitalPanel[data-health=critical],#vitalPanel[data-health=depleted]{border-color:#ed8978}#vitalPanel[data-health=critical] #vitalCondition{color:#ffb09a}
#vitalPanel p{margin:6px 0 0}#runningTrack{height:6px;margin-top:7px;background:#061419;overflow:hidden;border-radius:4px}#runningFill{height:100%;width:0;background:#d8c386}#vitalNotice{min-height:16px;color:#f3d598}#runningInfo{color:#b4cdbf;font-size:10px}
@media(max-width:700px){#vitalPanel{left:10px;bottom:35px;width:calc(100% - 165px);padding:9px}#vitalPanel header{flex-wrap:wrap}}
@media(max-height:480px){#vitalPanel{bottom:25px;padding:8px}#vitalNotice{display:none}}
`;document.head.append(style);
const panel=el('section');panel.id='vitalPanel';panel.setAttribute('aria-label','Health and running progression');
const header=el('header'),name=el('strong','Adventurer'),condition=el('span','WAITING');name.id='vitalName';condition.id='vitalCondition';header.append(name,condition);
const track=el('div');track.id='vitalTrack';track.setAttribute('role','progressbar');track.setAttribute('aria-label','Health');track.setAttribute('aria-valuemin','0');
const fill=el('div'),value=el('span','Waiting for health');fill.id='vitalFill';value.id='vitalValue';track.append(fill,value);
const running=el('p','RUNNING · LEVEL 1'),xpTrack=el('div'),xpFill=el('div'),info=el('p'),notice=el('p');xpTrack.id='runningTrack';xpFill.id='runningFill';info.id='runningInfo';notice.id='vitalNotice';notice.setAttribute('role','status');xpTrack.append(xpFill);panel.append(header,track,running,xpTrack,info,notice);host.append(panel);
let previous=null;
function number(v,fallback){const n=Number(v);return v!==null&&v!==''&&Number.isFinite(n)?n:fallback;}
function format(n){return Number.isInteger(n)?String(n):String(Math.round(n*100)/100);}
Gulch.register('health-running',{snapshot(s){
 const p=s.player,epoch=String(s.gameState.respawnSettings?.token||'original');
 const max=Math.max(1,number(p.maxHp,20));
 const hp=s.gameState.gulchPermanentGameOver?.ended?0:Math.max(0,Math.min(max,number(p.hp,max)));
 const ratio=hp/max,state=hp===0?'depleted':ratio<=.25?'critical':ratio<=.6?'wounded':'healthy';
 panel.dataset.health=state;name.textContent=String(p.name||'Adventurer');condition.textContent=hp===0?'DEAD':state.toUpperCase();
 fill.style.width=(ratio*100)+'%';value.textContent=format(hp)+' / '+format(max)+' HP';
 track.setAttribute('aria-valuemax',String(max));track.setAttribute('aria-valuenow',String(hp));track.setAttribute('aria-valuetext',format(hp)+' of '+format(max)+' health');
 const progress=s.gameState.runningProgress||{},xp=Math.max(0,Math.min(100000000,Math.floor(number(progress.xp,0))));
 let level=1,start=0,cost=20;
 while(level<100&&xp>=start+cost){start+=cost;level++;cost=20*level;}
 running.textContent='RUNNING · LEVEL '+level;
 xpFill.style.width=(level===100?100:(xp-start)/cost*100)+'%';
 info.textContent=(level===100?'Maximum level':(xp-start)+' / '+cost+' XP')+' · '+Math.max(0,number(progress.distance,0)).toFixed(1)+' tiles';
 if(hp===0)notice.textContent='Expedition ended. Choose a new world.';
 else if(previous&&previous.epoch===epoch&&hp<previous.hp)notice.textContent='−'+format(previous.hp-hp)+' HP · '+(state==='critical'?'Heal or retreat!':'Enemy hit');
 else if(previous&&previous.epoch===epoch&&hp>previous.hp)notice.textContent='+'+format(hp-previous.hp)+' HP restored';
 else notice.textContent=state==='critical'?'Critical health · heal or retreat!':'10 XP per confirmed move';
 previous={epoch,hp};
}});
})();
