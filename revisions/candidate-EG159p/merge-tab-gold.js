(function(){
'use strict';
const style=document.createElement('style');
style.textContent=`
#inventoryPanel .new-inventory-nav button[aria-controls="mergeForge"]{
 position:relative;isolation:isolate;overflow:hidden;
 background:linear-gradient(135deg,#91601c 0%,#e9bc55 24%,#fff0ab 43%,#dca63a 62%,#f7d77e 82%,#ab751f 100%)!important;
 color:#352207!important;border:1px solid #ffe6a0!important;
 font-weight:700;text-shadow:0 1px #fff0b580;
 box-shadow:inset 0 1px 0 #fff6ce,inset 0 -2px 0 #875514,0 0 12px #efbd4545;
}
#inventoryPanel .new-inventory-nav button[aria-controls="mergeForge"]::after{
 content:'';position:absolute;inset:0;pointer-events:none;
 background:linear-gradient(110deg,transparent 30%,#fffbe9a6 48%,transparent 66%);
 transform:translateX(-140%);animation:merge-tab-gold-shine 4s ease-in-out infinite;
}
#inventoryPanel .new-inventory-nav button[aria-controls="mergeForge"]:hover{
 background:linear-gradient(135deg,#bd852b,#ffdc7a 28%,#fff6cb 48%,#edbe54 70%,#ffe39a)!important;
 box-shadow:inset 0 1px #fffbea,0 0 17px #ffd36b80;
}
#inventoryPanel .new-inventory-nav button[aria-controls="mergeForge"][aria-pressed="true"]{
 border:2px solid #fff5ce!important;
 color:#241704!important;
 box-shadow:inset 0 0 0 1px #9d681d,inset 0 -3px #a57326,0 0 15px #ffd36b75;
}
#inventoryPanel .new-inventory-nav button[aria-controls="mergeForge"]:focus-visible{
 outline:3px solid #fff5cf!important;outline-offset:3px;
}
@keyframes merge-tab-gold-shine{
 0%,25%{transform:translateX(-140%)}
 65%,100%{transform:translateX(140%)}
}
@media(prefers-reduced-motion:reduce){
 #inventoryPanel .new-inventory-nav button[aria-controls="mergeForge"]::after{animation:none;transform:none;opacity:.25}
}
`;
document.head.append(style);
})();
