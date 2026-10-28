import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {browserSmoke} from './browser-smoke.mjs';
const LIMIT=400000;
export function validatePath(name){
  if(typeof name!=='string'||name.length>160||!/^game-project\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:js|html|css|json)$/.test(name))throw Error('Invalid game source path');
  return name.slice(13);
}
export function readSources(dir){
  const files={};let bytes=0;
  function walk(relative=''){
    for(const entry of fs.readdirSync(path.join(dir,relative),{withFileTypes:true})){
      const name=path.posix.join(relative,entry.name),full=path.join(dir,name);
      if(entry.isSymbolicLink())throw Error('Symlinks are forbidden');
      if(entry.isDirectory()){if(!/^[A-Za-z0-9_/-]+$/.test(name))throw Error('Invalid directory');walk(name);continue;}
      validatePath('game-project/'+name);
      if(!entry.isFile()||fs.statSync(full).size>100000)throw Error('Oversized source file');
      const content=fs.readFileSync(full,'utf8');bytes+=Buffer.byteLength(content);
      files['game-project/'+name]=content;
    }
  }
  if(fs.lstatSync(dir).isSymbolicLink())throw Error('Symlink root forbidden');
  walk();return files;
}
async function readSourcesAsync(dir,signal){
  const files={};
  async function walk(relative=''){
    for(const entry of await fs.promises.readdir(path.join(dir,relative),{withFileTypes:true})){
      signal?.throwIfAborted();
      const name=path.posix.join(relative,entry.name),full=path.join(dir,name);
      if(entry.isSymbolicLink())throw Error('Symlinks are forbidden');
      if(entry.isDirectory()){if(!/^[A-Za-z0-9_/-]+$/.test(name))throw Error('Invalid directory');await walk(name);continue;}
      validatePath('game-project/'+name);
      if(!entry.isFile()||(await fs.promises.stat(full)).size>100000)throw Error('Oversized source file');
      files['game-project/'+name]=await fs.promises.readFile(full,'utf8');
    }
  }
  if((await fs.promises.lstat(dir)).isSymbolicLink())throw Error('Symlink root forbidden');
  await walk();return files;
}
function checkJavaScript(full,name,signal){
  signal?.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--check',full],{stdio:'ignore'});
    let failure;
    const abort=()=>{failure=signal.reason||Error('Validation cancelled');child.kill('SIGKILL');};
    const timer=setTimeout(()=>{failure=Error(`JavaScript syntax rejected: ${name}`);child.kill('SIGKILL');},5000);
    signal?.addEventListener('abort',abort,{once:true});
    child.once('error',error=>{failure=error;});
    child.once('close',code=>{
      clearTimeout(timer);signal?.removeEventListener('abort',abort);
      if(failure||code!==0)reject(failure||Error(`JavaScript syntax rejected: ${name}`));else resolve();
    });
  });
}
export function documentFor(files,nonce=null){
  if(nonce!==null&&!/^[a-f0-9]{32}$/.test(nonce))throw Error('Invalid script nonce');
  const template=files['game-project/index.html'];
  if(!template||!template.includes('<!-- GULCH_SCRIPTS -->')||!files['game-project/runtime.js'])throw Error('Missing game entry boundary');
  if(/<script\b|<iframe\b|<object\b|<embed\b|<base\b|<meta[^>]+http-equiv|\son\w+\s*=/i.test(template))throw Error('HTML must use bundled JS files, no embedded active content');
  if(!/^<!doctype html>/i.test(template.trim())||!/<html[\s>]/i.test(template)||!/<\/html>/i.test(template))throw Error('Invalid HTML document');
  const names=Object.keys(files).filter(n=>n.endsWith('.js')).sort((a,b)=>a.endsWith('/runtime.js')?-1:b.endsWith('/runtime.js')?1:a.localeCompare(b));
  const scripts=names.map(n=>files[n]);
  if(scripts.some(s=>/<\/script/i.test(s)))throw Error('Script closing tag forbidden in JS');
  const hashes=scripts.map(s=>`'sha256-${crypto.createHash('sha256').update(s).digest('base64')}'`).join(' ');
  const csp=`default-src 'none'; script-src ${hashes}; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  const css=Object.entries(files).filter(([n])=>n.endsWith('.css')).map(([,s])=>s).join('\n');
  if(/<\/style/i.test(css))throw Error('Style closing tag forbidden');
  const html=template.replace('<!-- GULCH_SCRIPTS -->',()=>`<style>${css}</style>`+scripts.map(s=>`<script${nonce?' nonce="'+nonce+'"':''}>${s}</script>`).join('\n'));
  return {html,csp};
}
export async function stage(root,live,operations,snapshot,onStage=()=>{},{signal}={}){
  if(!Array.isArray(operations)||!operations.length||operations.length>24)throw Error('Expected 1–24 file operations');
  if(Buffer.byteLength(JSON.stringify(operations))>LIMIT)throw Error('Batch exceeds size limit');
  signal?.throwIfAborted();
  const files={...await readSourcesAsync(live,signal)},changes=[],seen=new Set();
  for(const op of operations){
    validatePath(op.path);
    if(seen.has(op.path))throw Error('Duplicate path');seen.add(op.path);
    if(!['create','update','delete'].includes(op.op)||typeof op.content!=='string'||Buffer.byteLength(op.content)>100000)throw Error('Invalid file operation');
    const before=files[op.path];
    if(op.op==='create'&&before!==undefined)throw Error('Create target exists');
    if(op.op!=='create'&&before===undefined)throw Error('Target does not exist');
    changes.push({path:op.path,op:op.op,before:before??null,after:op.op==='delete'?null:op.content});
    if(op.op==='delete')delete files[op.path];else files[op.path]=op.content;
  }
  const doc=documentFor(files);
  const parent=path.join(root,'revisions');await fs.promises.mkdir(parent,{recursive:true});
  const dir=await fs.promises.mkdtemp(path.join(parent,'candidate-'));
  try{
    onStage('syntax');
    for(const [name,content] of Object.entries(files)){
      signal?.throwIfAborted();
      const full=path.join(dir,validatePath(name));await fs.promises.mkdir(path.dirname(full),{recursive:true});await fs.promises.writeFile(full,content);
      if(name.endsWith('.js')){
        await checkJavaScript(full,name,signal);
      }
      if(name.endsWith('.json'))JSON.parse(content);
    }
    signal?.throwIfAborted();
    onStage('browser_smoke');
    await browserSmoke(doc,snapshot);
    signal?.throwIfAborted();
    return {dir,changes};
  }catch(e){await fs.promises.rm(dir,{recursive:true,force:true});throw e;}
}
