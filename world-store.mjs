import fs from 'node:fs';
import path from 'node:path';
import crypto, {createHash} from 'node:crypto';

export const RECENT_OP_LIMIT=512, OPLOG_LIMIT=1024;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function canonical(value,depth=0) {
  if(depth>40)throw Error('Operation nesting exceeds limit');
  if(Array.isArray(value))return value.map(v=>canonical(v,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k],depth+1)]));
  return value;
}
function withOps(record,oplog=[],retiredThrough=-1) {
  return {...record,oplogVersion:1,oplog,retiredThrough,oplogHash:digest({oplog,retiredThrough})};
}
function withOrdered(record,ordered) {
  return {...record,ordered,orderedHash:digest(ordered)};
}
function validateOps(record) {
 if(record.ordered===undefined)return validateLegacyOps(record);
 if(record.orderedHash!==digest(record.ordered))throw Error('Invalid authoritative ordered state');
 validateOrderedState(record.ordered);
 return validateLegacyOps(record);
}
function validateLegacyOps(record) {
  if(record.oplogVersion===undefined&&record.oplog===undefined&&record.oplogHash===undefined&&record.retiredThrough===undefined)return withOps(record);
  const {oplog,retiredThrough}=record;
  if(record.oplogVersion!==1||!Array.isArray(oplog)||oplog.length>OPLOG_LIMIT||
    !Number.isSafeInteger(retiredThrough)||retiredThrough< -1||retiredThrough>=record.sequence||
    record.oplogHash!==digest({oplog,retiredThrough}))throw Error('Invalid authoritative oplog');
  const ids=new Set();let previous=-1;
  for(const op of oplog){
    if(!op||!UUID.test(op.opId)||ids.has(op.opId)||!Number.isSafeInteger(op.baseSeq)||
      op.baseSeq<=previous||op.baseSeq>=record.sequence||! /^[a-f0-9]{64}$/.test(op.fingerprint)||
      (op.commandFingerprint!==undefined&&(typeof op.commandFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(op.commandFingerprint)))||
      op.result?.ok!==true||op.result.stateRevision!==op.baseSeq+1||
      Object.keys(op.result).length!==2)throw Error('Invalid authoritative oplog');
    ids.add(op.opId);previous=op.baseSeq;
  }
  const retired=oplog.slice(0,-RECENT_OP_LIMIT);
  if(retired.length&&retired.at(-1).baseSeq!==retiredThrough)throw Error('Invalid authoritative oplog retirement');
  return record;
}
import {validateCommit} from './room-store.mjs';

// One server process owns both files. An uncertain metadata rename also fences
// world acknowledgements, because source-revision rollback may only be in memory.
let metadataUncertain=false;

export function syncDirectory(file) {
  const fd=fs.openSync(path.dirname(file),'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

// Synchronous metadata callers retain their existing publication boundary.
export function durableReplace(file,text) {
  if(metadataUncertain)throw Error('Metadata storage requires restart after uncertain publication');
  const temp=file+'.tmp';
  const fd=fs.openSync(temp,'w',0o600);
  try { fs.writeFileSync(fd,text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp,file);
  try { syncDirectory(file); } catch(error) { metadataUncertain=true;throw error; }
}

function worldRecord(state,sequence) {
  return {format:1,sequence,gameState:state.gameState,
    stateRevision:state.stateRevision,gameLog:state.gameLog};
}
function validateRecord(record) {
  if(record.format!==1||!Number.isSafeInteger(record.sequence)||record.sequence<0||
    !Number.isSafeInteger(record.stateRevision)||record.stateRevision<0||
    record.sequence!==record.stateRevision||!Array.isArray(record.gameLog)||
    validateCommit({stateRevision:0,revision:0},{base:0,revision:0,data:record.gameState}))
    throw Error('Invalid authoritative world store');
  return validateOps(record);
}
function readRecord(file) {
  return validateRecord(JSON.parse(fs.readFileSync(file,'utf8')));
}

export function openWorldStore(file,state,split=false) {
  let record;
  try { record=readRecord(file); }
  catch(error) {
    if(error.code!=='ENOENT'||split)throw error;
    record=validateRecord(worldRecord(state,state.stateRevision));
    durableReplace(file,JSON.stringify(record));
  }
  Object.assign(state,{gameState:record.gameState,stateRevision:record.stateRevision,
    gameLog:record.gameLog,worldStore:1});
  let tail=Promise.resolve(),fenced=false;
// Command mode is the explicit fence the plan requires: once active, the legacy
// whole-world write path fails closed so it cannot invalidate an ordered simulation.
// A durable ordered block means command mode was already entered before a restart,
// so it must re-engage here rather than silently revert to legacy writes.
let commandMode=record.ordered!==undefined;
  let recent=new Map(record.oplog.slice(-RECENT_OP_LIMIT).map(op=>[op.opId,op]));
  function commandReceipt(opId,commandFingerprint,baseSequence) {
    if(fenced||metadataUncertain)throw Error('World storage requires restart after uncertain publication');
    if(typeof opId!=='string'||!UUID.test(opId))return {code:400,error:'clientOpId must be a UUID'};
    if(typeof commandFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(commandFingerprint))
      return {code:400,error:'commandFingerprint must be a lowercase SHA-256'};
    if(!Number.isSafeInteger(baseSequence)||baseSequence<0)
      return {code:400,error:'baseSequence must be a nonnegative safe integer'};
    const previous=recent.get(opId);
    if(previous)return previous.commandFingerprint===commandFingerprint?
      {result:structuredClone(previous.result)}:
      {code:409,error:'Operation ID was already committed with a different body'};
    if(baseSequence<=record.retiredThrough||record.oplog.some(op=>op.opId===opId))
      return {code:409,error:'Operation receipt expired; refresh before a new action',staleOpId:true};
    return null;
  }
  async function commit(b,publish) {
    if(fenced||metadataUncertain)throw Error('World storage requires restart after uncertain publication');
    if(commandMode)return {code:409,error:'Legacy whole-world writes are fenced while ordered command authority is active'};
    let fingerprint;
    if(b.commandFingerprint!==undefined){
      const receipt=commandReceipt(b.clientOpId,b.commandFingerprint,b.base);
      if(receipt)return receipt;
      fingerprint=digest(canonical(b));
    }else if(b.clientOpId!==undefined){
      if(typeof b.clientOpId!=='string'||!UUID.test(b.clientOpId))return {code:400,error:'clientOpId must be a UUID'};
      fingerprint=digest(canonical(b));
      const previous=recent.get(b.clientOpId);
      if(previous)return previous.commandFingerprint===undefined&&previous.fingerprint===fingerprint?{result:structuredClone(previous.result)}:
        {code:409,error:'Operation ID was already committed with a different body'};
      // Old exact retries carry their original base. Arbitrary UUID reuse with a
      // fabricated newer base cannot be detected forever with bounded storage.
      if(b.base<=record.retiredThrough||record.oplog.some(op=>op.opId===b.clientOpId))
        return {code:409,error:'Operation receipt expired; refresh before a new action',staleOpId:true};
    }
    const invalid=validateCommit(state,b);if(invalid)return invalid;
    const activity=typeof b.activity==='string'&&b.activity.length<=300&&b.activity;
    const world=worldRecord({...state,gameState:structuredClone(b.data),
      stateRevision:state.stateRevision+1,
      gameLog:activity?[...state.gameLog,{text:activity,at:Date.now()}].slice(-60):state.gameLog},record.sequence+1);
    const result={ok:true,stateRevision:world.stateRevision};
    const entries=b.clientOpId?[...record.oplog,{opId:b.clientOpId,baseSeq:b.base,fingerprint,...(b.commandFingerprint!==undefined?{commandFingerprint:b.commandFingerprint}:{}),result}]:record.oplog;
    const retiredThrough=entries.length>RECENT_OP_LIMIT?entries.at(-RECENT_OP_LIMIT-1).baseSeq:record.retiredThrough;
    const legacy=withOps(world,entries.slice(-OPLOG_LIMIT),retiredThrough);
    // Defence in depth: never drop a durable ordered block on this path even though
    // command mode normally fences the legacy path before it is reached.
    const next=record.ordered!==undefined?withOrdered(legacy,record.ordered):legacy;
    const temp=file+'.pending';
    let renamed=false;
    try {
      const fd=await fs.promises.open(temp,'w',0o600);
      try { await fd.writeFile(JSON.stringify(next)); await fd.sync(); } finally { await fd.close(); }
      // Builders can promote sources while preparation yields. Recheck both revisions.
      if(metadataUncertain)throw Error('Metadata storage requires restart after uncertain publication');
      const conflict=validateCommit(state,b);if(conflict)return conflict;
      fs.renameSync(temp,file);renamed=true;
      syncDirectory(file);
      record=next;
      recent=new Map(next.oplog.slice(-RECENT_OP_LIMIT).map(op=>[op.opId,op]));
      Object.assign(state,{gameState:next.gameState,stateRevision:next.stateRevision,gameLog:next.gameLog});
      publish();
      return b.clientOpId?{result:structuredClone(result)}:null;
    } catch(error) {
      // After rename, recovery may observe this unacknowledged action. Never overwrite
      // it with another action from the old accepted in-memory revision.
      if(renamed)fenced=true;
      throw error;
    } finally {
      try { fs.unlinkSync(temp); } catch(error) { if(error.code!=='ENOENT'&&error.code!=='EISDIR')fenced=true; }
    }
  }
  // Serialized ordered authority. classify->simulate->persist all run inside the
  // single durable tail, so simulation and durable publication share one world
  // mutation order. Legacy whole-world writes are fenced (commandMode) meanwhile.
  async function orderedCommit(envelope,context,simulate) {
    if(fenced||metadataUncertain)throw Error('World storage requires restart after uncertain publication');
    const ordered=record.ordered||emptyOrderedState(context.epoch);
    // Source authority is the LIVE world revision at execution time, never the
    // request-time context: a queued command must be refused if the source was
    // promoted (or otherwise changed) before it ran.
    const decision=classifyCommand(ordered,envelope,{sourceRevision:state.revision,maxStreams:MAX_STREAMS});
    if(decision.replay)return {...structuredClone(decision.result),outcome:'replayed'};
    if(decision.code)return decision;
    const base=state.stateRevision,revision=state.revision,sourceDir=state.sourceDir,epoch=ordered.epoch;
    let simulated;
    try { simulated=await simulate(decision.command); }
    catch(error) { return {code:503,error:typeof error?.message==='string'?error.message:'Ordered simulation failed'}; }
    if(simulated&&simulated.code)return simulated;
    if(!simulated||typeof simulated!=='object'||Array.isArray(simulated)||
       !simulated.data||typeof simulated.data!=='object'||Array.isArray(simulated.data)||
       typeof simulated.activity!=='string'||simulated.activity.length>300)
      return {code:503,error:'Ordered simulation returned an invalid or incomplete result'};
    // Enforce the same room-store world contract as the legacy commit path BEFORE the
    // durable write: size (<=200000 UTF-8 bytes) and nesting (<=32). Without this an
    // oversized world could be acknowledged and then fail-closed on recovery.
    const contract=validateCommit({stateRevision:state.stateRevision,revision:state.revision},
      {base:state.stateRevision,revision:state.revision,data:simulated.data});
    if(contract)return {code:contract.code,error:contract.error};
    if(state.stateRevision!==base||state.revision!==revision||state.sourceDir!==sourceDir)
      return {code:409,error:'State or source revision changed during ordered simulation'};
    if(epoch!==record.ordered?.epoch&&record.ordered!==undefined)
      return {code:409,error:'World epoch changed during ordered simulation',staleEpoch:true};
    const activity=simulated.activity||undefined;
    const world=worldRecord({...state,gameState:structuredClone(simulated.data),
      stateRevision:state.stateRevision+1,
      gameLog:activity?[...state.gameLog,{text:activity,at:Date.now()}].slice(-60):state.gameLog},record.sequence+1);
    const response={ok:true,stateRevision:world.stateRevision,worldEpoch:epoch,sourceRevision:revision,
      streamId:envelope.streamId,clientSequence:envelope.clientSequence,opId:envelope.opId,outcome:'committed'};
    const nextOrdered=applyCommand(ordered,envelope,decision.fingerprint,response);
    const next=withOrdered(withOps(world,record.oplog,record.retiredThrough),nextOrdered);
    const temp=file+'.pending';
    let renamed=false;
    try {
      const fd=await fs.promises.open(temp,'w',0o600);
      try { await fd.writeFile(JSON.stringify(next)); await fd.sync(); } finally { await fd.close(); }
      if(metadataUncertain)throw Error('Metadata storage requires restart after uncertain publication');
      if(state.stateRevision!==base||state.revision!==revision||state.sourceDir!==sourceDir)
        return {code:409,error:'State or source revision changed during ordered publication'};
      fs.renameSync(temp,file);renamed=true;
      syncDirectory(file);
      record=next;
      recent=new Map(next.oplog.slice(-RECENT_OP_LIMIT).map(op=>[op.opId,op]));
      Object.assign(state,{gameState:next.gameState,stateRevision:next.stateRevision,gameLog:next.gameLog});
      // The first durable ordered commit transitions the store into command mode.
      // From that point legacy whole-world writes fail closed, so an unconverted
      // client can never invalidate an ordered simulation.
      commandMode=true;
      return structuredClone(response);
    } catch(error) {
      if(renamed)fenced=true;
      throw error;
    } finally {
      try { fs.unlinkSync(temp); } catch(error) { if(error.code!=='ENOENT'&&error.code!=='EISDIR')fenced=true; }
    }
  }

  return {commandReceipt,commit(b,publish=()=>{}) {
    const result=tail.then(()=>commit(b,publish));
    tail=result.catch(()=>{});
    return result;
  },orderedCommand(envelope,context,simulate) {
    const result=tail.then(()=>orderedCommit(envelope,context,simulate));
    tail=result.catch(()=>{});
    return result;
  },setCommandMode(enabled) {
    commandMode=enabled===true;
    return commandMode;
  },commandModeActive() { return commandMode; },
  orderedEpoch() { return record.ordered!==undefined?record.ordered.epoch:null; }};
}

// ============================================================================================
// COMPOSED v2 (permitted-path composition)
// These ordered-coordinate helpers were INLINED from the accepted, independently reviewed
// coordinate.mjs (b54230d7727a14b082fb454d74afb12f4f66603e49d72d6772e42ef2de2836b9). A root-level
// './coordinate.mjs' import is NOT satisfiable by the unchanged normal native release:
// coordinate.mjs is absent from the publisher root, and applyBackendOperations refuses to CREATE any
// root name other than movement-engine.mjs. Behaviour is preserved; only the module boundary moved,
// so no new root path is introduced and the deployed graph stays inside the normal release's copy set.
// ============================================================================================

export const ORDERED_SCHEMA = 1;
export const MAX_RECEIPTS_PER_STREAM = 512;
export const MAX_STREAMS = 64;

const STREAM_ID = /^[A-Za-z0-9_-]{8,64}$/;
// Object.prototype member names pass the character class but alias inherited
// properties, so a lookup would read the prototype instead of the stream and an
// assignment could pollute it. Reject them explicitly.
const RESERVED_STREAM_IDS = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);
// (composed) UUID is already declared above in this module; the accepted coordinate text used an
// identical regex, so the duplicate declaration is removed rather than redeclared.

const EPOCH = /^[0-9a-f]{16,64}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;

function exact(value, keys) {
 return value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

export function emptyOrderedState(epoch) {
 if (typeof epoch !== 'string' || !EPOCH.test(epoch)) throw Error('Invalid ordered world epoch');
 return {version: ORDERED_SCHEMA, epoch, streams: {}};
}

// Fingerprint the complete canonical envelope body. Client wall-clock is never an
// input, so an identical identity+body always reproduces the same fingerprint.
export function envelopeFingerprint(envelope) {
 return createHash('sha256').update(JSON.stringify({
  version: envelope.version, worldEpoch: envelope.worldEpoch, sourceRevision: envelope.sourceRevision,
  streamId: envelope.streamId, clientSequence: envelope.clientSequence, opId: envelope.opId, action: envelope.action,
 }), 'utf8').digest('hex');
}

// Structural validation only. Action *qualification* is decided by normalizeAction
// so an unqualified family fails closed with a distinct reason.
export function validateEnvelope(envelope) {
 if (!exact(envelope, ['version', 'worldEpoch', 'sourceRevision', 'streamId', 'clientSequence', 'opId', 'action']))
  return {code: 400, error: 'Ordered command envelope must carry exactly version, worldEpoch, sourceRevision, streamId, clientSequence, opId and action'};
 if (envelope.version !== ORDERED_SCHEMA) return {code: 400, error: 'Unsupported ordered command version'};
 if (typeof envelope.worldEpoch !== 'string' || !EPOCH.test(envelope.worldEpoch))
  return {code: 400, error: 'worldEpoch must be a lowercase hex token'};
 if (!Number.isSafeInteger(envelope.sourceRevision) || envelope.sourceRevision < 0)
  return {code: 400, error: 'sourceRevision must be a nonnegative safe integer'};
 if (typeof envelope.streamId !== 'string' || !STREAM_ID.test(envelope.streamId) || RESERVED_STREAM_IDS.has(envelope.streamId))
  return {code: 400, error: 'streamId must be an opaque 8-64 character token'};
 if (!Number.isSafeInteger(envelope.clientSequence) || envelope.clientSequence < 0)
  return {code: 400, error: 'clientSequence must be a nonnegative safe integer'};
 if (typeof envelope.opId !== 'string' || !UUID.test(envelope.opId))
  return {code: 400, error: 'opId must be a UUID'};
 const action = envelope.action;
 if (action === null || typeof action !== 'object' || Array.isArray(action) || typeof action.type !== 'string')
  return {code: 400, error: 'action must be an object carrying a type'};
 return null;
}

// Only cardinal single-step moves are qualified in this slice. Everything else
// (diagonals, descend, and later action families) fails closed and never advances.
export function normalizeAction(action) {
 if (exact(action, ['type', 'dx', 'dy']) && action.type === 'move' &&
  Number.isSafeInteger(action.dx) && Number.isSafeInteger(action.dy)) {
  if (Math.abs(action.dx) + Math.abs(action.dy) === 1)
   return {command: {type: 'move', dx: action.dx === 0 ? 0 : action.dx, dy: action.dy === 0 ? 0 : action.dy}};
  return {code: 422, error: 'Diagonal movement is not qualified for ordered authority; command refused', unsupported: true};
 }
 if (action.type === 'move') return {code: 400, error: 'move action must carry integer dx and dy'};
 return {code: 422, error: 'Action family is not qualified for ordered authority; command refused', unsupported: true};
}

function findReceipt(ordered, opId) {
 for (const stream of Object.values(ordered.streams)) {
  for (let i = stream.receipts.length - 1; i >= 0; i--) if (stream.receipts[i].opId === opId) return stream.receipts[i];
 }
 return null;
}

/*
 * Decide how `envelope` sequences against the durable `ordered` state.
 * Returns one of:
 *   {replay, result}                       - exact identity+body retry; no advance
 *   {accept, fingerprint, command}         - expected next sequence; caller simulates
 *   {code, error, ...flags}                - refusal; never advances
 */
export function classifyCommand(ordered, envelope, context) {
 const invalid = validateEnvelope(envelope);
 if (invalid) return invalid;
 const fingerprint = envelopeFingerprint(envelope);
 // Known-receipt identity/fingerprint classification comes BEFORE current-source and
 // current-epoch admission. A matching fingerprint proves the envelope is byte-identical
 // to the durably-accepted original, so an exact retry must return the original result
 // (idempotency) even after the source was promoted — it never advances. A NEW command
 // has no receipt, so it still falls through to the epoch/source admission below (F3).
 const receipt = findReceipt(ordered, envelope.opId);
 if (receipt) return receipt.fingerprint === fingerprint
  ? {replay: true, result: structuredClone(receipt.result), opId: envelope.opId}
  : {code: 409, error: 'Operation ID was already committed with a different identity or body', conflict: true};
 if (envelope.worldEpoch !== ordered.epoch)
  return {code: 409, error: 'World epoch changed; re-bootstrap before commanding', staleEpoch: true};
 if (envelope.sourceRevision !== context.sourceRevision)
  return {code: 409, error: 'Source revision changed; refresh before submitting a new command', staleSource: true};
 const normalized = normalizeAction(envelope.action);
 if (normalized.code) return normalized;
 const stream = Object.hasOwn(ordered.streams, envelope.streamId) ? ordered.streams[envelope.streamId] : undefined;
 if (!stream) {
  if (Object.keys(ordered.streams).length >= context.maxStreams)
   return {code: 503, error: 'Ordered command stream capacity reached; retry shortly', capacity: true};
  if (envelope.clientSequence !== 0)
   return {code: 409, error: 'Unknown ordered stream must begin at sequence 0', expected: 0, gap: true};
  return {accept: true, fingerprint, command: normalized.command};
 }
 if (envelope.clientSequence === stream.next) return {accept: true, fingerprint, command: normalized.command};
 if (envelope.clientSequence > stream.next)
  return {code: 409, error: 'Ordered sequence gap; expected ' + stream.next, expected: stream.next, gap: true};
 if (envelope.clientSequence <= stream.retiredThrough)
  return {code: 409, error: 'Ordered sequence was retired; a new action for it is never executed', staleSequence: true, expected: stream.next};
 return {code: 409, error: 'Ordered sequence already consumed; an exact retry needs its original opId', staleSequence: true, expected: stream.next};
}

// Compute the durable ordered state after an accepted command. Bounded per-stream
// receipts retire oldest-first, advancing `retiredThrough` so a dropped sequence
// can never be re-executed as new even though its receipt is gone.
export function applyCommand(ordered, envelope, fingerprint, result) {
 const streams = {...ordered.streams};
 const previous = Object.hasOwn(streams, envelope.streamId) ? streams[envelope.streamId] : {next: 0, retiredThrough: -1, receipts: []};
 const receipts = [...previous.receipts, {seq: envelope.clientSequence, opId: envelope.opId, fingerprint, result}];
 let retiredThrough = previous.retiredThrough;
 while (receipts.length > MAX_RECEIPTS_PER_STREAM) {
  const dropped = receipts.shift();
  if (dropped.seq > retiredThrough) retiredThrough = dropped.seq;
 }
 Object.defineProperty(streams, envelope.streamId, {value: {next: envelope.clientSequence + 1, retiredThrough, receipts}, enumerable: true, writable: true, configurable: true});
 return {...ordered, streams};
}

// Fail-closed validation of a persisted ordered block. A corrupt or tampered
// record must refuse recovery exactly like the existing oplog validation.
export function validateOrderedState(ordered) {
 const fail = () => { throw Error('Invalid authoritative ordered state'); };
 if (!ordered || typeof ordered !== 'object' || Array.isArray(ordered)) fail();
 if (ordered.version !== ORDERED_SCHEMA || typeof ordered.epoch !== 'string' || !EPOCH.test(ordered.epoch)) fail();
 const streams = ordered.streams;
 if (!streams || typeof streams !== 'object' || Array.isArray(streams)) fail();
 if (Object.keys(streams).length > MAX_STREAMS) fail();
 const ids = new Set();
 for (const [id, stream] of Object.entries(streams)) {
  if (!STREAM_ID.test(id) || RESERVED_STREAM_IDS.has(id) || !stream || typeof stream !== 'object' || Array.isArray(stream)) fail();
  if (!Number.isSafeInteger(stream.next) || stream.next < 0) fail();
  if (!Number.isSafeInteger(stream.retiredThrough) || stream.retiredThrough < -1 || stream.retiredThrough >= stream.next) fail();
  if (!Array.isArray(stream.receipts) || stream.receipts.length > MAX_RECEIPTS_PER_STREAM) fail();
  let previous = -1;
  for (const receipt of stream.receipts) {
   if (!receipt || !UUID.test(receipt.opId) || !FINGERPRINT.test(receipt.fingerprint) ||
    !Number.isSafeInteger(receipt.seq) || receipt.seq <= previous || receipt.seq >= stream.next) fail();
   if (ids.has(receipt.opId)) fail();
   ids.add(receipt.opId);
   previous = receipt.seq;
  }
 }
 return ordered;
}
