import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import {spawnSync} from 'node:child_process';

export const BACKEND_ALLOWED_FILES=new Set(['index.html','server-app.mjs','world-store.mjs','room-store.mjs','upload-store.mjs','movement-engine.mjs']);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const digest=o=>hash(JSON.stringify(o));
const backendDigest=hashes=>digest(Object.fromEntries(Object.entries(hashes).filter(([name])=>name!=='index.html').sort(([a],[b])=>a.localeCompare(b))));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function regular(file,optional=false){
 try{const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink())throw Error('Not a regular file: '+file);return true;}
 catch(e){if(optional&&e.code==='ENOENT')return false;throw e;}
}
function directory(file){const s=fs.lstatSync(file);if(!s.isDirectory()||s.isSymbolicLink())throw Error('Unsafe directory: '+file);}
function mkdir(file){if(!fs.existsSync(file))fs.mkdirSync(file,{mode:0o700});directory(file);}
function syncDir(dir){const fd=fs.openSync(dir,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function atomic(file,content){
 if(fs.existsSync(file))regular(file);
 const tmp=file+'.tmp-'+crypto.randomBytes(8).toString('hex');
 const fd=fs.openSync(tmp,'wx',0o600);
 try{fs.writeFileSync(fd,content);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 try{fs.renameSync(tmp,file);syncDir(path.dirname(file));}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
}
function json(file){regular(file);return JSON.parse(fs.readFileSync(file,'utf8'));}
function sourcePath(root,name){
 if(typeof name!=='string'||!BACKEND_ALLOWED_FILES.has(name)||path.basename(name)!==name)throw Error('Forbidden backend path: '+name);
 directory(root);regular(path.join(root,name),true);return path.join(root,name);
}
export function backendSources(root){
 const out={};for(const name of BACKEND_ALLOWED_FILES){const file=sourcePath(root,name);if(regular(file,true))out[name]=fs.readFileSync(file,'utf8');}return out;
}
export function applyBackendOperations(root,operations){
 if(!Array.isArray(operations)||!operations.length||operations.length>8)throw Error('Expected 1–8 source operations');
 if(Buffer.byteLength(JSON.stringify(operations))>400000)throw Error('Source batch exceeds 400KB');
 const sources=backendSources(root),changes=new Map();
 for(const op of operations){
  if(!op||!['replace','update','create'].includes(op.op))throw Error('Unsupported source operation');
  sourcePath(root,op.path);if(!changes.has(op.path)&&changes.size>=5)throw Error('At most five changed files');
  const before=sources[op.path]??null;
  if(typeof op.content!=='string'||Buffer.byteLength(op.content)>200000)throw Error('Invalid source content size');
  if(op.op==='create'&&(before!==null||op.path!=='movement-engine.mjs'))throw Error('Only a missing movement-engine.mjs may be created');
  if(op.op!=='create'&&before===null)throw Error('Source does not exist: '+op.path);
  let after=op.content;
  if(op.op==='replace'){
   if(typeof op.find!=='string'||!op.find||before.split(op.find).length!==2)throw Error('Replacement target must occur exactly once');
   after=before.replace(op.find,()=>op.content);
  }else if(op.find!==undefined&&op.find!=='')throw Error('Create/update find must be empty');
  if(!after.trim()||Buffer.byteLength(after)>200000)throw Error('Resulting file exceeds source limits');
  if(op.path==='index.html'&&(!/^\s*<!doctype html>/i.test(after)||!after.includes('<script>')))throw Error('Builder document lost its doctype or script seam');
  const prior=changes.get(op.path);const original=prior?prior.before:before;
  changes.set(op.path,{path:op.path,op:original===null?'create':'update',before:original,after});sources[op.path]=after;
 }
 return [...changes.values()];
}
function rootCode(root){
 directory(root);const names=fs.readdirSync(root).filter(n=>/\.(?:m?js)$/.test(n)||n==='index.html').sort();
 const out={};for(const n of names){regular(path.join(root,n));out[n]=hash(fs.readFileSync(path.join(root,n)));}return out;
}
function copyTree(from,to){
 directory(from);fs.mkdirSync(to,{recursive:true});
 for(const e of fs.readdirSync(from,{withFileTypes:true})){
  const a=path.join(from,e.name),b=path.join(to,e.name);if(e.isSymbolicLink())throw Error('Symlink in source snapshot');
  if(e.isDirectory())copyTree(a,b);else{regular(a);fs.copyFileSync(a,b);}
 }
}
function treeHashes(dir,prefix=''){
 directory(dir);const out={};
 for(const name of fs.readdirSync(dir).sort()){
  const rel=prefix+name,file=path.join(dir,name),s=fs.lstatSync(file);
  if(s.isSymbolicLink())throw Error('Symlink in candidate');
  if(s.isDirectory())Object.assign(out,treeHashes(file,rel+'/'));else{regular(file);out[rel]=hash(fs.readFileSync(file));}
 }return out;
}
function gamePath(root,sourceDir){
 if(typeof sourceDir!=='string'||!/^(game-project|revisions\/candidate-[A-Za-z0-9]+)$/.test(sourceDir))throw Error('Unsafe game revision path');
 let current=root;for(const part of sourceDir.split('/')){current=path.join(current,part);directory(current);}return current;
}
function syntax(root){
 for(const name of Object.keys(rootCode(root)).filter(n=>/\.(?:m?js)$/.test(n))){
  const r=spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8',timeout:10000,maxBuffer:200000});
  if(r.status!==0)throw Error('Syntax check failed for '+name+': '+(r.stderr||r.error?.message||'unknown error').slice(0,1000));
 }
}
function candidateLocation(root,id){
 if(typeof id!=='string'||!/^candidate-[a-f0-9]{24}$/.test(id))throw Error('Invalid candidate identifier');
 const base=path.join(root,'.backend-candidates');directory(base);const dir=path.join(base,id);directory(dir);return dir;
}
function readCandidate(root,ref){
 const dir=candidateLocation(root,ref.id),m=json(path.join(dir,'manifest.json'));
 const {digest:stored,...body}=m;
 if(stored!==ref.digest||digest(body)!==stored||m.id!==ref.id||m.version!==1)throw Error('Candidate manifest digest mismatch');
 if(!m.proof||!Array.isArray(m.proof.checked)||!m.proof.checked.includes('backend readiness'))throw Error('Candidate lacks readiness proof');
 if(!Array.isArray(m.changes)||m.changes.length<1||m.changes.length>5)throw Error('Invalid candidate changes');
 const seen=new Set();for(const c of m.changes){
  sourcePath(root,c.path);if(seen.has(c.path))throw Error('Duplicate candidate path');seen.add(c.path);
  if(typeof c.after!=='string'||Buffer.byteLength(c.after)>200000||c.before!==null&&typeof c.before!=='string')throw Error('Invalid candidate code');
  if(c.before===null&&c.path!=='movement-engine.mjs')throw Error('Invalid candidate creation');
  regular(path.join(dir,'app',c.path));if(fs.readFileSync(path.join(dir,'app',c.path),'utf8')!==c.after)throw Error('Candidate source differs from manifest');
 }
 if(digest(treeHashes(path.join(dir,'app')))!==digest(m.files))throw Error('Candidate snapshot changed after validation');
 return m;
}
export function verifyBackendCandidate(root,ref,state){
 const m=readCandidate(root,ref);
 if(digest(rootCode(root))!==digest(m.baseHashes))throw Error('Stale backend code base');
 if(state.revision!==m.gameRevision||state.sourceDir!==m.sourceDir)throw Error('Stale game source revision');
 if(digest(treeHashes(gamePath(root,state.sourceDir)))!==digest(m.gameHashes))throw Error('Game source changed after validation');
 for(const c of m.changes){const f=sourcePath(root,c.path);const before=regular(f,true)?fs.readFileSync(f,'utf8'):null;if(before!==c.before)throw Error('Stale source: '+c.path);}
 return m;
}
export async function stageBackendCandidate({root,state,operations,signal,onStage=()=>{},check}){
 signal?.throwIfAborted();const changes=applyBackendOperations(root,operations);
 const baseHashes=rootCode(root),sourceDir=state.sourceDir,gameRevision=state.revision;
 const game=gamePath(root,sourceDir),gameHashes=treeHashes(game);
 const base=path.join(root,'.backend-candidates');mkdir(base);
 const id='candidate-'+crypto.randomBytes(12).toString('hex'),dir=path.join(base,id);fs.mkdirSync(dir,{mode:0o700});
 const app=path.join(dir,'app');fs.mkdirSync(app);
 try{
  for(const name of Object.keys(baseHashes))fs.copyFileSync(path.join(root,name),path.join(app,name));
  regular(path.join(root,'seed.json'));fs.copyFileSync(path.join(root,'seed.json'),path.join(app,'seed.json'));
  copyTree(game,path.join(app,'game-project'));
  const fixture=JSON.parse(JSON.stringify(state));fixture.sourceDir='game-project';fixture.repairEnabled=false;fixture.clients=0;
  if(state.worldStore===1){regular(path.join(root,'world-state.json'));fs.copyFileSync(path.join(root,'world-state.json'),path.join(app,'world-state.json'));}
  fs.writeFileSync(path.join(app,'room-state.json'),JSON.stringify(fixture));
  for(const c of changes)fs.writeFileSync(path.join(app,c.path),c.after);
  const files=treeHashes(app);onStage('syntax');syntax(app);signal?.throwIfAborted();
  onStage('browser_smoke');const proof=await check(fs.readFileSync(path.join(app,'index.html'),'utf8'),app);signal?.throwIfAborted();
  if(digest(treeHashes(app))!==digest(files))throw Error('Validation modified candidate snapshot');
  const body={version:1,id,createdAt:Date.now(),baseHashes,sourceDir,gameRevision,gameHashes,changes,files,proof};
  const manifest={...body,digest:digest(body)};atomic(path.join(dir,'manifest.json'),JSON.stringify(manifest));syncDir(dir);syncDir(base);
  const ref={id,digest:manifest.digest};verifyBackendCandidate(root,ref,state);
  return {ref,changes,proof};
 }catch(e){fs.rmSync(dir,{recursive:true,force:true});throw e;}
}
function restoreCode(root,journal){
 if(!Array.isArray(journal.backups)||journal.backups.length<1||journal.backups.length>5)throw Error('Invalid rollback journal');
 for(const b of journal.backups){
  const file=sourcePath(root,b.path);
  if(b.before===null){if(b.path!=='movement-engine.mjs')throw Error('Invalid rollback deletion');if(regular(file,true))fs.unlinkSync(file);}
  else{if(typeof b.before!=='string'||hash(b.before)!==b.hash)throw Error('Corrupt rollback backup');atomic(file,b.before);}
 }syncDir(root);
 if(digest(rootCode(root))!==digest(journal.baseHashes))throw Error('Rollback code verification failed');
}

export async function runSupervisor(root){
 root=path.resolve(root);directory(root);
 const validation=process.env.GULCH_VALIDATION==='1',journalFile=path.join(root,'.backend-activation.json');
 let current=null,stopping=false,activationBusy=false,sequence=0,journal=null;
 const pending=new Map();
 function writeJournal(j){if(validation)throw Error('Validation cannot activate code');atomic(journalFile,JSON.stringify(j));journal=j;}
 function rejectPending(w,error){for(const [id,p] of pending)if(p.worker===w){clearTimeout(p.timer);pending.delete(id);p.reject(error);}}
 function rpc(w,type,data={},timeout=20000){
  return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error(type+' timed out'));},timeout);pending.set(id,{worker:w,resolve,reject,timer});w.postMessage({type,id,...data});});
 }
 async function terminate(w){if(!w)return;rejectPending(w,Error('Worker terminated'));await w.terminate();}
 async function boot(activation=null){
  if(stopping)throw Error('Supervisor stopping');
  const codeDigest=backendDigest(rootCode(root));
  const w=new Worker(new URL('./server-app.mjs',pathToFileURL(root+path.sep)),{workerData:{digest:codeDigest,activation,validation},stdout:false,stderr:false});
  current=w;
  let readyResolve,readyReject;
  const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
  const timer=setTimeout(()=>readyReject(Error('Worker startup readiness timed out')),20000);
  w.on('message',m=>{
   if(m.type==='ready'){if(m.digest!==codeDigest)readyReject(Error('Worker readiness digest mismatch'));else readyResolve();return;}
   if(m.replyTo){const p=pending.get(m.replyTo);if(p?.worker===w){pending.delete(m.replyTo);clearTimeout(p.timer);m.error?p.reject(Error(m.error)):p.resolve(m.result);}return;}
   if(m.type==='activate'&&w===current&&!stopping){void activate(w,m.ref,m.jobId);}
  });
  w.on('error',e=>{readyReject(e);rejectPending(w,e);console.error('[gulch supervisor]',e.message);});
  w.on('exit',code=>{
   readyReject(Error('Worker exited before readiness: '+code));rejectPending(w,Error('Worker exited: '+code));
   if(w===current&&!activationBusy&&!stopping){console.error('[gulch supervisor] active worker exited');void shutdown(1);}
  });
  try{await ready;}catch(e){await terminate(w);throw e;}finally{clearTimeout(timer);}
  if(stopping){await terminate(w);throw Error('Supervisor stopping');}
  return w;
 }
 async function finishBoot(w){await rpc(w,'finalize');await rpc(w,'enable');}
 function persistedJob(jobId,ref){
  const state=json(path.join(root,'room-state.json')),job=state.patches?.find(j=>j.id===jobId);
  if(!job||job.cancelRequested||job.archived||job.status!=='running'||job.stage!=='activating'||job.backendCandidate?.id!==ref.id||job.backendCandidate?.digest!==ref.digest)throw Error('Activation task is no longer eligible');
  if(state.patches.some(j=>j.id!==jobId&&['queued','running'].includes(j.status)||['queued','running'].includes(j.check?.status)))throw Error('Queue has not drained');
  return state;
 }
 async function activate(old,ref,jobId){
  if(activationBusy||validation)return;
  activationBusy=true;let prepared=false,stopped=false;
  try{
   verifyBackendCandidate(root,ref,persistedJob(jobId,ref));
   await rpc(old,'quiesce',{jobId,ref},20000);
   const m=verifyBackendCandidate(root,ref,persistedJob(jobId,ref));
   const descriptor={jobId,ref,outcome:'applied'};
   const next={version:1,status:'prepared',activation:descriptor,baseHashes:m.baseHashes,backups:m.changes.map(c=>({path:c.path,before:c.before,hash:c.before===null?null:hash(c.before)}))};
   writeJournal(next);prepared=true;
   await terminate(old);stopped=true;
   if(stopping)return;
   for(const c of m.changes)atomic(sourcePath(root,c.path),c.after);
   const expected={...m.baseHashes};for(const c of m.changes)expected[c.path]=hash(c.after);
   if(digest(Object.fromEntries(Object.entries(expected).sort(([a],[b])=>a.localeCompare(b))))!==digest(Object.fromEntries(Object.entries(rootCode(root)).sort(([a],[b])=>a.localeCompare(b)))))throw Error('Activated code differs from candidate');
   writeJournal({...next,status:'starting'});
   const w=await boot(descriptor);await rpc(w,'finalize');
   writeJournal({...next,status:'committed',activeDigest:backendDigest(rootCode(root))});
   await rpc(w,'enable');
  }catch(e){
   console.error('[gulch activation]',e.message);
   if(stopping)return;
   try{
    if(prepared){
     await terminate(current);restoreCode(root,journal);
     const activation={jobId,ref,outcome:'failed',error:String(e.message).slice(0,600)};
     writeJournal({...journal,status:'rolled_back',activation});
     const w=await boot(activation);await finishBoot(w);
    }else if(!stopped){await rpc(old,'activation-aborted',{jobId,error:String(e.message).slice(0,600)});}
   }catch(fatal){console.error('[gulch rollback]',fatal.message);await shutdown(1);}
  }finally{activationBusy=false;}
 }
 async function shutdown(code=0){
  if(stopping)return;stopping=true;
  try{if(current){try{await rpc(current,'shutdown',{},12000);}catch{}await terminate(current);}}finally{process.exitCode=code;}
 }
 process.once('SIGTERM',()=>{void shutdown();});process.once('SIGINT',()=>{void shutdown();});
 try{
  let activation=null;
  if(!validation&&fs.existsSync(journalFile)){
   journal=json(journalFile);if(journal.version!==1)throw Error('Unknown activation journal version');
   if(['prepared','starting'].includes(journal.status)){
    restoreCode(root,journal);activation={...journal.activation,outcome:'failed',error:'Interrupted backend activation rolled back before serving'};
    writeJournal({...journal,status:'rolled_back',activation});
   }else if(journal.status==='committed'){
    if(backendDigest(rootCode(root))!==journal.activeDigest)throw Error('Committed activation code digest mismatch');
    activation=journal.activation;
   }else if(journal.status==='rolled_back'){
    if(backendDigest(rootCode(root))!==backendDigest(journal.baseHashes))throw Error('Rolled-back code digest mismatch');activation=journal.activation;
   }else throw Error('Invalid activation journal status');
  }
  const w=await boot(activation);await finishBoot(w);
 }catch(e){console.error('[gulch supervisor] startup refused:',e.message);await shutdown(1);}
}
