export function reconstructVersions(state,current){
  const jobs=state.patches.filter(j=>j.status==='applied'&&Number.isInteger(j.revision)&&Array.isArray(j.changes)&&j.changes.length).sort((a,b)=>b.revision-a.revision);
  const byRevision=new Map(jobs.map(j=>[j.revision,j]));
  const snapshots=new Map([[state.revision,{...current}]]);
  let revision=state.revision,files={...current};
  while(byRevision.has(revision)){
    const job=byRevision.get(revision);
    if(!job.changes.every(c=>(files[c.path]??null)===c.after))break;
    files={...files};
    for(const change of job.changes){if(change.before===null)delete files[change.path];else files[change.path]=change.before;}
    revision--;snapshots.set(revision,files);
  }
  const versions=[...snapshots.keys()].map(revision=>{
    const job=byRevision.get(revision);
    return {revision,active:revision===state.revision,taskId:job?.id??null,summary:job?.text?.slice(0,180)||'Earlier source baseline',files:job?.changes?.map(c=>c.path)||[],finishedAt:job?.finishedAt??null};
  });
  return {versions,snapshots};
}
export function reversionOperations(state,current,taskId){
  const job=state.patches.find(j=>j.id===taskId&&j.status==='applied'&&j.changes?.length);
  if(!job)throw Error('No verified source changes for that task.');
  if(!job.changes.every(c=>(current[c.path]??null)===c.after))throw Error('A later task changed the same files; selective undo needs review.');
  return job.changes.map(c=>({op:c.before===null?'delete':c.after===null?'create':'update',path:c.path,content:c.before??''}));
}
export function restorationOperations(state,current,revision){
  if(!Number.isInteger(revision))throw Error('Choose a valid source revision.');
  const target=reconstructVersions(state,current).snapshots.get(revision);
  if(!target)throw Error('This revision cannot be reconstructed from verified change history.');
  const operations=[];
  for(const name of new Set([...Object.keys(current),...Object.keys(target)])){
    if(current[name]===target[name])continue;
    operations.push({op:target[name]===undefined?'delete':current[name]===undefined?'create':'update',path:name,content:target[name]??''});
  }
  if(!operations.length)throw Error('That source revision is already active.');
  if(operations.length>24)throw Error('Restore touches more than 24 files; an operator review is required.');
  return operations;
}
