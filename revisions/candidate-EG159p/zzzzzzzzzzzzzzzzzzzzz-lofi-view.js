(function(){
'use strict';
const style=document.createElement('style');
style.textContent=`
#board{filter:saturate(.72) contrast(.92)}
#swordEffect{opacity:.28}
#lootReveal.pickup-enter{animation:none!important}
#left button,#left progress,#vitalFill,#runningFill{transition:none!important;animation:none!important}
#workBoard .build-world canvas{display:none}
#left{background:#11191b}
`;
document.head.append(style);
})();
