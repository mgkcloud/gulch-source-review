(function(){
'use strict';
const toggle=document.getElementById('travelMapToggle');
const panel=document.getElementById('travelMapPanel');
if(!toggle||!panel)return;
const style=document.createElement('style');
style.textContent=`
#travelMapToggle{display:grid;place-items:center;width:48px;height:48px;min-height:48px;padding:2px;background:#17262ad9;color:#f5d696;border:1px solid #a89161;border-radius:7px;box-shadow:0 3px 9px #0005}
#travelMapToggle:hover{background:#344234;border-color:#f1d69d}
#travelMapToggle[aria-expanded=true]{background:#55462d;border-color:#ffe1a0;box-shadow:inset 0 0 0 1px #d9b477}
#travelMapToggle:focus-visible{outline:3px solid #ffe2a0;outline-offset:3px}
.wayfarer-map-icon{display:block;width:42px;height:42px;image-rendering:pixelated;pointer-events:none}
#travelMapPanel{background:linear-gradient(110deg,#bc8148 0%,#eabc80 6%,#f2ce94 48%,#e8b575 94%,#ae713d 100%);color:#38291e;border:6px double #443026;border-radius:2px;box-shadow:0 14px 50px #0009,inset 0 0 35px #8c542c44}
#travelMapPanel header{border-bottom:3px double #805839}
#travelMapPanel h2{color:#39291d;text-shadow:0 1px #f7e2b4}
#travelMapPanel button,#travelMapPanel select{background:#efd098;color:#38291e;border:2px solid #89603b;border-radius:2px}
#travelMapPanel button:hover{background:#f7dfaa;border-color:#49372b}
#travelMapPanel button[aria-pressed=true]{background:#765030;color:#fff0c6}
#travelMapViewport{border:4px double #785735}
#travelMapCaption,#travelMapInspect,#travelMapPanel small{color:#503923}
#travelMapPanel .travel-map-legend{border-color:#94663e}
@media(max-width:700px){#travelMapToggle{width:44px;height:44px;min-height:44px}.wayfarer-map-icon{width:38px;height:38px}#travelMapPanel{border-width:4px}}
`;
document.head.append(style);
const canvas=document.createElement('canvas');
canvas.width=48;canvas.height=48;canvas.className='wayfarer-map-icon';canvas.setAttribute('aria-hidden','true');
const ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
function polygon(color,points){
 ctx.fillStyle=color;
 // Fill individual pixels so every diagonal keeps a crisp staircase edge.
 for(let y=0;y<48;y++)for(let x=0;x<48;x++){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[i],b=points[j];
   if((a[1]>y+.5)!==(b[1]>y+.5)&&(x+.5)<(b[0]-a[0])*(y+.5-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  if(inside)ctx.fillRect(x,y,1,1);
 }
}
function box(color,x,y,w,h){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
const ink='#111329',shade='#ae703e',paper='#f3b576',light='#f8dc98';
polygon(ink,[[5,15],[25,5],[29,7],[30,12],[28,14],[33,20],[38,27],[40,30],[45,31],[46,35],[25,45],[21,45],[18,41],[15,35],[10,29],[6,24],[4,19]]);
polygon(shade,[[6,16],[26,7],[28,9],[28,13],[26,15],[32,22],[37,28],[40,32],[44,32],[44,35],[24,43],[21,43],[17,36],[12,30],[8,24]]);
polygon(paper,[[8,17],[26,10],[26,14],[29,17],[31,21],[35,25],[37,29],[39,31],[34,34],[24,39],[21,41],[17,34],[14,33],[12,29],[9,26],[7,21]]);
polygon(light,[[7,18],[10,23],[10,27],[14,30],[16,34],[18,35],[21,40],[23,39],[21,43],[18,38],[16,35],[13,32],[10,29],[8,26],[6,21]]);
polygon(ink,[[4,15],[24,5],[26,4],[28,5],[30,7],[30,10],[28,12],[9,22],[6,21],[3,18],[3,16]]);
polygon(shade,[[5,15],[25,6],[28,6],[29,8],[28,11],[9,20],[6,20],[4,18]]);
polygon(paper,[[5,15],[25,6],[27,6],[28,8],[28,10],[9,19],[7,19]]);
polygon(light,[[5,15],[25,5],[27,6],[27,8],[25,8],[7,17]]);
polygon(ink,[[21,39],[39,30],[44,30],[46,32],[46,35],[25,45],[22,45],[19,42],[19,40]]);
polygon(shade,[[22,39],[40,31],[44,32],[45,34],[25,43],[22,43],[20,41]]);
polygon(paper,[[22,39],[40,31],[43,32],[43,34],[25,42],[23,42]]);
polygon(light,[[22,39],[40,31],[43,31],[42,33],[25,41],[23,41]]);
box(ink,21,41,2,2);box(ink,23,42,2,1);
[[12,23,2,1],[14,24,1,1],[15,22,1,2],[15,25,2,1],[14,26,1,2],[17,25,2,1],[18,22,1,1],[20,20,2,1],[23,18,2,1],[27,17,2,1],[31,18,1,1],[32,20,1,2],[33,23,1,2],[33,27,1,2],[32,30,1,1],[29,31,2,1],[25,30,2,1],[23,31,1,1]].forEach(r=>box(ink,...r));
box(ink,28,23,2,4);box(ink,27,24,4,2);
box(ink,21,31,3,1);box(ink,20,32,1,3);box(ink,24,32,1,3);box(ink,21,35,3,1);box(ink,22,32,1,1);box(ink,21,33,1,1);box(ink,23,33,1,1);box(ink,22,34,1,1);
toggle.replaceChildren(canvas);
toggle.setAttribute('aria-label','Open exploration map');
toggle.setAttribute('aria-keyshortcuts','M');
toggle.title='Exploration map [M]';
new MutationObserver(()=>{
 const open=toggle.getAttribute('aria-expanded')==='true';
 toggle.setAttribute('aria-label',open?'Close exploration map':'Open exploration map');
}).observe(toggle,{attributes:true,attributeFilter:['aria-expanded']});
})();
