#!/usr/bin/env node
/**
 * TwentyX X API discovery.
 * Reads public recent #TwentyX posts and only auto-admits an explicitly
 * verified ArtVision community post with exactly twenty complete photo media.
 * Ambiguous cases go to review, NEVER directly to the public archive.
 *
 * Configuration: GitHub Actions secret X_BEARER_TOKEN; optional
 * X_COMMUNITY_ID, X_MAX_PAGES. No credentials or speculative collections
 * are ever committed.
 */
import fs from 'node:fs';
import {hasSubmissionTag} from './admissions.mjs';
import {pathToFileURL} from 'node:url';

const COMMUNITY_ID='1835009931231322257';
const API='https://api.x.com/2/tweets/search/recent';
const QUERY='#TwentyX has:media -is:retweet -is:quote';
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const read=(file,fallback=[])=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const imageURL=url=>{
 try {const u=new URL(url);return u.protocol==='https:'&&u.hostname==='pbs.twimg.com'&&u.pathname.startsWith('/media/');}
 catch{return false;}
};
const safeHandle=s=>typeof s==='string'&&/^[A-Za-z0-9_]{1,15}$/.test(s);
const status=(id,kind,reason,metadata={})=>({id:String(id||''),kind,reason,...metadata});

/** Pure candidate evaluation: never invent missing media or community proof. */
export function evaluatePost(post,includes,communityId=COMMUNITY_ID){
 const id=String(post?.id||'');
 const users=new Map((includes?.users||[]).map(u=>[String(u.id),u]));
 const media=new Map((includes?.media||[]).map(m=>[String(m.media_key),m]));
 const author=users.get(String(post?.author_id));
 const handle=author?.username;
 const meta={postUrl:safeHandle(handle)&&/^\d+$/.test(id)?'https://x.com/'+handle+'/status/'+id:null,
   name:typeof author?.name==='string'?author.name.slice(0,100):null,
   observedCommunity:String(post?.community_id||'')||null};
 if(!/^\d+$/.test(id))return status(id,'reject','invalid-post-id');
 if(post?.referenced_tweets?.some(r=>['retweeted','quoted'].includes(r.type)))return status(id,'reject','repost-or-quote');
 if(!hasSubmissionTag(post?.text))return status(id,'reject','missing-twentyx-hashtag');
 if(!author||!safeHandle(handle)||typeof author.name!=='string'||!author.name.trim())return status(id,'review','missing-author',meta);
 const keys=post?.attachments?.media_keys;
 if(!Array.isArray(keys)||keys.length!==20||new Set(keys).size!==20)return status(id,'reject','not-exactly-twenty-attachments',{...meta,count:Array.isArray(keys)?keys.length:0});
 if(String(post?.community_id||'')!==String(communityId)){
  return status(id,'review','community-unverified',{...meta,expectedCommunity:String(communityId)});
 }
 if(!Array.isArray(includes?.media)||keys.some(k=>!media.has(String(k))))return status(id,'review','missing-expanded-media',meta);
 const ordered=keys.map(k=>media.get(String(k)));
 if(ordered.some(m=>m.type!=='photo'))return status(id,'review','non-image-media-needs-video-renderer',meta);
 const urls=ordered.map(m=>m.url);
 if(urls.some(url=>!imageURL(url))||new Set(urls).size!==20)return status(id,'review','media-url-incomplete',meta);
 const date=String(post?.created_at||'').slice(0,10);
 if(!DATE.test(date))return status(id,'review','missing-post-date',meta);
 return status(id,'admit','verified-twenty-photo-community-post',{
  record:{name:author.name.trim(),postUrl:meta.postUrl,date,media:urls,submission:{postUrl:meta.postUrl,caption:post.text}},
  ...meta
 });
}
function unique(records){
 const byId=new Map();
 for(const record of records){
  const id=String(record?.postUrl||'').match(/\/status\/(\d+)/)?.[1];
  if(id&&!byId.has(id))byId.set(id,record);
 }
 return [...byId.values()];
}
function reviewUnique(records){
 const byId=new Map();for(const r of records)if(r&&/^\d+$/.test(String(r.id)))byId.set(String(r.id),r);
 return [...byId.values()].slice(-250);
}
async function getPage(token,params,nextToken){
 const url=new URL(API);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 if(nextToken)url.searchParams.set('pagination_token',nextToken);
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(25000)});
 const body=await response.json().catch(()=>({}));
 // Some API tiers omit the community_id field. Retry without it, but then
 // REQUIRE MANUAL REVIEW: the missing field is never treated as proof.
 if(response.status===400 && params['tweet.fields']?.includes('community_id')){
  const fallback={...params,'tweet.fields':params['tweet.fields'].split(',').filter(f=>f!=='community_id').join(',')};
  console.warn('X API does not accept community_id field; holding all candidates for review.');
  return getPage(token,fallback,nextToken);
 }
 if(!response.ok)throw Error('X recent search HTTP '+response.status+' '+String(body.title||body.detail||'').slice(0,140));
 if(body.errors?.length)throw Error('X returned partial search errors; refusing incomplete discovery');
 return body;
}
export async function runDiscovery({token,communityId=COMMUNITY_ID,maxPages=2}={}){
 if(!token){console.log('Discovery not active: set GitHub Actions secret X_BEARER_TOKEN. Existing archive is safe.');return {configured:false}}
 const params={
  query:QUERY,max_results:'100',
  'tweet.fields':'id,text,author_id,created_at,attachments,entities,referenced_tweets,community_id',
  expansions:'author_id,attachments.media_keys',
  'user.fields':'id,username,name',
  'media.fields':'media_key,type,url,preview_image_url'
 };
 const existing=read('data/inbox.json'),review=read('data/review-queue.json');
 if(!Array.isArray(existing)||!Array.isArray(review))throw Error('Expected arrays in inbox and review queue');
 let nextToken=null,scanned=0,admitted=0,rejected=0,toReview=0;
 let admissions=[],reviewEntries=[];
 for(let page=0;page<Math.max(1,Math.min(Number(maxPages)||2,5));page++){
  const result=await getPage(token,params,nextToken);
  for(const post of result.data||[]){
   scanned++;
   const outcome=evaluatePost(post,result.includes||{},communityId);
   if(outcome.kind==='admit'){admissions.push(outcome.record);admitted++}
   else if(outcome.kind==='review'){
    const {record,...short}=outcome;reviewEntries.push(short);toReview++;
   }else rejected++;
  }
  nextToken=result.meta?.next_token;
  if(!nextToken)break;
 }
 // Only write after every X search page succeeded.
 const fresh=unique([...existing,...admissions]);
 const queue=reviewUnique([...review,...reviewEntries]);
 write('data/inbox.json',fresh);
 write('data/review-queue.json',queue);
 write('data/discovery-report.json',{
  completedAt:new Date().toISOString(),source:'X API recent search',communityId:String(communityId),
  searchQuery:QUERY,pagesCap:Number(maxPages)||2,scanned,admitted,reviewed:toReview,rejected,
  newInInbox:fresh.length-existing.length,reviewQueue:queue.length,
  note:'A candidate is admitted only when X returns matching community_id and 20 distinct photo media.'
 });
 console.log('Discovery: scanned='+scanned+' admitted='+admitted+' review='+toReview+' rejected='+rejected);
 return {configured:true,scanned,admitted,toReview,rejected};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 runDiscovery({
  token:process.env.X_BEARER_TOKEN,
  communityId:process.env.X_COMMUNITY_ID||COMMUNITY_ID,
  maxPages:process.env.X_MAX_PAGES||2
 }).catch(error=>{console.error('Discovery failed (no archive changed):',error.message);process.exitCode=1});
}
