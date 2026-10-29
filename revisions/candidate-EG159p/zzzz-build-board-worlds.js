(function(){
'use strict';
const board=document.getElementById('workBoard');
if(!board)return;
let snapshot=null,theme='signal';
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
const style=el('style');
style.textContent=`
#workBoard{--world-bg:#041723;--world-card:#092632;--world-line:#246073;--world-text:#d3edf0;--world-muted:#8eafb9;--world-accent:#62e8eb;background:var(--world-bg);color:var(--world-text);border:1px solid var(--world-line);border-radius:16px;box-shadow:0 24px 90px #001018cc}
#workBoard[data-world=orbit]{--world-bg:#f6f9fa;--world-card:#fff;--world-line:#c5dadd;--world-text:#324d59;--world-muted:#627e87;--world-accent:#a62c65;box-shadow:0 24px 90px #172b4466}
#workBoard .bb-head{background:var(--world-bg);border-color:var(--world-line);padding:12px 20px}
#workBoard .bb-head h2{font-size:14px;letter-spacing:3px;color:var(--world-text)}
#workBoard .bb-muted,#workBoard .bb-empty,#workBoard .code-note,#workBoard .code-stamp{color:var(--world-muted)}
#workBoard .bb-head .bb-muted{font-size:11px}
.build-world{position:relative;isolation:isolate;flex:0 0 166px;overflow:hidden;border-bottom:1px solid var(--world-line);background:radial-gradient(ellipse at 78% 45%,#075061,#041723 70%)}
#workBoard[data-world=orbit] .build-world{background:radial-gradient(ellipse at 78% 45%,#fff,#eaf4f6)}
.build-world canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.build-world-copy{position:relative;z-index:1;padding:20px 24px;width:55%;pointer-events:none}
.build-world-kicker{font-size:9px;letter-spacing:3px;color:var(--world-accent);margin:0 0 8px}
#workBoard .build-world-copy h3{font:500 27px/1.1 ui-sans-serif,system-ui,sans-serif;letter-spacing:-1px;color:var(--world-text);margin:0 0 8px}
.build-world-caption{font-size:11px;line-height:1.5;color:var(--world-muted);margin:0;max-width:310px}
.build-world-badge{display:inline-block;margin-top:12px;font-size:10px;color:var(--world-accent);letter-spacing:1px}
.build-world-switch{position:absolute;right:14px;bottom:10px;display:flex;gap:5px;z-index:2}
#workBoard .build-world-switch button{min-height:30px;padding:5px 9px;font-size:10px;border-radius:20px;background:var(--world-bg)}
#workBoard button,#workBoard textarea,#workBoard .code-tools input{background:var(--world-card);color:var(--world-text);border-color:var(--world-line)}
#workBoard button:hover{background:var(--world-bg);border-color:var(--world-accent)}
#workBoard button[aria-pressed=true]{background:var(--world-card);color:var(--world-accent);border-color:var(--world-accent)}
#workBoard button:focus-visible,#workBoard summary:focus-visible,#workBoard input:focus-visible,#workBoard textarea:focus-visible{outline:2px solid var(--world-accent);outline-offset:3px}
#workBoard .bb-toolbar,#workBoard .bb-tree,#workBoard .bb-foot,#workBoard .bb-live,#workBoard .code-live{border-color:var(--world-line);background:var(--world-bg)}
#workBoard .bb-toolbar{padding:8px 16px}#workBoard .bb-toolbar button{min-height:34px;font-size:11px}
#workBoard .bb-toolbar span,#workBoard .bb-foot,#workBoard .bb-live-title span,#workBoard .bb-live-note{color:var(--world-muted)}
#workBoard .bb-live{max-height:145px;padding:10px 16px}
#workBoard .bb-live-cell{background:var(--world-card);border-color:var(--world-line);border-radius:7px;padding:7px 10px}
#workBoard .bb-live-cell dt{color:var(--world-muted);font-size:9px}
#workBoard .bb-live-cell dd{color:var(--world-text);font-size:14px}
#workBoard .bb-live-title strong,#workBoard .bb-live summary,#workBoard .bb-tree summary,#workBoard .bb-inspector summary,#workBoard .bb-inspector h3,#workBoard .code-live>summary,#workBoard .code-tree summary{color:var(--world-text)}
#workBoard .bb-inspector details,#workBoard .bb-note,#workBoard .bb-tree .bb-task{background:var(--world-card);border-color:var(--world-line)}
#workBoard .bb-branch,#workBoard .code-tree details,#workBoard .bb-result{border-color:var(--world-line)}
#workBoard .bb-task[aria-pressed=true]{box-shadow:inset 3px 0 var(--world-accent)}
#workBoard .bb-progress{accent-color:var(--world-accent)}
#workBoard .bb-events,#workBoard .bb-live ol,#workBoard .code-value{color:var(--world-text)}
#workBoard .bb-note small{color:var(--world-muted)}
#workBoard .code-change{color:var(--world-accent);border-color:var(--world-accent)}
#workBoard[data-world=orbit] .bb-result.pass{color:#287044}#workBoard[data-world=orbit] .bb-result.fail,#workBoard[data-world=orbit] .code-warning{color:#a02e40}#workBoard[data-world=orbit] .bb-result.running{color:#916416}
#workBoard .code-live-body{max-height:32vh}
#workBoard{scrollbar-color:var(--world-line) var(--world-bg)}
@media(max-width:700px){.build-world{flex-basis:148px}.build-world-copy{padding:16px;width:58%}#workBoard .build-world-copy h3{font-size:21px}.build-world-caption{font-size:10px}.build-world-kicker{letter-spacing:1.5px}.build-world-switch{right:8px;bottom:8px}#workBoard .bb-live{max-height:100px}#workBoard .bb-head{padding:10px 14px}}
@media(max-height:650px){.build-world{flex-basis:106px}.build-world-copy{padding:12px 18px}.build-world-caption{display:none}.build-world-badge{margin-top:7px}#workBoard .bb-live{max-height:80px}#workBoard .bb-foot{display:none}}
`;
document.head.append(style);
board.dataset.world=theme;
const hero=el('section');hero.className='build-world';hero.setAttribute('aria-label','Live room overview');
const canvas=el('canvas');canvas.setAttribute('aria-hidden','true');
const copy=el('div');copy.className='build-world-copy';
const kicker=el('p','GULCH / BUILD OBSERVATORY');kicker.className='build-world-kicker';
const title=el('h3','A world taking shape.');
const caption=el('p','Follow the room, inspect its systems, and watch each shared change ripple through.');caption.className='build-world-caption';
const badge=el('span','AWAITING ROOM');badge.className='build-world-badge';
copy.append(kicker,title,caption,badge);
const switches=el('div');switches.className='build-world-switch';switches.setAttribute('role','group');switches.setAttribute('aria-label','Build board appearance');
const buttons=[];
[['signal','Signal globe'],['orbit','Cloud atlas']].forEach(([value,label])=>{const b=el('button',label);b.type='button';b.setAttribute('aria-pressed',String(value===theme));b.addEventListener('click',()=>{theme=value;board.dataset.world=value;buttons.forEach(v=>v.b.setAttribute('aria-pressed',String(v.value===theme)));draw(performance.now());});buttons.push({value,b});switches.append(b);});
hero.append(canvas,copy,switches);board.querySelector('.bb-head').after(hero);
function line(ctx,points,color,width){ctx.strokeStyle=color;ctx.lineWidth=width||1;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
function ellipse(ctx,x,y,rx,ry,color,width){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=width||1;ctx.stroke();}
function draw(now){
 if(board.hidden)return;
 const w=hero.clientWidth,h=hero.clientHeight;if(!w||!h)return;
 const dpr=Math.min(window.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const x=w*.77,y=h*.46,r=Math.min(h*.68,w*.21),angle=reduced.matches?0:now*.000055;
 if(theme==='signal'){
 const g=ctx.createRadialGradient(x,y,0,x,y,r*1.7);g.addColorStop(0,'#0b9d9c50');g.addColorStop(1,'#02b9cc00');ctx.fillStyle=g;ctx.fillRect(x-r*1.7,0,r*3.4,h);
 for(let i=0;i<22;i++){const a=i*2.399,yy=y+Math.sin(a)*r,xx=x+Math.cos(a)*r;line(ctx,[[w*.46+(i%4)*12,yy+(i%3)*13],[xx-30,yy+(i%3)*13],[xx,yy],[w,yy-i%5*8]],'#25dce62b');}
 for(let i=0;i<650;i++){
 const z=1-2*(i+.5)/650,rr=Math.sqrt(1-z*z),a=i*2.399963+angle;
 const xx=rr*Math.cos(a),depth=rr*Math.sin(a),yy=z;
 ctx.globalAlpha=.2+(depth+1)*.36;ctx.fillStyle=depth>.25?'#b8ffff':'#20d4de';ctx.fillRect(x+xx*r,y+yy*r,depth>.5?1.6:1,depth>.5?1.6:1);
 }ctx.globalAlpha=1;
 ellipse(ctx,x,y,r*1.34,r*.3,'#49e2e56b');ellipse(ctx,x,y,r*1.12,r*.54,'#49e2e530');
 const values=snapshot?['TURN '+snapshot.turn,'STATE '+snapshot.stateRevision,'PLAYERS '+snapshot.clients]:['WAITING'];
 ctx.font='9px monospace';ctx.fillStyle='#91eceb';values.forEach((v,i)=>ctx.fillText(v,x-r+(i%2)*r*1.25,y-r*.62+i*r*.51));
 }else{
 for(let i=0;i<5;i++){const cx=x+(i-2)*r*.7,cy=y+Math.sin(i*2)*r*.9;ellipse(ctx,cx,cy,r*.65,r*.38,'#bfdadf',1);}
 ellipse(ctx,x,y+12,r*1.55,r*.38,'#a4c3c9');ellipse(ctx,x,y+17,r*1.48,r*.38,'#df4b80',6);ellipse(ctx,x,y+25,r*1.32,r*.32,'#a8c35a',5);
 const segments=snapshot?Math.min(22,snapshot.seed.entities.length):8;
 for(let i=0;i<segments;i++){const a=i*Math.PI*2/segments+angle,px=x+Math.cos(a)*r*1.35,py=y+15+Math.sin(a)*r*.4;ctx.fillStyle=['#f0cf55','#a5cf8d','#e99abd','#a3d5dd'][i%4];ctx.beginPath();ctx.arc(px,py,3.5,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='#fff';ctx.strokeStyle='#9eb3bd';ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(x-r*.5,y+6);ctx.lineTo(x-r*.36,y-r*.44);ctx.quadraticCurveTo(x,y-r*.25,x+r*.36,y-r*.44);ctx.lineTo(x+r*.5,y+6);ctx.quadraticCurveTo(x,y+26,x-r*.5,y+6);ctx.fill();ctx.stroke();
 ctx.fillStyle='#f3c74c';ctx.beginPath();ctx.arc(x+r*.21,y-r*.12,8,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#df4b80';ctx.beginPath();ctx.moveTo(x,y-r*.46);ctx.lineTo(x-11,y-r*.64);ctx.lineTo(x,y-r*.74);ctx.lineTo(x+11,y-r*.64);ctx.closePath();ctx.fill();ctx.stroke();
 for(const side of [-1,1]){ctx.fillStyle='#ffffffd9';ctx.beginPath();ctx.moveTo(x+side*12,y-r*.48);ctx.quadraticCurveTo(x+side*r*.65,y-r*.7,x+side*r*1.3,y-r*.8);ctx.quadraticCurveTo(x+side*r*.7,y-r*.22,x+side*12,y-r*.36);ctx.fill();ctx.stroke();}
 for(let i=0;i<4;i++){const yy=y+40+i*10;ctx.fillStyle=['#aad5da','#fff','#edacc9','#f2d86f'][i];ctx.beginPath();ctx.ellipse(x,yy,Math.max(4,17-i*4),5,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
 }
}
Gulch.register('build-board-worlds',{snapshot(s){snapshot=s;badge.textContent=String(s.clients??0)+' CONNECTED · TURN '+String(s.turn??0);draw(performance.now());},resize(){draw(performance.now());}});
new MutationObserver(()=>{if(!board.hidden)draw(performance.now());}).observe(board,{attributes:true,attributeFilter:['hidden']});
let last=0;
function frame(now){if(!document.hidden&&!board.hidden&&!reduced.matches&&now-last>=65){last=now;draw(now);}requestAnimationFrame(frame);}
requestAnimationFrame(frame);
})();
