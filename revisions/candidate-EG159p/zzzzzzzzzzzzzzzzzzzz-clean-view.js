(function(){
'use strict';
const host=document.getElementById('left');
if(!host)return;
const style=document.createElement('style');
style.textContent=`
#left[data-clean-view=true] #outsideTools,
#left[data-clean-view=true] #regionPanel,
#left[data-clean-view=true] #swordQuestTracker,
#left[data-clean-view=true] #frontierLocation,
#left[data-clean-view=true] #focusHint{display:none!important}
#left[data-clean-view=true] #hud{top:12px;left:12px;right:12px;padding:9px 12px;gap:16px;background:#0b191dcc;border-color:#a2bfa018;box-shadow:none;backdrop-filter:none;border-radius:6px}
#left[data-clean-view=true] #hud span:nth-child(n+3){display:none}
#left[data-clean-view=true] #hud span{flex-direction:row;align-items:baseline;gap:8px}
#left[data-clean-view=true] #hud span:nth-child(2) b{max-width:65vw;font-size:12px}
#left[data-clean-view=true] #interfaceDock{top:62px;right:12px;padding:4px;gap:4px;background:#0b191dcc;box-shadow:none;border-color:#68847466;border-radius:7px}
#left[data-clean-view=true] #interfaceDock button{width:40px;height:40px;background:transparent;border-color:transparent;font-size:21px}
#left[data-clean-view=true] #interfaceDock button:hover{background:#243b36}
#left[data-clean-view=true] #interfaceMenu{top:116px}
#left[data-clean-view=true] #livingToggle{top:116px;right:12px;background:#0b191dcc;border-color:#68847466;box-shadow:none;min-height:36px;padding:7px 10px}
#visualDetailsToggle{position:absolute;left:12px;top:62px;z-index:5;min-height:40px;padding:8px 11px;border:1px solid #68847466;border-radius:6px;background:#0b191de8;color:#d6dfce;font:11px/1.4 ui-monospace,monospace;cursor:pointer}
#visualDetailsToggle:focus-visible{outline:2px solid #e9c58c;outline-offset:3px}
#left[data-clean-view=false] #visualDetailsToggle{top:auto;bottom:12px}
#left[data-clean-view=true] #vitalPanel{width:min(220px,calc(100% - 180px));padding:8px 10px;background:#0b191dcc;box-shadow:none;border-color:#718e7755;border-radius:6px}
#left[data-clean-view=true] #vitalPanel header,
#left[data-clean-view=true] #vitalPanel>p:not(#vitalNotice),
#left[data-clean-view=true] #runningTrack{display:none}
#left[data-clean-view=true] #vitalTrack{height:19px;border-color:#718e7755}
#left[data-clean-view=true] #vitalValue{font-size:10px}
#left[data-clean-view=true] #vitalPanel:not([data-health=critical]):not([data-health=depleted]) #vitalNotice{display:none}
#left[data-clean-view=true] #vitalNotice{font-size:10px;min-height:0}
#left[data-clean-view=true] #controls{background:#0b191dbb;box-shadow:none;border-color:#adc39b18;backdrop-filter:none;padding:6px;gap:4px}
#left[data-clean-view=true] #controls button{background:#192c2bcc;box-shadow:none;border-color:#52685a55}
#left[data-clean-view=true] #swordControls{gap:4px}
#left[data-clean-view=true] #swordControls button{background:#192c2bdd;box-shadow:none;border-color:#ad986766}
#left[data-clean-view=true] #swordStatus{display:none}
@media(max-width:700px){
 #left[data-clean-view=true] #hud{top:8px;left:8px;right:8px;padding:8px;gap:10px}
 #left[data-clean-view=true] #hud span:nth-child(2) b{max-width:54vw;font-size:11px}
 #left[data-clean-view=true] #interfaceDock{top:54px;right:8px}
 #left[data-clean-view=true] #interfaceMenu{top:108px}
 #left[data-clean-view=true] #livingToggle{top:108px;right:8px}
 #visualDetailsToggle{top:54px;left:8px}
 #left[data-clean-view=true] #vitalPanel{left:10px;width:min(200px,calc(100% - 165px))}
}
@media(max-height:480px){
 #left[data-clean-view=true] #interfaceMenu{top:104px;max-height:calc(100% - 116px)}
}
`;
document.head.append(style);
const toggle=document.createElement('button');
toggle.id='visualDetailsToggle';
toggle.type='button';
toggle.setAttribute('aria-controls','outsideTools regionPanel swordQuestTracker frontierLocation');
let expanded=false;
function render(){
 host.dataset.cleanView=String(!expanded);
 toggle.textContent=expanded?'Hide details':'Show details';
 toggle.setAttribute('aria-expanded',String(expanded));
 toggle.title=expanded?'Hide extra expedition information':'Show quest interactions, resources, settlements and progression';
}
toggle.addEventListener('click',()=>{expanded=!expanded;render();});
host.append(toggle);
render();
})();
