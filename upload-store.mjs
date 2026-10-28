import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const DIR=path.join(ROOT,'private-uploads');
const LIMIT=10*1024*1024;
const TYPES={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
function matches(data,type){
  if(type==='image/png')return data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(type==='image/jpeg')return data[0]===255&&data[1]===216&&data[2]===255;
  if(type==='image/webp')return data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';
  return false;
}
export async function acceptUpload(req,owner){
  const type=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
  if(!TYPES[type])throw new Error('Choose a JPEG, PNG or WebP image.');
  if(Number(req.headers['content-length'])>LIMIT)throw new Error('Image exceeds the 10 MB limit.');
  let length=0;const chunks=[];
  for await(const chunk of req){length+=chunk.length;if(length>LIMIT)throw new Error('Image exceeds the 10 MB limit.');chunks.push(chunk);}
  const data=Buffer.concat(chunks);if(!matches(data,type))throw new Error('The file does not match its image type.');
  fs.mkdirSync(DIR,{recursive:true,mode:0o700});
  const bytes=fs.readdirSync(DIR).reduce((n,f)=>n+fs.statSync(path.join(DIR,f)).size,0);
  if(bytes+length>200*1024*1024)throw new Error('Room upload storage is full.');
  const id=crypto.randomBytes(16).toString('hex');
  let name='image';try{name=decodeURIComponent(req.headers['x-upload-name']||'image');}catch{}
  name=path.basename(name).replace(/[\x00-\x1f]/g,'').slice(0,120);
  const record={id,name,type,size:length,owner,createdAt:Date.now(),extension:TYPES[type]};
  fs.writeFileSync(path.join(DIR,id+'.'+TYPES[type]),data,{flag:'wx',mode:0o600});
  fs.writeFileSync(path.join(DIR,id+'.json'),JSON.stringify(record),{flag:'wx',mode:0o600});
  return {id,name,type,size:length};
}
export function resolveUploads(ids,owner){
  if(!Array.isArray(ids)||ids.length>4)throw new Error('Attach up to four images.');
  return ids.map(id=>{
    if(typeof id!=='string'||!/^[0-9a-f]{32}$/.test(id))throw new Error('Invalid attachment.');
    let meta;try{meta=JSON.parse(fs.readFileSync(path.join(DIR,id+'.json'),'utf8'));}catch{throw new Error('Attachment missing. Select it again.');}
    if(meta.owner!==owner)throw new Error('This attachment belongs to a different session.');
    if(!TYPES[meta.type])throw new Error('Invalid image type.');
    const file=path.join(DIR,id+'.'+TYPES[meta.type]);
    if(!fs.existsSync(file))throw new Error('Attachment missing. Select it again.');
    return {id,name:meta.name,path:file,type:meta.type};
  });
}
