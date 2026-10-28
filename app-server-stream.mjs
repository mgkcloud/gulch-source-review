// app-server-stream.mjs — real streamed-source adapter over `codex app-server --listen stdio://`.
// Protocol source of truth: `codex app-server generate-ts --out proto-ts --experimental` (codex-cli 0.153.4),
// read in ./proto-ts (v2/AgentMessageDeltaNotification.ts, v2/TurnStartParams.ts, ServerNotification.ts).
//
// Why this exists: the official SDK drives `codex exec --experimental-json`, whose only agent text is a
// terminal `item.completed` agent_message item; live jobs never emitted `item.updated` (SDK index.d.ts
// declares the event, the exec stream does not produce incremental text for it). app-server emits
// `item/agentMessage/delta` notifications while the model is generating, which is the actual source.
//
// Safety/isolation contract (mirrors the legacy bridge, never weaker):
//  * read-only sandbox, approvalPolicy "never", ephemeral thread
//  * model_provider openai, web_search disabled, shell_tool + apply_patch_freeform features off
//  * model omitted (codex default) — never pins a model
//  * isolated scratch CODEX_HOME whose only entry is a symlink to the operator's existing
//    ~/.codex/auth.json: no user config.toml is loaded (no CCR provider/plugins/hooks/MCP servers),
//    no credential is copied or printed, live ChatGPT auth is preserved.
//  * no daemon: one child per call, stdin always closed and child always reaped.
//  * only public assistant text is ever surfaced; reasoning/plan/internal notifications are dropped.

import {spawn} from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const CODEX_BIN=process.env.GULCH_CODEX_BIN||'/home/mgk/.nvm/versions/node/v22.22.0/bin/codex';
const NODE_BIN_DIR=path.dirname(CODEX_BIN);
const SPAWN_ENV={HOME:'/home/mgk',PATH:`${NODE_BIN_DIR}:/usr/bin:/bin`};
const MAX_STDERR_BYTES=65536;
// Notifications that must never reach the caller: private reasoning, plans, raw provider items.
const INTERNAL_NOTIFICATION_PREFIXES=['item/reasoning/','item/plan/','rawResponse','turn/plan/','item/autoApprovalReview/','turn/diff/'];
// Server->client requests we answer ourselves so nothing can ever hang waiting on us.
const APPROVAL_RESPONSES={
  'item/commandExecution/requestApproval':'decline',
  'item/fileChange/requestApproval':'decline',
  'item/permissions/requestApproval':{permissions:{},scope:'turn'},
  'execCommandApproval':{decision:{denied:{rejection:'gulch: approvals disabled'}}},
  'applyPatchApproval':{decision:{denied:{rejection:'gulch: approvals disabled'}}}
};

function ensureAuthHome(root){
  const home=path.join(root,'codex-home');
  fs.mkdirSync(home,{recursive:true,mode:0o700});
  const auth=path.join(home,'auth.json');
  try{fs.symlinkSync('/home/mgk/.codex/auth.json',auth);}catch(e){
    if(e.code!=='EEXIST')throw new Error('isolated CODEX_HOME unavailable: '+e.code);
  }
  return home;
}

// Owns one `codex app-server` child. Never exposes stderr contents (may carry credentials).
class AppServerSession{
  constructor({cwd,codexHome,onNotification,onServerRequest}){
    this.child=spawn(CODEX_BIN,['app-server','--listen','stdio://'],{
      env:{...SPAWN_ENV,CODEX_HOME:codexHome},cwd,stdio:['pipe','pipe','pipe']});
    this.exitInfo=null;this.reaped=false;this.stderrBytes=0;this.closed=false;
    this.child.on('exit',(code,signal)=>{this.exitInfo={code,signal};});
    this.child.on('error',(err)=>{this.exitInfo={code:null,signal:null,error:err.code||err.message};});
    this.child.stderr.on('data',d=>{this.stderrBytes=Math.min(this.stderrBytes+d.length,MAX_STDERR_BYTES);});
    this.rl=readline.createInterface({input:this.child.stdout,crlfDelay:Infinity});
    this.rl.on('line',line=>{
      if(!line.trim())return;
      let msg;try{msg=JSON.parse(line);}catch{return;}
      if(msg.id!==undefined&&msg.method){                     // server->client request
        try{onServerRequest&&onServerRequest(msg);}catch{/* ignore */ }
        return;
      }
      if(msg.id!==undefined){                                 // response to our request
        const p=this.pending&&this.pending.get(msg.id);
        if(!p)return;this.pending.delete(msg.id);
        if(msg.error)p.reject(new Error('codex app-server error: '+(msg.error.message||'unknown')));
        else p.resolve(msg.result);
        return;
      }
      if(msg.method)onNotification(msg);
    });
    this.pending=new Map();this.nextId=1;
  }
  request(method,params){
    if(this.closed)return Promise.reject(new Error('app-server session closed'));
    const id=this.nextId++;
    return new Promise((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});
      try{this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');}
      catch(e){this.pending.delete(id);reject(new Error('app-server write failed'));}
    });
  }
  notify(method,params){
    if(this.closed)return;
    try{this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',method,params})+'\n');}catch{}
  }
  // Always: end stdin, then reap. Never leave an orphan.
  async close(){
    if(this.closed)return this.exitInfo;
    this.closed=true;
    try{this.rl.close();}catch{}
    try{this.child.stdin.end();}catch{}
    if(this.exitInfo===null){
      await new Promise(res=>{const t=setTimeout(res,3000);this.child.once('exit',()=>{clearTimeout(t);res();});});
    }
    if(this.exitInfo===null){try{this.child.kill('SIGKILL');}catch{}}
    await new Promise(res=>{
      if(this.exitInfo!==null)return res();
      const t=setTimeout(res,3000);this.child.once('exit',()=>{clearTimeout(t);res();});
    });
    this.reaped=true;
    return this.exitInfo;
  }
}

/**
 * Stream one source-edit turn. Emits public events through onEvent; returns the raw assistant text.
 * Events: thread.started(transport:'app-server') | turn.started | source.delta
 *         | item.completed | turn.completed | error
 */
export async function streamSourceTurn({prompt,images=[],outputSchema,cwd,root,onEvent=()=>{},signal,timeoutMs=180000,effort='low',tools=false}={}){
  if(typeof prompt!=='string'||!prompt)throw new Error('prompt required');
  const work=path.resolve(cwd||path.join(root,'sdk-work'));
  fs.mkdirSync(work,{recursive:true,mode:0o700});
  const codexHome=ensureAuthHome(root||path.dirname(new URL(import.meta.url).pathname));
  const deadline=AbortSignal.timeout(timeoutMs);
  const abortSignal=signal?AbortSignal.any([signal,deadline]):deadline;
  let aborted=abortSignal.aborted;const onAbort=()=>{aborted=true;};
  abortSignal.addEventListener('abort',onAbort,{once:true});

  let finalText='';let usage=null;let threadId=null;let turnId=null;let turnStatus=null;
  let deltaCount=0;let deltaChars=0;let firstDeltaAt=null,lastDeltaAt=null;let failure=null;
  const started=Date.now();
  const emit=event=>{try{onEvent({at:Date.now(),...event});}catch{}};

  const session=new AppServerSession({
    cwd:work,codexHome,
    onServerRequest:msg=>{
      // approvals are disabled in this lane: answer decisively, never silently hang
      const answer=APPROVAL_RESPONSES[msg.method];
      const payload=answer!==undefined?answer:{};
      session.child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result:payload})+'\n');
    },
    onNotification:msg=>{
      const p=msg.params||{};
      if(msg.method==='item/agentMessage/delta'){
        const delta=typeof p.delta==='string'?p.delta:'';
        if(!delta)return;
        deltaCount++;deltaChars+=Buffer.byteLength(delta);
        if(firstDeltaAt===null)firstDeltaAt=Date.now();
        lastDeltaAt=Date.now();
        if(deltaChars>700000){failure='stream exceeded source batch limit';return;}
        emit({type:'source.delta',text:delta,seq:deltaCount,transport:'app-server'});
        return;
      }
      // Tool activity: surface what the agent runs so the UI can show it.
      if(msg.method==='item/started'&&p.item&&p.item.type==='commandExecution'){
        const cmd=p.item.command||p.item.commandLine||'';
        emit({type:'tool.start',tool:'shell',command:String(cmd).slice(0,2000),itemId:p.item.id||null});
        return;
      }
      if(msg.method==='item/commandExecution/outputDelta'&&typeof p.delta==='string'){
        emit({type:'tool.output',tool:'shell',text:p.delta.slice(0,4000),itemId:p.itemId||null});
        return;
      }
      if(msg.method==='item/completed'&&p.item&&p.item.type==='commandExecution'){
        emit({type:'tool.end',tool:'shell',itemId:p.item.id||null,
          exitCode:p.item.exitCode!==undefined?p.item.exitCode:null,
          status:p.item.status||null});
        return;
      }
      if(INTERNAL_NOTIFICATION_PREFIXES.some(prefix=>msg.method.startsWith(prefix)))return;
      if(msg.method==='item/completed'&&p.item&&p.item.type==='agentMessage'){
        finalText=p.item.text||finalText;
        emit({type:'item.completed',text:String(finalText).slice(0,450000)});
        return;
      }
      if(msg.method==='thread/started'){
        threadId=threadId||p.thread?.id||null;
        return;
      }
      if(msg.method==='thread/tokenUsage/updated'&&p.tokenUsage){
        usage=p.tokenUsage;return;
      }
      if(msg.method==='turn/completed'){
        turnStatus=p.turn?.status||null;
        if(p.turn?.id)turnId=turnId||p.turn.id;
        const msgItem=(p.turn?.items||[]).find(i=>i.type==='agentMessage');
        if(msgItem?.text)finalText=msgItem.text;
        return;
      }
      if(msg.method==='error'){
        const message=p.error?.message||'app-server error';
        failure=failure||message;
        emit({type:'error',message,willRetry:!!p.willRetry});
      }
    }});

  const rpc=async(method,params)=>{
    let listener;
    try{return await Promise.race([session.request(method,params),new Promise((_,reject)=>{listener=()=>reject(new Error('source stream aborted before completion'));if(abortSignal.aborted)listener();else abortSignal.addEventListener('abort',listener,{once:true});})]);}
    finally{if(listener)abortSignal.removeEventListener('abort',listener);}
  };
  try{
    await rpc('initialize',{clientInfo:{name:'gulch-seed',title:null,version:'1.0.0'},capabilities:null});
    session.notify('initialized');
    const thread=await rpc('thread/start',{
      cwd:work,sandbox:'read-only',approvalPolicy:'never',ephemeral:true,
      config:{model_provider:'openai',web_search:'disabled',
        features:{shell_tool:tools===true,apply_patch_freeform:false}}});
    threadId=thread?.thread?.id||threadId;
    emit({type:'thread.started',transport:'app-server',threadId,model:thread?.model||null,
      modelProvider:thread?.modelProvider||null});
    const input=[{type:'text',text:prompt,text_elements:[]},
      ...images.map(image=>({type:'localImage',path:image.path}))];
    const turn=await rpc('turn/start',{threadId,input,effort,outputSchema});
    turnId=turn?.turn?.id||null;turnStatus=turn?.turn?.status||null;
    emit({type:'turn.started',threadId,turnId});
    // wait for completion, failure, abort or child exit
    await new Promise(resolve=>{
      const done=()=>turnStatus==='completed'||turnStatus==='failed'||turnStatus==='interrupted'
        ||!!failure||aborted||!!session.exitInfo;
      if(done())return resolve();
      const iv=setInterval(()=>{if(done()){clearInterval(iv);resolve();}},200);
      iv.unref?.();
    });
    if(aborted)throw new Error('source stream aborted before completion');
    if(failure)throw new Error(failure);
    if(turnStatus!=='completed')throw new Error('Source generation ended without a completed turn');
    if(usage)emit({type:'turn.completed',usage,turnStatus});
    else emit({type:'turn.completed',turnStatus});
    return {text:finalText,usage,turnStatus,threadId,turnId,
      stats:{deltaCount,deltaChars,firstDeltaMs:firstDeltaAt===null?null:firstDeltaAt-started,
        lastDeltaMs:lastDeltaAt===null?null:lastDeltaAt-started,stderrBytes:session.stderrBytes}};
  } finally {
    if(aborted&&threadId&&turnId){
      try{await Promise.race([session.request('turn/interrupt',{threadId,turnId}),new Promise(resolve=>setTimeout(resolve,1000))]);}catch{}
    }
    await session.close();
    abortSignal.removeEventListener('abort',onAbort);
  }
}
