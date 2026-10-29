(function(){
'use strict';
let snapshot;
function change(action){
 if(!snapshot||!action||typeof action!=='object')return;
 const result=globalThis.GulchWorldEngine.apply(snapshot.gameState,action,{
  advanceCaves:window.GulchCaveEnemies?seed=>window.GulchCaveEnemies.advance(seed):undefined
 });
 if(result)Gulch.commit(result.data,result.activity);
}
Gulch.register('world',{snapshot(s){snapshot=s;},action:change});
})();
