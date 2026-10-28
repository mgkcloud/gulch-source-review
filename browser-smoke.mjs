import http from 'node:http';
import {chromium} from '/home/mgk/node_modules/playwright-core/index.mjs';
export async function browserSmoke({html,csp},snapshot){
  if(!snapshot)throw Error('Browser validation requires current game state');
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','text/html');
    if(req.url==='/game'){res.setHeader('Content-Security-Policy',csp);res.end(html);}
    else {res.setHeader('Content-Security-Policy',"default-src 'none'; frame-src 'self'");res.end('<iframe sandbox="allow-scripts" src="/game"></iframe>');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  let browser,timer;
  try{
    browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    // The watchdog must exceed the sum of the sequential Playwright phase limits below.
    await Promise.race([inspect(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Browser verification exceeded 25 seconds')),25000);})]);
    async function inspect(){
    const page=await browser.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|Refused to execute inline script/.test(m.text()))errors.push(m.text().slice(0,400));});
    await page.addInitScript(()=>{
      window.smokeErrors=[];window.smokeReady=false;
      window.addEventListener('message',e=>{
        if(e.source!==document.querySelector('iframe')?.contentWindow)return;
        if(e.data?.type==='gulch:module-error')window.smokeErrors.push(e.data.message);
        if(e.data?.type==='gulch:ready')window.smokeReady=true;
      });
    });
    await page.route('**/*',route=>new URL(route.request().url()).origin===`http://127.0.0.1:${server.address().port}`?route.continue():route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`,{timeout:10000});
    await page.waitForFunction(()=>window.smokeReady,{},{timeout:5000});
    await page.evaluate(s=>document.querySelector('iframe').contentWindow.postMessage({type:'gulch:snapshot',snapshot:s},'*'),snapshot);
    await page.waitForTimeout(300);
    const frame=page.frames()[1];
    if(!await frame.locator('#board').count())throw Error('Game canvas missing');
    if(await frame.locator('#inventoryToggle').count()){
      const healthy=structuredClone(snapshot);healthy.stateRevision=(healthy.stateRevision||0)+1;
      healthy.gameState.seed.entities=healthy.gameState.seed.entities.map(e=>e.id==='player'?{...e,hp:Math.max(1,e.maxHp||24)}:e);
      healthy.gameState.gulchPermanentGameOver={ended:false};
      await page.evaluate(s=>document.querySelector('iframe').contentWindow.postMessage({type:'gulch:snapshot',snapshot:s},'*'),healthy);
      await page.waitForTimeout(100);
      await frame.evaluate(()=>document.getElementById('inventoryToggle').click());
      await frame.waitForFunction(()=>{const p=document.getElementById('inventoryPanel');return p&&!p.hidden&&getComputedStyle(p).display!=='none';},{},{timeout:1500});
      await frame.evaluate(()=>document.getElementById('inventoryClose').click());
      await frame.waitForFunction(()=>document.getElementById('inventoryPanel').hidden,{},{timeout:1000});
      await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({type:'gulch:focus',granted:true},'*'));
      await frame.waitForFunction(()=>window.GulchMovementState?.focused,{},{timeout:1000});
      await frame.locator('body').press('i');
      await frame.waitForFunction(()=>!document.getElementById('inventoryPanel').hidden,{},{timeout:1500});
      await frame.evaluate(()=>document.getElementById('inventoryClose').click());
    }
    const issues=await page.evaluate(()=>window.smokeErrors);
    if(errors.length||issues.length)throw Error('Browser smoke failed: '+[...errors,...issues].join('; ').slice(0,400));
    }
  }finally{clearTimeout(timer);await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
