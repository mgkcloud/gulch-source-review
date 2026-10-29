import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from '/home/mgk/node_modules/playwright-core/index.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function copyTree(from,to){
 const stat=fs.lstatSync(from);if(stat.isSymbolicLink())throw Error('Validation source contains a symlink');
 if(stat.isDirectory()){fs.mkdirSync(to,{recursive:true});for(const name of fs.readdirSync(from))copyTree(path.join(from,name),path.join(to,name));}
 else if(stat.isFile())fs.copyFileSync(from,to);else throw Error('Invalid validation source');
}
export async function checkEditor(html,root){
 const dir=fs.mkdtempSync(path.join(root,'.editor-check-'));let child,browser,output='',exited=false,exitPromise;
 try{
  for(const e of fs.readdirSync(root,{withFileTypes:true}))if(/\.(?:m?js)$/.test(e.name)||e.name==='seed.json')copyTree(path.join(root,e.name),path.join(dir,e.name));
  for(const required of ['server.js','server-app.mjs','backend-release.mjs','editor-lane.mjs','world-store.mjs','room-store.mjs','upload-store.mjs','revisions.mjs','revision-history.mjs'])if(!fs.existsSync(path.join(dir,required)))throw Error('Missing required backend import: '+required);
  const state=loadRoom(path.join(root,'room-state.json'));
  if(!/^(game-project|revisions\/candidate-[A-Za-z0-9]+)$/.test(state.sourceDir))throw Error('Invalid validation revision path');
  let current=root;for(const part of state.sourceDir.split('/')){current=path.join(current,part);const s=fs.lstatSync(current);if(s.isSymbolicLink()||!s.isDirectory())throw Error('Invalid revision directory');}
  copyTree(current,path.join(dir,'game-project'));state.sourceDir='game-project';state.repairEnabled=false;
  for(const j of state.patches||[])if(['running','queued','awaiting_editor','awaiting_activation'].includes(j.status))j.status='cancelled';
  if(state.worldStore===1)copyTree(path.join(root,'world-state.json'),path.join(dir,'world-state.json'));
  fs.writeFileSync(path.join(dir,'room-state.json'),JSON.stringify(state));
  fs.writeFileSync(path.join(dir,'index.html'),html);
  fs.writeFileSync(path.join(dir,'.room-password'),'editor-validation-only');
  fs.writeFileSync(path.join(dir,'.session-key'),'isolated-validation-session-key');
  child=spawn(process.execPath,['server.js'],{cwd:dir,env:{PATH:process.env.PATH||'/usr/bin:/bin',HOME:dir,TMPDIR:dir,LANG:'C.UTF-8',PORT:'0',HOST:'127.0.0.1',GULCH_VALIDATION:'1'},stdio:['ignore','pipe','pipe']});
  exitPromise=new Promise(resolve=>{child.once('exit',()=>{exited=true;resolve();});child.once('error',e=>{output+='\n'+e.message;exited=true;resolve();});});
  const record=data=>{output=(output+data.toString()).slice(-30000);};child.stdout.on('data',record);child.stderr.on('data',record);
  let port;
  for(let i=0;i<250;i++){
   if(exited)throw Error('Validation backend exited: '+output);
   const match=output.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);if(match){port=Number(match[1]);break;}await pause(100);
  }
  if(!port)throw Error('Validation readiness timed out: '+output);
  const base='http://127.0.0.1:'+port;
  const request=(url,options={})=>fetch(base+url,{...options,signal:AbortSignal.timeout(3000)});
  if((await request('/api/backend-release')).status!==401)throw Error('Backend release auth gate failed');
  if((await request('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})})).status!==401)throw Error('Auth refusal failed');
  const auth=await request('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'editor-validation-only'})});
  if(auth.status!==200)throw Error('Validation authentication failed');
  const cookie=auth.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('Missing authentication cookie');
  let ready=false;
  for(let i=0;i<100;i++){
   if(exited)throw Error('Backend failed before activation readiness: '+output);
   const response=await request('/api/backend-release',{headers:{cookie}});if(!response.ok)throw Error('Backend release endpoint unavailable');
   const release=await response.json();if(release.status==='active'&&/^[a-f0-9]{64}$/.test(release.digest)){ready=true;break;}await pause(100);
  }
  if(!ready)throw Error('Supervisor never enabled candidate');
  const denied=await request('/api/chat',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({text:'validation must never generate',scope:'build-tools'})});
  if(denied.status!==503)throw Error('Validation generation gate failed');
  browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1450,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/play',{waitUntil:'domcontentloaded',timeout:10000});await page.locator('#pass').fill('editor-validation-only');await page.locator('#gateForm button').click();
  await page.locator('#input').waitFor({state:'visible',timeout:7000});await page.waitForFunction(()=>typeof SNAP!=='undefined'&&SNAP&&Array.isArray(SNAP.patches),null,{timeout:7000});
  for(const id of ['send','boardBtn','requestScope','versionsBtn'])if(await page.locator('#'+id).count()!==1)throw Error('Missing control: '+id);
  await page.locator('#boardBtn').click();await page.locator('#workBoard').waitFor({state:'visible'});
  if(await page.locator('#boardColumns section').count()!==5)throw Error('Missing task lanes');if(!await page.locator('.task-progress').count())throw Error('Missing progress bars');
  await page.getByRole('button',{name:'Open repair centre'}).click();await page.locator('#repairCentre').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('repairStatus').textContent.includes('retained attention'));await page.locator('#repairClose').click();
  await page.setViewportSize({width:390,height:844});await page.locator('#mobileNav [data-view=chat]').click();await page.locator('#input').fill('wasd test');
  if(await page.locator('#input').inputValue()!=='wasd test')throw Error('Composer failed');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw Error('Mobile overflow');if(errors.length)throw Error(errors.join('; '));
  if(exited)throw Error('Validation backend exited during browser check: '+output);
  return {port,checked:['backend readiness','auth refusal','validation generation gate','browser login','chat composer','task lanes and progress','phone layout','no page errors']};
 }finally{
  try{await browser?.close();}finally{
   if(child&&!exited){child.kill('SIGTERM');await Promise.race([exitPromise,pause(15000)]);if(!exited){child.kill('SIGKILL');await exitPromise;}}
   fs.rmSync(dir,{recursive:true,force:true});
  }
 }
}
