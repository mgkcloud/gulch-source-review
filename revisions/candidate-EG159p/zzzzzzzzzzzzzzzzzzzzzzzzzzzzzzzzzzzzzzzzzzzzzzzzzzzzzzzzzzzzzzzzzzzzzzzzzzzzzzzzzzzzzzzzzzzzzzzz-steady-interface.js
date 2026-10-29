(function(){
'use strict';
const style=document.createElement('style');style.textContent=`
#controls{display:none!important}
#hud b,#vitalValue,#runningInfo{font-variant-numeric:tabular-nums}
#hud #hp{min-width:6ch}#hud #pos{min-width:8ch}#hud #turn{min-width:5ch}
#left #vitalFill{transition:width 220ms ease-out,background-color 280ms ease!important}
#left #runningFill{transition:width 300ms ease-out!important}
#left button{transition:background-color 180ms ease,border-color 180ms ease,color 180ms ease,opacity 180ms ease!important}
#inventoryPanel,#characterPanel,#questBoard,#livingPanel,#interfaceMenu,#tradePanel,#travelMapPanel,#pilgrimJournal,#atlasPanel,#keyHelp,#lorePanel{transition:opacity 180ms ease-out,display 180ms allow-discrete!important;opacity:1}
#inventoryPanel[hidden],#characterPanel[hidden],#questBoard[hidden],#livingPanel[hidden],#interfaceMenu[hidden],#tradePanel[hidden],#travelMapPanel[hidden],#pilgrimJournal[hidden],#atlasPanel[hidden],#keyHelp[hidden],#lorePanel[hidden]{opacity:0;pointer-events:none!important}
@starting-style{#inventoryPanel:not([hidden]),#characterPanel:not([hidden]),#questBoard:not([hidden]),#livingPanel:not([hidden]),#interfaceMenu:not([hidden]),#tradePanel:not([hidden]),#travelMapPanel:not([hidden]),#pilgrimJournal:not([hidden]),#atlasPanel:not([hidden]),#keyHelp:not([hidden]),#lorePanel:not([hidden]){opacity:0}}
#cornerNotifications .corner-notification,#lootReveal{transition:opacity 240ms ease-out!important}
#left #swordControls button:disabled,#left #interactKeyButton:disabled,#left #quickConsumableUse:disabled{opacity:.78}
@media(prefers-reduced-motion:reduce){#left #vitalFill,#left #runningFill,#left button,#inventoryPanel,#characterPanel,#questBoard,#livingPanel,#interfaceMenu,#tradePanel,#travelMapPanel,#pilgrimJournal,#atlasPanel,#keyHelp,#lorePanel,#lootReveal{transition:none!important}}
`;document.head.append(style);
const pad=document.getElementById('controls');if(pad){pad.hidden=true;pad.setAttribute('aria-hidden','true');}
const help=document.getElementById('keyHelp');if(help){for(const p of help.querySelectorAll('p'))if(p.textContent.includes('center movement button'))p.textContent='E or > — use an exit beneath you. Move with WASD, arrow keys or the floating touch joystick.';}
})();
