#!/usr/bin/env node
/**
 * TwentyX public discovery (no X API key, no login, no paid provider).
 *
 * Source discovery: publicly available ArtVision X community page + public X
 * hashtag search, with the FxEmbed open/public search as a secondary source.
 * Independent media inspection: FxEmbed's public single-post endpoint.
 *
 * Never infer 20 photos from a thumbnail collage. Publication needs the
 * #TwentyX hashtag and exactly 20 genuine images in one post.
 * Network failure cannot delete or replace gallery data.
 * Public X access can disappear: report that accurately, don't fake success.
 */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export const COMMUNITY_ID='1835009931231322257';
const COMMUNITY_URL='https://x.com/i/communities/'+COMMUNITY_ID;
const SEARCH_BASE='https://api.fxtwitter.com/2/search';
const STATUS_BASE='https://api.fxtwitter.com/2/status/';
const VX_BASE='https://api.vxtwitter.com/Twitter/status/';
const SEARCH_QUERIES=['#TwentyX','"PankyVT" "#TwentyX"','"Elyris" "#TwentyX"','from:ok__vision #TwentyX','from:PanksterVT #TwentyX','from:Elyris_Art #TwentyX'];
const MAX_POSTS=70;
const read=(p,fallback)=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):fallback;
const write=(p,v)=>{fs.mkdirSync(p.slice(0,p.lastIndexOf('/'))||'.',{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const unique=items=>[...new Set(items)];
const validHandle=s=>typeof s==='string'&&/^[A-Za-z0-9_]{1,15}$/.test(s);
const hasTag=s=>/(^|[^a-z0-9_])#twentyx\b/i.test(String(s||''));
const idFromUrl=url=>{
 try{
  const u=new URL(url);
  if(!['x.com','twitter.com','mobile.twitter.com'].includes(u.hostname.toLowerCase()))return null;
  const m=u.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{12,22})(?:\/|$)/);
  return m?{handle:m[1],id:m[2]}:null;
 }catch{return null}
};
const photoUrl=url=>{
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&u.hostname==='pbs.twimg.com'&&u.pathname.startsWith('/media/');
 }catch{return false}
};
export function checkStatus(status,source,communityId=COMMUNITY_ID){
 if(!status||typeof status!=='object')return {kind:'review',reason:'post-unavailable'};
 const id=String(status.id||''),handle=status.author?.screen_name||status.author?.username;
 const name=String(status.author?.name||'').trim();
 const text=String(status.text||status.raw_text?.text||'');
 if(!/^\d{12,22}$/.test(id)||!validHandle(handle)||!name)
   return {kind:'review',reason:'missing-post-identity',id};
 if(status.reposted_by||status.type==='retweet')
   return {kind:'reject',reason:'not-original-post',id};
 // Community ID may be absent from public embeds and is not an admission rule.
 // The hashtag and exact media count are the two requirements.
 const all=Array.isArray(status.media?.all)?status.media.all:status.media?.photos;
 if(!Array.isArray(all)||all.length!==20){
  // A free embed service can truncate media, so a short response is not
  // proof that the original X post contains fewer than twenty works.
  return {kind:'review',reason:'twenty-media-not-proven',id,handle,observed:Array.isArray(all)?all.length:null};
 }
 if(all.some(m=>m?.type!=='photo'||!photoUrl(m?.url)))
   return {kind:'review',reason:'incomplete-photo-media',id,handle};
 const urls=all.map(m=>m.url);
 if(new Set(urls).size!==20)
   return {kind:'review',reason:'duplicate-photo-urls',id,handle};
 if(!text)return {kind:'review',reason:'post-text-unavailable',id,handle};
 if(!hasTag(text))return {kind:'reject',reason:'missing-hashtag',id,handle};
 const date=new Date(status.created_timestamp?Number(status.created_timestamp)*1000:status.created_at);
 if(!Number.isFinite(date.valueOf()))
   return {kind:'review',reason:'invalid-post-date',id,handle};
 // The gallery was launched in November 2026; don't admit unrelated historical
 // uses of the same hashtag from years earlier.
 if(date < new Date('2026-11-01T00:00:00Z'))
   return {kind:'reject',reason:'before-exhibition-launch',id,handle};
 return {kind:'admit',reason:'verified-hashtag-and-20-original-photos',id,handle,
  record:{name:name.slice(0,100),postUrl:'https://x.com/'+handle+'/status/'+id,
   date:date.toISOString().slice(0,10),media:urls}};
}
async function jsonGet(url,timeout=18000){
 const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'TwentyXGallery/1.0 (+https://twentyx.artvision.today)'},signal:AbortSignal.timeout(timeout)});
 if(!r.ok)throw Error('HTTP '+r.status);
 const out=await r.json();
 if(out.code!==undefined&&Number(out.code)!==200)throw Error('API code '+out.code);
 return out;
}
async function discoverPublicBrowser(pageUrl,label,seen,notes){
 const {chromium}=await import('playwright');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1340,height:900},locale:'en-US'});
  const response=await page.goto(pageUrl,{waitUntil:'domcontentloaded',timeout:22000});
  await page.waitForTimeout(2400);
  const found=new Set();
  for(let n=0;n<5;n++){
   const links=await page.locator('a[href*="/status/"]').evaluateAll(list=>list.map(a=>a.href)).catch(()=>[]);
   for(const u of links){const hit=idFromUrl(u);if(hit)found.add(hit.id)}
   await page.mouse.wheel(0,1300);
   await page.waitForTimeout(900);
  }
  notes.push({source:label,status:response?.status()||null,postLinks:found.size,readable:found.size>0});
  for(const id of found)seen.set(id,{id,source:label==='community'?'confirmed-community-feed':'search-page'});
 }catch(e){notes.push({source:label,readable:false,error:String(e.message||e).slice(0,160)})}
 finally{await browser.close()}
}
async function searchFree(seen,notes){
 for(const q of SEARCH_QUERIES){
  try{
   const url=new URL(SEARCH_BASE);url.searchParams.set('q',q);
   url.searchParams.set('feed','latest');url.searchParams.set('count','80');
   let out;
   for(let attempt=0;attempt<3;attempt++){
    try{out=await jsonGet(url.toString());break}
    catch(error){
     if(attempt===2)throw error;
     await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)));
    }
   }
   const results=Array.isArray(out.results)?out.results:[];
   for(const item of results){
    if(!hasTag(item.text||item.raw_text?.text))continue;
    const id=String(item.id||'');
    if(/^\d{12,22}$/.test(id))seen.set(id,{id,source:seen.get(id)?.source||'free-search'});
   }
   notes.push({source:'FxEmbed search',query:q,returned:results.length,readable:true});
  }catch(e){notes.push({source:'FxEmbed search',query:q,readable:false,error:String(e.message||e).slice(0,140)})}
 }
}
function fromVx(record){
 const media=Array.isArray(record?.media_extended)&&record.media_extended.length?record.media_extended.map(x=>({
  type:x.type==='image'?'photo':x.type,
  url:x.url
 })):Array.isArray(record?.mediaURLs)?record.mediaURLs.map(url=>({
  type:photoUrl(url)?'photo':'video',url
 })):[];
 const id=String(record.tweetID||'');
 const hashtags=Array.isArray(record.hashtags)?record.hashtags:[];
 const text=String(record.text||'')+(hashtags.some(tag=>String(tag).toLowerCase()==='twentyx')?' #TwentyX':'');
 return {id,text,author:{name:record.user_name,screen_name:record.user_screen_name},
  created_timestamp:record.date_epoch,media:{all:media}};
}
async function publicPostLookup(id){
 let fx=null;
 try{fx=(await jsonGet(STATUS_BASE+id)).status}catch{}
 if(fx && checkStatus(fx,'free-search').kind==='admit')return fx;
 try{
  const vx=fromVx(await jsonGet(VX_BASE+id));
  if(checkStatus(vx,'free-search').kind==='admit')return vx;
  if(!fx)return vx;
 }catch{}
 if(!fx)throw Error('Public post lookups unavailable on FxEmbed and VxTwitter');
 return fx;
}
export async function run({useBrowser=true,fetchStatus=publicPostLookup}={}){
 const notes=[],seen=new Map();
 const archived=read('data/collections.json',[]);
 const inbox=read('data/inbox.json',[]);
 const pending=read('data/pending-exhibitions.json',{candidates:[]});
 if(!Array.isArray(archived)||!Array.isArray(inbox))throw Error('Invalid published data; refusing discovery');
 const known=new Set([...archived,...inbox].map(a=>idFromUrl(a.postUrl)?.id).filter(Boolean));
 if(useBrowser){
  await discoverPublicBrowser(COMMUNITY_URL,'community',seen,notes);
  await discoverPublicBrowser('https://x.com/search?q=%23TwentyX&f=live','X hashtag search',seen,notes);
 }
 await searchFree(seen,notes);
 for(const item of pending.candidates||[]){
  const hit=idFromUrl(item.postUrlCandidate);
  if(hit&&!seen.has(hit.id))seen.set(hit.id,{id:hit.id,source:'known-candidate'});
 }
 const review=read('data/review-queue.json',[]);
 const outcomes=[],accepted=[];
 const jobs=[...seen.values()].filter(x=>!known.has(x.id)).slice(0,MAX_POSTS);
 for(const candidate of jobs){
  try{
   const status=await fetchStatus(candidate.id);
   const result=checkStatus(status,candidate.source);
   outcomes.push({id:candidate.id,handle:result.handle||null,kind:result.kind,reason:result.reason,
     observed:result.observed??null,source:candidate.source});
   if(result.kind==='admit')accepted.push(result.record);
  }catch(e){outcomes.push({id:candidate.id,kind:'review',reason:'lookup-unavailable',error:String(e.message||e).slice(0,130),source:candidate.source})}
 }
 const merged=new Map(inbox.map(a=>[idFromUrl(a.postUrl)?.id,a]).filter(([id])=>id));
 for(const x of accepted)merged.set(idFromUrl(x.postUrl).id,x);
 const queue=new Map((Array.isArray(review)?review:[]).map(x=>[String(x.id),x]));
 for(const x of outcomes)if(x.kind==='review')queue.set(x.id,x);else queue.delete(x.id);
 // Public discovery can fail. Commit only findings, never shrink the archive.
 write('data/inbox.json',[...merged.values()]);
 write('data/review-queue.json',[...queue.values()].slice(-250));
 const report={completedAt:new Date().toISOString(),method:'public-web+FxEmbed (no paid X API)',
  knownExhibitions:archived.length,candidatesFound:seen.size,checked:jobs.length,admitted:accepted.length,
  sourceChecks:notes,results:outcomes,
  caveat:'No result does not prove no eligible X posts. Public community/search access may be restricted.'};
 write('data/discovery-free-report.json',report);
 console.log('TWENTYX FREE SCAN '+JSON.stringify({candidates:seen.size,checked:jobs.length,newExhibitions:accepted.length,sources:notes.map(n=>({source:n.source,readable:n.readable,posts:n.postLinks??n.returned??0,error:n.error||null}))}));
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 run({useBrowser:process.env.TWENTYX_SKIP_BROWSER!=='1'}).catch(e=>{console.error('Free collector error: '+e.message);process.exitCode=1});
}
