#!/usr/bin/env node
/**
 * TwentyX publisher: never replace the collection with a search snapshot.
 * Incoming entries must be verified against X by a trusted collector or editor.
 * The publisher itself validates shape, count, IDs and URL safety, but cannot
 * prove community membership or media authenticity from URLs alone.
 */
import fs from 'node:fs';
import {hasAdmissionEvidence} from './admissions.mjs';
import path from 'node:path';
import {approveWithdrawals, isWithdrawnHandle, withdrawnHandles} from './withdrawals.mjs';

const root=process.cwd();
const archivePath=path.join(root,'data/collections.json');
const pendingPath=path.join(root,'data/inbox.json');
const outputPath=path.join(root,'artists.json');
const manifestPath=path.join(root,'data/manifest.json');
const read=(p,fallback=[])=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):fallback;
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const handleFromPost=(url)=>{
  try {const u=new URL(url); const m=u.pathname.match(/^\/([a-zA-Z0-9_]{1,15})\/status\/(\d+)\/?$/);return ['x.com','twitter.com'].includes(u.hostname.toLowerCase())&&m?{handle:m[1],id:m[2]}:null;}
  catch{return null;}
};
const imageURL=(url)=>{
  try {const u=new URL(url);return u.protocol==='https:' && u.hostname==='pbs.twimg.com' && u.pathname.startsWith('/media/');}
  catch{return false;}
};
const normalize=(a)=>{
  if(!a||typeof a!=='object'||typeof a.name!=='string'||!a.name.trim()||a.name.length>100) return null;
  const post=handleFromPost(a.postUrl);
  if(!post||!Array.isArray(a.media)||a.media.length!==20||!a.media.every(imageURL))return null;
  if(new Set(a.media).size!==20)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date||''))return null;
  return {name:a.name.trim(),handle:post.handle,postId:post.id,postUrl:'https://x.com/'+post.handle+'/status/'+post.id,
    date:a.date,media:a.media.slice(),...(a.submission ? {submission:a.submission} : {})};
};
if(process.env.TWENTYX_APPROVALS_FILE){
  approveWithdrawals(JSON.parse(fs.readFileSync(process.env.TWENTYX_APPROVALS_FILE,'utf8')));
}
const legacy=read(outputPath), archived=read(archivePath), incoming=read(pendingPath);
for(const [name,data] of [['archive',archived],['published',legacy],['inbox',incoming]])if(!Array.isArray(data))throw new Error(name+' must be an array');
const isWithdrawn=item=>isWithdrawnHandle(handleFromPost(item?.postUrl)?.handle);
const errors=[];
const byId=new Map();
for(const [source,items] of [['archive',archived],['published',legacy],['inbox',incoming]]){
  for(const [index,item] of items.entries()){
    if(isWithdrawn(item))continue;
    const normalized=normalize(item);
    if(!normalized){errors.push(source+' item '+index+' ('+(item?.name||'unnamed')+') is not a complete valid 20-image set');continue;}
    if(!hasAdmissionEvidence(normalized)){
      if(source==='inbox'){
        console.warn('Held for missing #TwentyX evidence:',normalized.postId);
        continue;
      }
      errors.push(source+' entry has no #TwentyX evidence: '+normalized.postId);
      continue;
    }
    if(!byId.has(normalized.postId))byId.set(normalized.postId,normalized);
  }
}
// Refuse any malformed input instead of potentially publishing partial data.
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
if(byId.size<Math.max(archived.filter(item=>!isWithdrawn(item)).length,legacy.filter(item=>!isWithdrawn(item)).length))throw new Error('Refusing to shrink archive');
const all=[...byId.values()].sort((a,b)=>b.postId.localeCompare(a.postId));
const removedCollections=new Map([...archived,...legacy].filter(isWithdrawn).map(item=>{
  const post=handleFromPost(item.postUrl);
  return [post.id,post.handle.toLowerCase()];
}));
for(const handle of withdrawnHandles){
  fs.rmSync(path.join(root,'@'+handle,'index.html'),{force:true});
}
const welcomePath=path.join(root,'welcome');
if(fs.existsSync(welcomePath)){
  for(const file of fs.readdirSync(welcomePath)){
    const match=file.match(/^([a-z0-9_]{1,15})-\d+(?:--[a-z0-9-]+)?\.(?:png|svg)$/i);
    if(isWithdrawnHandle(match?.[1]))fs.rmSync(path.join(welcomePath,file),{force:true});
  }
}
if(incoming.some(isWithdrawn))write(pendingPath,incoming.filter(item=>!isWithdrawn(item)));
if(removedCollections.size){
  const removalReport={
    publishedAt:new Date().toISOString(),
    artistsRemoved:new Set(removedCollections.values()).size,
    collectionsRemoved:removedCollections.size,
    artworksRemoved:removedCollections.size*20
  };
  write(path.join(root,'data/removal-report.json'),removalReport);
  const summary=process.env.GITHUB_STEP_SUMMARY;
  if(summary)fs.appendFileSync(summary,'### Exhibition removals\n\n'+removalReport.artistsRemoved+' artists, '+removalReport.collectionsRemoved+' collections, '+removalReport.artworksRemoved+' works removed.\n');
}
write(archivePath,all);
write(outputPath,all);
const manifest={collectionCount:all.length,artworkCount:all.length*20,posts:all.map(x=>x.postId)};
write(manifestPath,manifest);
console.log('Published',all.length,'complete collections.');
