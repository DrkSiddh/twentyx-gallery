'use strict';
/* TwentyX • Gallery interface. No AI touches the published archive at runtime. */
const $=selector=>document.querySelector(selector);
const byId=id=>document.getElementById(id);
const create=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
};
const POSTS='https://x.com/i/communities/1835009931231322257';
const CANONICAL='https://twentyx.artvision.today/';
// Twelve distinct featured exhibitions; chronologically sorted at display time.
const PINNED=['skelevaggio','stunnifer','pepavaggio','giselxphoto','hplovebux','artxygenishim','exolorian','jjjjere','ctwlk','turonworld','allthebots','nikdraperivey'];
// Curatorial affinities describe the visual presentation, never an artist's tools
// or materials. An artist can appear in multiple rooms without duplicating work.
const CURATION_TABS=[
 {id:'postphotography',name:'#Postphotography',description:'Photography beyond the photograph: staged, recomposed, imagined and transformed image-worlds.',handles:['turonworld','skelevaggio','stunnifer','ctwlk','pepavaggio','giselxphoto','exolorian','jjjjere','allthebots','ciphervoss']},
 {id:'sketchbook',name:'Sketchbook Aesthetic',description:'The intimacy of the page, a line, a gesture, a thought in the making. No assumption about physical or digital process.',handles:['_amaka_o','iridescent_bug','andyybzyy','lovecolors4','hplovebux','dylanbrion71545']},
 {id:'illustrated',name:'Illustrated',description:'Distinctive narrative and image-making through form, graphic imagination and character.',handles:['artxygenishim','nikdraperivey','ink_relic','andyybzyy','periblitzv2','bwizzyart']},
 {id:'anime',name:'Anime',description:'Anime- and manga-influenced visual worlds, given their own dedicated viewing room.',handles:['mheenam_lily7','nikkiyaki_','jellitix','yenaarteng','spalienart','elyris_art','mintshiiii','ayyzirly']},
 {id:'other',name:'Other Visions',description:'Artistic approaches that deserve room without a forced style label.',handles:[]},
 {id:'all',name:'All Exhibitions',description:'The complete evolving archive. All visual languages together, newest first.',handles:[]}
];
const CURATED_HANDLES=new Set(CURATION_TABS.filter(t=>!['other','all'].includes(t.id)).flatMap(t=>t.handles));
let activeCuration='postphotography';
function inCuration(a,id){
 const handle=artistHandle(a).toLowerCase();
 if(id==='all')return true;
 if(id==='other')return !CURATED_HANDLES.has(handle);
 const tab=CURATION_TABS.find(t=>t.id===id);
 return Boolean(tab&&tab.handles.includes(handle));
}
function curationArtists(id=activeCuration,list=artists){return sortArtists(list.filter(a=>inCuration(a,id)))}
function renderCurationTabs(){
 const root=byId('curation-tabs');if(!root)return;
 if(!root.childElementCount){
  CURATION_TABS.forEach(tab=>{
   const item=button('', 'curation-tab',()=>{
    activeCuration=tab.id;
    byId('search').value='';
    renderHome();
   });
   item.type='button';
   item.dataset.curation=tab.id;
   item.setAttribute('role','tab');
   const label=create('span','curation-tab-name',tab.name);
   const count=create('span','curation-tab-count','0');
   item.append(label,count);
   root.append(item);
  });
 }
 root.querySelectorAll('[data-curation]').forEach(item=>{
  const id=item.dataset.curation;
  const active=id===activeCuration;
  item.classList.toggle('active',active);
  item.setAttribute('aria-selected',String(active));
  item.tabIndex=0; // Every curation remains reachable via keyboard Tab.
  item.querySelector('.curation-tab-count').textContent=String(curationArtists(id).length);
 });
 const selected=CURATION_TABS.find(tab=>tab.id===activeCuration);
 byId('curation-description').textContent=selected?selected.description:'';
}

const THEME_IDS=['violet','analog','heritage','nostalgia','glitch'];
const FEATURE_HOUR_MS=3600000;
let lastFeatureHour=null,currentTheme='violet',pendingXUrl='';
let artists=[];
let currentArtist=null;
let spatialIndex=0;
let viewerArtists=[];
let viewerArtistIndex=0;
let viewerWorkIndex=0;
let timer=null;
let lastFocus=null;
let wallMode='wall';
let selection=new Set();
let featuredArtist=null,featuredIndex=0;
let arrivalArtist=null,arrivalWorkIndex=0,arrivalSignature='';
let seedRecoverySource='embedded JSON';
let cinemaNativeFullscreen=false;
let cinemaFadeTimer=null;
let cardRevealObserver=null;
const prefersReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const help={
  about:['What is TwentyX?','TwentyX Presented By ArtVision is a multidimensional self-evolving art exhibition. Every artist curates twenty works of art on X. Enter their solo exhibitions, experience the work in multiple dimensions, and follow the artists who made it.'],
  updates:['When does the gallery update?','TwentyX introduces newly curated exhibitions at 6:00 AM and 6:00 PM Pacific Time. Return to discover new artists and explore their twenty works.'],
  join:['How to participate','Your post must contain exactly 20 artworks to appear in TwentyX. Posts containing 1–19 are not eligible. Twenty is the maximum number allowed in a single X post. Include #TwentyX and share your work with ArtVision on X; each complete exhibition is verified before inclusion.'],
  browse:['Exploring the exhibition','Select an artist to view all twenty works on a full-width exhibition wall, or switch to the spatial carousel. Use Surprise me for a chance encounter. The slideshow studio lets you select any combination of artists, or play the entire gallery.'],
  qr:['What does the exhibition brochure do?','Download an artist-curated TwentyX exhibition brochure with twenty works, a curatorial credit and a scannable QR code. The full-size PNG is preferred, with an instantly downloadable vector edition as a fallback.'],
  spatial:['About the spatial carousel','A cinematic, three-panel perspective viewer. The original two-dimensional artworks remain unchanged. Use Previous or Next to cycle through all twenty; click the center image to enter the immersive viewer.'],
  cinema:['Cinematic slideshow controls','The fullscreen cinema shows one artwork at a time, without a thumbnail strip covering it. Use left/right arrows or swipe to change works, and up/down to switch artists. Space pauses or plays, and Escape exits. The spatial carousel remains the interactive three-dimensional viewing mode.']
};
function parsePost(url){
 try{
  const u=new URL(url);const m=u.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)\/?$/);
  return ['x.com','twitter.com'].includes(u.hostname.toLowerCase())&&m?{handle:m[1],id:m[2]}:null;
 }catch{return null;}
}
function valid(a){
 const p=parsePost(a&&a.postUrl);
 if(!p||typeof a.name!=='string'||!a.name.trim()||!Array.isArray(a.media)||a.media.length!==20||new Set(a.media).size!==20)return false;
 return a.media.every(url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='pbs.twimg.com'&&u.pathname.startsWith('/media/')}catch{return false}});
}
function sortArtists(list){
 // Newly posted exhibitions lead; feature curation remains independent.
 return [...list].sort((a,b)=>artistID(b).localeCompare(artistID(a)));
}
function artistID(a){return parsePost(a.postUrl).id}
function artistHandle(a){return parsePost(a.postUrl).handle}
function artistX(a){return 'https://x.com/'+artistHandle(a)}
function followIntent(a){return 'https://twitter.com/intent/follow?screen_name='+encodeURIComponent(artistHandle(a))}
function openXAction(mode,artist){
 pendingXUrl=mode==='follow'?followIntent(artist):POSTS;
 const follow=mode==='follow';
 byId('x-action-title').textContent=follow?'Follow @'+artistHandle(artist)+' on X':'Enter the ArtVision community.';
 byId('x-action-copy').textContent=follow
  ?'Follow @'+artistHandle(artist)+' on X, then come right back to this exhibition. Following is authorized on X.'
  :'join the artVision community and post twenty images with the hashtag #TwentyX to join this exhibition.';
 byId('x-action-continue').textContent=follow?'Follow on X ↗':'Join ArtVision on X ↗';
 byId('x-action-guide').hidden=follow;
 if(!byId('x-action-modal').open)byId('x-action-modal').showModal();
}
function openPendingX(){
 if(!pendingXUrl)return;
 const width=640,height=790;
 const left=Math.max(0,Math.round((window.screen.width-width)/2));
 const top=Math.max(0,Math.round((window.screen.height-height)/2));
 const popup=window.open(pendingXUrl,'twentyx_x_action','popup=yes,width='+width+',height='+height+',left='+left+',top='+top);
 if(!popup)window.open(pendingXUrl,'_blank','noopener,noreferrer');
}
function popFollow(event){
 const a=event.target.closest('a[data-follow]');if(!a)return;
 event.preventDefault();
 const handle=new URL(a.href).searchParams.get('screen_name');
 const artist=artists.find(a=>artistHandle(a).toLowerCase()===String(handle||'').toLowerCase());
 if(artist)openXAction('follow',artist);
}
function artistPath(a){return '/@'+artistHandle(a).toLowerCase()+'/'}
function artistURL(a){return CANONICAL+'@'+artistHandle(a).toLowerCase()+'/'}
function link(label,url,className){
 const a=create('a',className,label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;
}
function button(label,className,callback){
 const b=create('button',className,label);b.type='button';b.addEventListener('click',callback);return b;
}
function setDayPhase(){
 const now=new Date(),hour=now.getHours(),minute=now.getMinutes();
 const clock=hour*60+minute;
 // Local wall-clock time; 4:20 PM through the end of 4:43 PM.
 const phase=clock>=16*60+20&&clock<16*60+44?'green':hour>=5&&hour<10?'daybreak':hour>=10&&hour<17?'day':hour>=17&&hour<21?'sunset':'night';
 document.body.dataset.phase=phase;
}

/* Art-responsive atmosphere: sample the actual displayed X image when CORS
   permits; otherwise sample this artist's SAME-ORIGIN brochure collage made
   exclusively from their twenty authentic images. No fake colors or uploads. */
let paletteRequest=0;
const artworkPaletteCache=new Map();
function extractArtworkColors(rgba,width,height){
 const bins=new Map();
 for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){
  const p=(y*width+x)*4;
  if(rgba[p+3]<224)continue;
  const rgb=[rgba[p],rgba[p+1],rgba[p+2]];
  const max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;
  const saturation=max?delta/max:0;
  const luminance=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)/255;
  if(luminance<.10||luminance>.96||saturation<.11)continue;
  // Edges matter: a yellow painted canvas rim should warm the page.
  const edge=x<width*.17||x>width*.83||y<height*.17||y>height*.83;
  const weight=(edge?4:1)*(0.35+saturation*2.4);
  const key=rgb.map(v=>Math.floor(v/40)).join(':');
  let item=bins.get(key);if(!item){item={r:0,g:0,b:0,weight:0};bins.set(key,item)}
  item.r+=rgb[0]*weight;item.g+=rgb[1]*weight;item.b+=rgb[2]*weight;item.weight+=weight;
 }
 const sorted=[...bins.values()].sort((a,b)=>b.weight-a.weight);
 if(!sorted.length)return null;
 const colors=sorted.map(z=>[z.r,z.g,z.b].map(v=>Math.round(v/z.weight)));
 const edge=colors[0];
 const accent=colors.find((v,i)=>i>0&&Math.abs(v[0]-edge[0])+Math.abs(v[1]-edge[1])+Math.abs(v[2]-edge[2])>92)||edge;
 const asCSS=a=>'rgb('+a.join(' ')+')';
 return {edge:asCSS(edge),accent:asCSS(accent)};
}
function applyPaletteColors(colors){
 if(!colors)return;
 document.body.style.setProperty('--art-edge',colors.edge);
 document.body.style.setProperty('--art-accent',colors.accent);
 document.body.dataset.artColor='ready';
}
function artistBrochurePaletteUrl(artist){
 return artist?'/welcome/'+artistHandle(artist).toLowerCase()+'-'+artistID(artist)+'.png':null;
}
function sampleArtworkPalette(source,token,fallback,phase=0){
 if(!source||token!==paletteRequest)return;
 if(artworkPaletteCache.has(source)){
  applyPaletteColors(artworkPaletteCache.get(source));return;
 }
 const image=new Image();
 image.crossOrigin='anonymous';
 image.onload=()=>{
  if(token!==paletteRequest)return;
  try{
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)return;
   canvas.width=48;canvas.height=48;
   ctx.drawImage(image,0,0,48,48);
   const rgba=ctx.getImageData(0,0,48,48);
   const colors=extractArtworkColors(rgba.data,48,48);
   if(!colors)throw Error('No useful artwork color sample');
   artworkPaletteCache.set(source,colors);
   applyPaletteColors(colors);
  }catch(e){
   if(!phase&&fallback&&source!==fallback)sampleArtworkPalette(fallback,token,null,1);
  }
 };
 image.onerror=()=>{
  if(token===paletteRequest&&!phase&&fallback&&source!==fallback)sampleArtworkPalette(fallback,token,null,1);
 };
 try{
  const url=new URL(source,location.origin);
  if(url.hostname==='pbs.twimg.com')url.searchParams.set('name','small');
  image.src=url.href;
 }catch{
  if(!phase&&fallback)sampleArtworkPalette(fallback,token,null,1);
 }
}
function colorFromArtwork(source,artist){
 if(!source)return;
 const token=++paletteRequest;
 const fallback=artistBrochurePaletteUrl(artist);
 sampleArtworkPalette(source,token,fallback);
}
function setThemeDock(open){
 const dock=byId('theme-dock');
 dock.dataset.open=String(Boolean(open));
 byId('theme-dock-tab').setAttribute('aria-expanded',String(Boolean(open)));
 byId('theme-dock-tab').setAttribute('aria-label',open?'Collapse exhibition themes':'Open exhibition themes');
 byId('theme-dock-panel').setAttribute('aria-hidden',String(!open));
 if('inert' in byId('theme-dock-panel'))byId('theme-dock-panel').inert=!open;
 if(open)byId('theme-select').focus();else byId('theme-dock-tab').focus();
}
function setTheme(theme){
 if(!THEME_IDS.includes(theme))theme='violet';
 currentTheme=theme;
 document.body.dataset.theme=theme;
 byId('theme-select').value=theme;
 try{window.localStorage.setItem('twentyx-theme-v1',theme)}catch{}
 // Artwork palette is independent of theme selection, so a chosen theme is
 // never silently overwritten by palette extraction.
 if(byId('theme-dock').dataset.open==='true')setThemeDock(false);
}
function showGuide(section='ideas'){
 const guide=byId('guide-drawer');
 const selected=['ideas','faq','terms'].includes(section)?section:'ideas';
 guide.querySelectorAll('[data-guide-tab]').forEach(tab=>{
  const active=tab.dataset.guideTab===selected;
  tab.classList.toggle('active',active);
  tab.setAttribute('aria-selected',String(active));
 });
 guide.querySelectorAll('[data-guide-panel]').forEach(panel=>{
  panel.hidden=panel.dataset.guidePanel!==selected;
 });
 if(!guide.open)guide.showModal();
}
function initializeTheme(){
 let choice='violet';
 try{choice=window.localStorage.getItem('twentyx-theme-v1')||'violet'}catch{}
 setTheme(choice);
}
function routeArtist(){
 const legacy=new URLSearchParams(location.search).get('artist');
 if(legacy)return legacy;
 const match=location.pathname.match(/^\/@([a-zA-Z0-9_]{1,15})(?:\/(?:index\.html)?)?$/i);
 if(!match)return null;
 const selected=artists.find(a=>artistHandle(a).toLowerCase()===match[1].toLowerCase());
 return selected?artistID(selected):null;
}
function goHome(){
 history.pushState(null,'','/');
 renderRoute();window.scrollTo({top:0,behavior:prefersReduced?'auto':'smooth'});
}
function goArtist(a){
 history.pushState(null,'',artistPath(a));
 renderRoute();window.scrollTo({top:0,behavior:prefersReduced?'auto':'smooth'});
}
function makeTile(a,i,className){
 const tile=button('',className||'artwork-thumb',()=>startCinema(artists,Math.max(0,artists.findIndex(x=>artistID(x)===artistID(a))),i,false));
 tile.dataset.n=String(i+1).padStart(2,'0');
 tile.setAttribute('aria-label','Open artwork '+(i+1)+' of 20 by '+a.name);
 const img=create('img');img.src=a.media[i];img.loading='lazy';img.decoding='async';
 img.alt='Artwork '+(i+1)+' of 20 by '+a.name;img.referrerPolicy='no-referrer';
 img.addEventListener('error',()=>{
  if(!img.dataset.retry){
   img.dataset.retry='1';
   try{const retry=new URL(a.media[i]);retry.searchParams.set('name','medium');img.src=retry.href;return}catch{}
  }
  const fallback=link('View work on X ↗',a.postUrl,'artwork-thumb artwork-unavailable');
  fallback.setAttribute('aria-label','Artwork '+(i+1)+' unavailable: open original X post');
  tile.replaceWith(fallback);
 });
 tile.append(img);return tile;
}

function newestArtist(){
 return [...artists].sort((a,b)=>artistID(b).localeCompare(artistID(a)))[0]||null;
}
function featureArtists(list=artists){
 // The edge-to-edge program is a deliberate twelve-artist curation:
 // visitors are never automatically dropped into the anime room.
 // Other artists remain fully available in tabs, search and slideshow.
 const highlighted=PINNED.map(handle=>list.find(a=>artistHandle(a).toLowerCase()===handle)).filter(Boolean);
 return highlighted.length?sortArtists(highlighted):sortArtists(list.filter(a=>artistHandle(a).toLowerCase()!=='ciphervoss'));
}
function featureHour(now=Date.now()){return Math.floor(now/FEATURE_HOUR_MS)}
function currentFeature(now=Date.now()){
 const lineup=featureArtists();
 if(!lineup.length)return null;
 const hour=featureHour(now);
 return {artist:lineup[hour%lineup.length],hour,lineup};
}
function renderFeatureTicker(){
 const state=currentFeature(),track=byId('feature-ticker-track');
 if(!track||!state)return;
 track.replaceChildren();
 const nextTime=new Date((state.hour+1)*FEATURE_HOUR_MS);
 const minutes=Math.max(1,Math.ceil(((state.hour+1)*FEATURE_HOUR_MS-Date.now())/60000));
 byId('feature-next-change').textContent='NEXT FEATURE IN '+minutes+' MIN · '+nextTime.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 for(let copy=0;copy<2;copy++){
  for(let offset=0;offset<Math.max(8,state.lineup.length);offset++){
   const artist=state.lineup[(state.hour+offset)%state.lineup.length];
   const label=create('span','ticker-entry');
   if(offset===0)label.classList.add('on-now');
   const time=offset===0?'NOW':new Date((state.hour+offset)*FEATURE_HOUR_MS).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
   const timeSpan=create('b','ticker-time',time);
   const handleSpan=create('span','ticker-artist','@'+artistHandle(artist));
   label.append(timeSpan,handleSpan);
   if(copy)label.setAttribute('aria-hidden','true');
   track.append(label);
  }
 }
}
let featuredArtistsSignature='';

/* Landscape eligibility is determined using each original image's actual dimensions. */
async function renderArrivalImage(){
 const featured=featureArtists();
 const day=Math.floor(Date.now()/86400000),signature=day+':'+featured.map(artistID).join(',');
 if(!featured.length||arrivalSignature===signature)return;
 arrivalSignature=signature;
 const probeWork=c=>new Promise((resolve,reject)=>{
  const img=new Image();
  const timeout=window.setTimeout(()=>{img.onload=null;img.onerror=null;reject(Error('Image timeout'))},2200);
  img.referrerPolicy='no-referrer';
  img.onload=()=>{clearTimeout(timeout);img.naturalWidth>img.naturalHeight*1.1&&img.naturalWidth>=640?resolve(c):reject(Error('Not landscape'))};
  img.onerror=()=>{clearTimeout(timeout);reject(Error('Image unavailable'))};
  img.src=c.artist.media[c.index];
 });
 for(let offset=0;offset<20;offset++){
  const batch=featured.map((a,j)=>({artist:a,index:(offset+day+j*3)%20}));
  const selected=await Promise.any(batch.map(probeWork)).catch(()=>null);
  if(arrivalSignature!==signature)return;
  if(!selected)continue;
  arrivalArtist=selected.artist;arrivalWorkIndex=selected.index;
  const image=byId('arrival-image-img');
  image.src=selected.artist.media[selected.index];
  image.referrerPolicy='no-referrer';
  image.alt='Landscape artwork '+(selected.index+1)+' of 20 curated by '+selected.artist.name;
  byId('arrival-name').textContent=selected.artist.name+' · Work '+String(selected.index+1).padStart(2,'0')+' / 20';
  byId('arrival-image').hidden=document.body.dataset.view==='artist';
  colorFromArtwork(image.src,selected.artist);
  return;
 }
}

/** Twelve newest-first featured artist exhibitions with the exact original twenty works. */
function renderFeaturedArtists(){
 const gallery=byId('featured-six-gallery');if(!gallery)return;
 const highlighted=featureArtists();
 const signature=highlighted.map(a=>artistID(a)).join(',');
 if(signature===featuredArtistsSignature&&gallery.children.length===highlighted.length)return;
 featuredArtistsSignature=signature;
 gallery.replaceChildren();
 highlighted.forEach((a,index)=>{
  const tile=button('','featured-six-card',()=>goArtist(a));
  const handle=artistHandle(a).toLowerCase();
  tile.setAttribute('aria-label','Enter '+a.name+'—twenty original artworks by @'+handle);
  const artwork=create('span','featured-six-art');
  const src=a.media[0];
  setArtBackdrop(artwork,src);
  const img=create('img');
  img.src=src;img.alt='Original artwork from @'+handle+' exhibition, presented without cropping';
  img.loading=index<3?'eager':'lazy';img.decoding='async';img.referrerPolicy='no-referrer';
  artwork.append(img);
  const label=create('span','featured-six-label');
  const displayName=handle==='ctwlk'?'CTWLK XR · @ctwlk':a.name;
  const order=create('span','featured-six-number',String(index+1).padStart(2,'0')+' / '+String(highlighted.length).padStart(2,'0'));
  label.append(order,create('strong','featured-six-name',displayName),create('span','featured-six-arrow','↗'));
  const explore=create('span','featured-six-cta','Explore the 20 ↗');
  explore.setAttribute('aria-hidden','true');
  tile.append(artwork,explore,label);
  gallery.append(tile);
 });
}

/** A living arrival list, never stale hard-coded names or invented additions. */
let arrivalsSignature='';
function renderNewArrivals(){
 const root=byId('arrival-links');
 if(!root)return;
 const newest=sortArtists(artists).slice(0,6);
 const signature=newest.map(artistID).join(',');
 if(signature===arrivalsSignature&&root.childElementCount===newest.length)return;
 arrivalsSignature=signature;root.replaceChildren();
 const label=byId('arrival-curations-count');
 if(label)label.textContent='JUST ADDED · '+(newest.length*20)+' ARTWORKS';
 newest.forEach(a=>{
  const aLink=link(a.name+' ↗',artistPath(a),'');
  aLink.className='arrival-curation-link';
  aLink.addEventListener('click',event=>{event.preventDefault();goArtist(a)});
  root.append(aLink);
 });
}

/** The backdrop is always sampled from the identical original art, never a stock fill. */
function setArtBackdrop(surface,imageUrl){
 if(!surface||!imageUrl)return;
 surface.style.setProperty('--artwork-source','url("'+String(imageUrl).replace(/["\\]/g,'')+'")');
}
function featureWork(next=false){
 const state=currentFeature();
 if(!state)return;
 renderFeaturedArtists();
 renderNewArrivals();
 renderFeatureTicker();
 const selected=state.artist;
 const artistChanged=!featuredArtist||artistID(featuredArtist)!==artistID(selected)||lastFeatureHour!==state.hour;
 if(!next&&!artistChanged)return;
 featuredArtist=selected;lastFeatureHour=state.hour;
 if(artistChanged)featuredIndex=(state.hour*7+Number(artistID(selected).slice(-2)))%20;
 else if(next)featuredIndex=(featuredIndex+1+Math.floor(Math.random()*19))%20;
 const img=byId('feature-image');
 if(!img)return;
 img.classList.add('change');
 const src=featuredArtist.media[featuredIndex];
 const reveal=()=>{
  img.src=src;
  setArtBackdrop(byId('feature-artwork'),src);
  img.alt='Featured work '+(featuredIndex+1)+' of 20 curated by '+featuredArtist.name;
  byId('feature-number').textContent=String(featuredIndex+1).padStart(2,'0')+' / 20';
  byId('feature-title').textContent=featuredArtist.name;
  fitArtistHeadlines();
  byId('feature-subline').textContent='20 original artworks';
  if(document.body.dataset.view!=='artist'&&!byId('cinema').classList.contains('active'))colorFromArtwork(src,featuredArtist);
  img.classList.remove('change');
 };
 if(prefersReduced||!next)reveal();else window.setTimeout(reveal,220);
}

/** Preserve a single-word artist moniker on one line at any viewport size. */
function fitArtistHeadlines(){
 const definitions=[['feature-title',114,26],['artist-title',172,30]];
 for(const [id,maximum,minimum] of definitions){
  const heading=byId(id);
  if(!heading)continue;
  const name=heading.textContent.trim();
  const oneWord=Boolean(name)&&!/\s/.test(name);
  heading.classList.toggle('single-moniker',oneWord);
  heading.style.removeProperty('font-size');
  if(!oneWord)continue;
  // Hidden pages and the jsdom test environment have no measurable width;
  // CSS nowrap is the reliable fallback in those situations.
  const available=heading.clientWidth;
  if(available<30)continue;
  let size=Math.min(maximum,Math.max(minimum,window.innerWidth*(id==='feature-title'?.085:.11)));
  heading.style.fontSize=size+'px';
  while(size>minimum && heading.scrollWidth>heading.clientWidth+1){
   size=Math.max(minimum,size-2);
   heading.style.fontSize=size+'px';
  }
 }
}
function scheduleHeadlineFit(){
 fitArtistHeadlines();
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitArtistHeadlines).catch(()=>{});
}
function revealCards(root=document){
 if(prefersReduced||typeof IntersectionObserver!=='function')return;
 if(!cardRevealObserver){
  cardRevealObserver=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(!entry.isIntersecting)continue;
    entry.target.classList.add('art-entered');
    cardRevealObserver.unobserve(entry.target);
   }
  },{threshold:.13,rootMargin:'0px 0px 35px 0px'});
 }
 root.querySelectorAll('.collection-card,.artist-wall .artwork-thumb').forEach((el,index)=>{
  el.style.animationDelay=(index%9*65)+'ms';
  cardRevealObserver.observe(el);
 });
}

function sourceArtistsFromArtworkDOM(){
 // Independent fallback: the initial HTML itself contains twenty images per artist.
 const result=[];
 document.querySelectorAll('#home-gallery .collection-card').forEach(card=>{
  const name=card.querySelector('.card-name')?.textContent?.trim();
  const postUrl=card.querySelector('.card-footer a[href*="/status/"]')?.href;
  const date=card.querySelector('.card-date')?.textContent?.trim();
  const media=[...card.querySelectorAll('.card-mosaic img')].map(img=>img.getAttribute('src')).filter(Boolean);
  const record={name,postUrl,date,media};
  if(valid(record))result.push(record);
 });
 return sortArtists(result);
}
function curationDate(a){
 const [year,month,day]=String(a.date||'').split('-');
 return year&&month&&day?day+' '+month+' '+year+' curation':'Artist curation';
}
function attachCardTilt(root){
 if(root.dataset.tiltBound)return;
 root.dataset.tiltBound='true';
 const reset=card=>{
  if(!card)return;
  card.style.setProperty('--tilt-x','0deg');
  card.style.setProperty('--tilt-y','0deg');
  card.style.setProperty('--shine-x','50%');
  card.style.setProperty('--shine-y','50%');
 };
 root.addEventListener('pointermove',e=>{
  if(prefersReduced||e.pointerType==='touch'||!window.matchMedia('(hover:hover)').matches)return;
  const card=e.target.closest?.('.collection-card');
  if(!card)return;
  const box=card.getBoundingClientRect();
  if(!box.width||!box.height)return;
  const x=(e.clientX-box.left)/box.width-.5;
  const y=(e.clientY-box.top)/box.height-.5;
  card.style.setProperty('--tilt-x',(-y*4).toFixed(2)+'deg');
  card.style.setProperty('--tilt-y',(x*5).toFixed(2)+'deg');
  card.style.setProperty('--shine-x',((x+.5)*100).toFixed(1)+'%');
  card.style.setProperty('--shine-y',((y+.5)*100).toFixed(1)+'%');
 });
 root.addEventListener('pointerout',e=>{
  const card=e.target.closest?.('.collection-card');
  if(card&&!card.contains(e.relatedTarget))reset(card);
 });
 root.addEventListener('focusout',e=>{
  const card=e.target.closest?.('.collection-card');
  if(card&&!card.contains(e.relatedTarget))reset(card);
 });
}
function renderHome(){
 renderCurationTabs();
 const q=byId('search').value.trim().toLowerCase();
 // A typed artist search intentionally searches the full archive, regardless of tab.
 const shown=q
  ?sortArtists(artists.filter(a=>(a.name+' '+artistHandle(a)).toLowerCase().includes(q)))
  :curationArtists();
 const root=byId('home-gallery');root.replaceChildren();
 shown.forEach((a,index)=>{
  const card=create('article','collection-card');card.id='artist-'+artistID(a);card.dataset.artistHandle=artistHandle(a).toLowerCase();
  const grid=create('div','card-mosaic');
  a.media.forEach((_,i)=>grid.append(makeTile(a,i)));
  card.append(grid);
  // The gallery image begins at the very top; the main action stays in
  // its upper-right corner rather than following the entire image wall.
  /* Featured artist works carry the Explore the 20 artwork overlay. */
  const head=create('div','card-meta');
  head.append(create('span','collection-sequence',String(index+1).padStart(2,'0')+' / '+String(shown.length).padStart(2,'0')));
  const titleWrap=create('div','card-heading');
  const title=create('h3','card-name');title.append(button(a.name,'artist-name-link',()=>goArtist(a)));titleWrap.append(title);
  const labels=create('div','card-labels');
  labels.append(create('div','card-handle','@'+artistHandle(a)+' on X'));
  labels.append(create('span','card-count','20 works'));
  titleWrap.append(labels);
  head.append(titleWrap);
  card.append(head);
  const actions=create('div','card-footer');
  const date=create('span','card-date',curationDate(a));
  actions.append(date);
  const links=create('div','card-link-actions');
  const follow=link('Follow on X ↗',followIntent(a),'pill primary');follow.dataset.follow='true';links.append(follow);
  links.append(link('Original post ↗',a.postUrl,'ghost'));
  actions.append(links);
  card.append(actions);root.append(card);
 });
 if(!shown.length)root.append(create('div','empty','No artists match this search. Try another name or handle.'));
 const label=q?'Search results':CURATION_TABS.find(tab=>tab.id===activeCuration).name;
 byId('home-status').textContent=shown.length+' exhibitions · '+label+' · Newest first · 20 works each';
 attachCardTilt(root);
 revealCards(root);
}
function changeMode(mode){
 if(mode!=='wall'&&mode!=='spatial')return;
 wallMode=mode;
 const isWall=mode==='wall';
 const wall=byId('artist-wall'),stage=byId('spatial-stage');
 // Explicit hidden state works with the high-priority masonry CSS.
 wall.hidden=!isWall;stage.hidden=isWall;
 wall.setAttribute('aria-hidden',String(!isWall));
 stage.setAttribute('aria-hidden',String(isWall));
 byId('wall-mode').classList.toggle('active',isWall);
 byId('spatial-mode').classList.toggle('active',!isWall);
 byId('wall-mode').setAttribute('aria-pressed',String(isWall));
 byId('spatial-mode').setAttribute('aria-pressed',String(!isWall));
 if(!isWall)renderSpatial();
}
function renderSpatial(){
 if(!currentArtist)return;
 const n=currentArtist.media.length;
 for(const imageId of ['stage-main','stage-left','stage-right']){
  byId(imageId).referrerPolicy='no-referrer';
 }
 byId('stage-main').src=currentArtist.media[spatialIndex];
 colorFromArtwork(currentArtist.media[spatialIndex],currentArtist);
 setArtBackdrop(byId('spatial-current'),currentArtist.media[spatialIndex]);
 byId('stage-main').alt='Artwork '+(spatialIndex+1)+' of 20 by '+currentArtist.name;
 byId('stage-left').src=currentArtist.media[(spatialIndex+n-1)%n];
 byId('stage-right').src=currentArtist.media[(spatialIndex+1)%n];
 setArtBackdrop(byId('spatial-prev'),currentArtist.media[(spatialIndex+n-1)%n]);
 setArtBackdrop(byId('spatial-next'),currentArtist.media[(spatialIndex+1)%n]);
 byId('stage-counter').textContent=String(spatialIndex+1).padStart(2,'0')+' / 20';
 const dots=byId('stage-dots');dots.replaceChildren();
 for(let i=0;i<n;i++){
  const dot=button('','',()=>{spatialIndex=i;renderSpatial()});
  dot.setAttribute('aria-label','View work '+(i+1));
  if(i===spatialIndex)dot.classList.add('active');
  dots.append(dot);
 }
}
function moveSpatial(delta){spatialIndex=(spatialIndex+delta+20)%20;renderSpatial()}
function renderArtist(a){
 currentArtist=a;
 document.title=a.name+' • TwentyX Gallery';
 colorFromArtwork(a.media[0],a);
 byId('artist-title').textContent=a.name;
 fitArtistHeadlines();
 byId('artist-handle').textContent='@'+artistHandle(a)+' on X · 20 works';
 byId('artist-date').textContent=curationDate(a);
 byId('follow-link').href=followIntent(a);byId('follow-link').dataset.follow='true';
 byId('original-link').href=a.postUrl;
 const wall=byId('artist-wall');wall.replaceChildren();
 a.media.forEach((_,i)=>wall.append(makeTile(a,i)));
 revealCards(wall);
 spatialIndex=0;
 changeMode('wall');
 const index=artists.findIndex(item=>artistID(item)===artistID(a));
 const prev=artists[(index+artists.length-1)%artists.length];
 const next=artists[(index+1)%artists.length];
 byId('previous-artist').textContent='← '+prev.name;
 byId('next-artist').textContent=next.name+' →';
 byId('previous-artist').onclick=()=>goArtist(prev);
 byId('next-artist').onclick=()=>goArtist(next);
 byId('copy-artist').onclick=()=>copyLink(artistURL(a),byId('copy-artist'));
 byId('download-qr').onclick=()=>downloadPoster(a,byId('download-qr'));
 byId('play-artist').onclick=()=>startCinema(artists,Math.max(0,artists.findIndex(x=>artistID(x)===artistID(a))),0,true);
}
function renderRoute(){
 const id=routeArtist(),match=artists.find(a=>artistID(a)===id);
 const onArtist=Boolean(match);
 byId('home-view').hidden=onArtist;
 byId('artist-view').hidden=!onArtist;
 document.body.dataset.view=onArtist?'artist':'home';
 byId('featured-six').hidden=onArtist;
 byId('arrival-image').hidden=onArtist||!arrivalArtist;
 if(onArtist)renderArtist(match);
 else{
  currentArtist=null;document.title='TwentyX • ArtVision X';
  renderHome();
  if(!byId('cinema').classList.contains('active')&&featuredArtist)colorFromArtwork(featuredArtist.media[featuredIndex],featuredArtist);
 }
}
function openHelp(key){
 const data=help[key]||help.about;
 byId('help-title').textContent=data[0];byId('help-body').replaceChildren(create('p','',data[1]));
 if(!byId('help-modal').open)byId('help-modal').showModal();
}
function makeChecklist(){
 selection=new Set(artists.map(artistID));
 const list=byId('artist-checklist');list.replaceChildren();
 artists.forEach(a=>{
  const label=create('label','checkartist'),check=create('input');
  check.type='checkbox';check.value=artistID(a);check.checked=true;
  check.addEventListener('change',()=>{if(check.checked)selection.add(check.value);else selection.delete(check.value);updateSelectionCount()});
  const body=create('span');body.append(create('b','',a.name),create('small','','@'+artistHandle(a)+' • 20 works'));
  label.append(check,body);list.append(label);
 });
 updateSelectionCount();
}
function updateSelectionCount(){
 byId('selection-count').textContent=selection.size+' artist'+(selection.size===1?'':'s')+' selected';
 byId('launch-selection').disabled=selection.size===0;
}
function selectAll(checked){
 const boxes=byId('artist-checklist').querySelectorAll('input');
 boxes.forEach(box=>{box.checked=checked});
 selection=checked?new Set(artists.map(artistID)):new Set();
 updateSelectionCount();
}
function showCinema(fullscreen=false){
 const c=byId('cinema');
 c.classList.add('active');
 c.setAttribute('aria-hidden','false');
 document.body.style.overflow='hidden';
 c.focus();
 // Only the explicitly chosen Fullscreen Show requests native fullscreen.
 // Artwork magnification stays in a centered, full-size gallery overlay.
 if(fullscreen && typeof c.requestFullscreen==='function'){
  try{
   Promise.resolve(c.requestFullscreen({navigationUI:'hide'}))
    .then(()=>{cinemaNativeFullscreen=Boolean(document.fullscreenElement)})
    .catch(()=>{cinemaNativeFullscreen=false});
  }catch{cinemaNativeFullscreen=false}
 }
}
function startCinema(list,artistIndex,artIndex,autoplay){
 if(!list.length)return;
 lastFocus=document.activeElement;
 viewerArtists=list.slice();viewerArtistIndex=artistIndex||0;viewerWorkIndex=artIndex||0;
 if(byId('selection-modal').open)byId('selection-modal').close();
 showCinema(Boolean(autoplay));renderCinema();setPlaying(Boolean(autoplay)&&!prefersReduced);
}
function renderCinema(){
 if(!viewerArtists.length)return;
 const a=viewerArtists[viewerArtistIndex];
 byId('cinema-artist').textContent=a.name;
 byId('cinema-follow').href=followIntent(a);byId('cinema-follow').dataset.follow='true';
 byId('cinema-progress').textContent='WORK '+String(viewerWorkIndex+1).padStart(2,'0')+' / 20 IN THIS CURATION';
 const image=byId('cinema-img');
 image.src=a.media[viewerWorkIndex];
 colorFromArtwork(a.media[viewerWorkIndex],a);
 setArtBackdrop(byId('cinema').querySelector('.cinema-viewport'),a.media[viewerWorkIndex]);
 image.alt='Artwork '+(viewerWorkIndex+1)+' of 20 by '+a.name;
 image.style.animation='none';void image.offsetWidth;image.style.animation='';
 // No thumbnail strip in cinema: the current artwork fills the entire stage.
}
function cinemaStep(delta){
 viewerWorkIndex+=delta;
 if(viewerWorkIndex>=20){viewerWorkIndex=0;viewerArtistIndex=(viewerArtistIndex+1)%viewerArtists.length}
 if(viewerWorkIndex<0){viewerWorkIndex=19;viewerArtistIndex=(viewerArtistIndex+viewerArtists.length-1)%viewerArtists.length}
 renderCinema();
}
function cinemaArtistStep(delta){
 viewerArtistIndex=(viewerArtistIndex+delta+viewerArtists.length)%viewerArtists.length;
 viewerWorkIndex=0;renderCinema();
}
function hideCinemaControls(){
 const cinema=byId('cinema');
 if(!prefersReduced && cinema.classList.contains('active') && cinema.classList.contains('playing')){
  cinema.classList.add('controls-hidden');
 }
}
function revealCinemaControls(){
 const cinema=byId('cinema');
 cinema.classList.remove('controls-hidden');
 if(cinemaFadeTimer){clearTimeout(cinemaFadeTimer);cinemaFadeTimer=null}
 if(!prefersReduced && cinema.classList.contains('active') && cinema.classList.contains('playing')){
  cinemaFadeTimer=setTimeout(hideCinemaControls,2400);
 }
}
function setPlaying(playing){
 if(timer){clearInterval(timer);timer=null}
 const cinema=byId('cinema');
 cinema.classList.toggle('playing',playing);
 byId('cinema-play').textContent=playing?'Ⅱ Pause':'▶ Play';
 if(playing)timer=setInterval(()=>cinemaStep(1),Number(byId('cinema-speed').value)||5000);
 revealCinemaControls();
}
function stopCinema(){
 setPlaying(false);
 const el=byId('cinema');el.classList.remove('active','playing','controls-hidden');el.setAttribute('aria-hidden','true');
 if(cinemaFadeTimer){clearTimeout(cinemaFadeTimer);cinemaFadeTimer=null}
 document.body.style.overflow='';
 if(document.fullscreenElement && typeof document.exitFullscreen==='function') Promise.resolve(document.exitFullscreen()).catch(()=>{});
 cinemaNativeFullscreen=false;
 viewerArtists=[];
 if(currentArtist)colorFromArtwork(currentArtist.media[spatialIndex]||currentArtist.media[0],currentArtist);
 else if(featuredArtist)colorFromArtwork(featuredArtist.media[featuredIndex],featuredArtist);
 if(lastFocus&&lastFocus.isConnected)lastFocus.focus();
}
async function copyLink(url,target){
 try{
  if(!navigator.clipboard||!window.isSecureContext)throw Error('Clipboard not available');
  await navigator.clipboard.writeText(url);
  const original=target.textContent;target.textContent='✓ Link copied';
  setTimeout(()=>{target.textContent=original},1700);
 }catch{window.prompt('Copy this artist page URL:',url)}
}
/* Share poster is composed from the artist's identity, never generates or changes their art. */
async function downloadPoster(a,target){
 const original=target.textContent;
 target.disabled=true;
 target.textContent='Preparing exhibition brochure…';
 try{
  const base='/welcome/'+artistHandle(a).toLowerCase()+'-'+artistID(a);
  const themed=base+'--'+currentTheme;
  // Every theme has a fully rendered PNG plus a self-contained vector edition
  // compiled from the original 20-artwork brochure, never recoloring the art.
  let href=base+'.svg',ext='svg';
  for(const [candidate,type] of [[themed+'.png','png'],[themed+'.svg','svg'],[base+'.png','png'],[base+'.svg','svg']]){
   try{
    const response=await fetch(candidate,{method:'HEAD',cache:'no-store'});
    if(response.ok){href=candidate;ext=type;break}
   }catch{ /* Keep the gallery open and try the next reliable file. */ }
  }
  const download=document.createElement('a');
  download.href=href;
  download.download='TwentyX-'+artistHandle(a)+'-exhibition.'+ext;
  download.setAttribute('aria-label','Download exhibition brochure as '+ext.toUpperCase());
  document.body.append(download);
  download.click();
  download.remove();
 }catch(error){
  window.alert('Brochure download unavailable. Please try again: '+error.message);
 }finally{
  target.disabled=false;
  target.textContent=original;
 }
}
async function subscribeOpportunities(event){
 event.preventDefault();
 const form=byId('opportunity-signup'),input=byId('subscribe-email'),status=byId('subscribe-status'),submit=byId('subscribe-submit');
 const email=input.value.trim(),cadence=form.querySelector('input[name="cadence"]:checked')?.value;
 const website=form.querySelector('input[name="website"]')?.value||'';
 status.textContent='';
 if(!input.validity.valid){input.focus();status.textContent='Please enter a valid email address.';return}
 if(!byId('subscribe-consent').checked){status.textContent='Please confirm that you want ArtVision opportunity emails.';byId('subscribe-consent').focus();return}
 if(!['weekday','weekly','weekend'].includes(cadence)){status.textContent='Please choose how often you want updates.';return}
 submit.disabled=true;submit.textContent='Saving your preference…';
 try{
  const response=await fetch('https://xtkdnyqjheewsqnvugaj.supabase.co/functions/v1/artvision-subscribe',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({email,cadence,consent:true,website,source:'twentyx.artvision.today'})
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload.ok)throw Error(payload.error||'The subscription service is temporarily unavailable.');
  status.textContent='You’re on the ArtVision list. Your '+({weekday:'weekday',weekly:'weekly',weekend:'weekend'}[cadence])+' preference has been saved. Welcome.';
  form.reset();
 }catch(error){
  status.textContent='We could not save your email yet. Please try again.';
  console.warn('Opportunity subscription could not be saved:',error.message);
 }finally{submit.disabled=false;submit.textContent='Join the ArtVision list ↗'}
}
function bindUI(){
 byId('opportunity-signup').addEventListener('submit',subscribeOpportunities);
 byId('header-subscribe').addEventListener('click',()=>{const d=byId('opportunities');if(!d.open)d.showModal()});
 byId('opportunities-close').addEventListener('click',()=>byId('opportunities').close());
 byId('theme-dock-panel').setAttribute('aria-hidden','true');
 if('inert' in byId('theme-dock-panel'))byId('theme-dock-panel').inert=true;
 byId('theme-dock-tab').addEventListener('click',()=>setThemeDock(byId('theme-dock').dataset.open!=='true'));
 byId('theme-dock-close').addEventListener('click',()=>setThemeDock(false));
 byId('theme-select').addEventListener('change',event=>setTheme(event.target.value));
 document.querySelectorAll('[data-open-guide]').forEach(b=>b.addEventListener('click',()=>showGuide(b.dataset.openGuide)));
 byId('guide-close').addEventListener('click',()=>byId('guide-drawer').close());
 byId('guide-community').addEventListener('click',()=>{
  byId('guide-drawer').close();
  openXAction('community');
 });
 byId('x-action-guide').addEventListener('click',()=>{
  byId('x-action-modal').close();
  showGuide('ideas');
 });
 document.querySelectorAll('[data-guide-tab]').forEach(tab=>tab.addEventListener('click',()=>showGuide(tab.dataset.guideTab)));
 byId('enter-artvision').addEventListener('click',()=>openXAction('community'));
 byId('share-artvision').addEventListener('click',()=>openXAction('community'));
 byId('x-action-continue').addEventListener('click',openPendingX);
 byId('x-action-close').addEventListener('click',()=>byId('x-action-modal').close());
 byId('x-action-done').addEventListener('click',()=>byId('x-action-modal').close());
 const cinema=byId('cinema');
 cinema.addEventListener('pointermove',revealCinemaControls);
 cinema.addEventListener('touchstart',revealCinemaControls,{passive:true});
 cinema.addEventListener('focusin',revealCinemaControls);
 cinema.addEventListener('click',revealCinemaControls);
 window.addEventListener('resize',fitArtistHeadlines);
 document.addEventListener('fullscreenchange',()=>{
  if(cinemaNativeFullscreen && !document.fullscreenElement && byId('cinema').classList.contains('active')) stopCinema();
 });
 document.addEventListener('click',popFollow);
 byId('home-link').addEventListener('click',event=>{event.preventDefault();goHome()});
 byId('feature-artwork').addEventListener('click',()=>{if(featuredArtist)startCinema(artists,Math.max(0,artists.findIndex(x=>artistID(x)===artistID(featuredArtist))),featuredIndex,false)});
 byId('feature-enter').addEventListener('click',()=>{if(featuredArtist)goArtist(featuredArtist)});
 byId('arrival-artwork').addEventListener('click',()=>{if(arrivalArtist)startCinema(artists,Math.max(0,artists.findIndex(x=>artistID(x)===artistID(arrivalArtist))),arrivalWorkIndex,false)});
 byId('arrival-enter').addEventListener('click',()=>{if(arrivalArtist)goArtist(arrivalArtist)});
 byId('feature-rotate').addEventListener('click',()=>featureWork(true));
 const chamber=byId('feature-chamber');
 chamber.addEventListener('pointermove',e=>{
  if(prefersReduced||e.pointerType==='touch')return;
  const r=chamber.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
  chamber.style.setProperty('--tiltX',(-y*4).toFixed(2)+'deg');chamber.style.setProperty('--tiltY',(x*5).toFixed(2)+'deg');
  byId('feature-artwork').style.setProperty('--parallax-x',(x*18).toFixed(1)+'px');
  byId('feature-artwork').style.setProperty('--parallax-y',(y*18).toFixed(1)+'px');
 });
 chamber.addEventListener('pointerleave',()=>{
  chamber.style.setProperty('--tiltX','0deg');chamber.style.setProperty('--tiltY','0deg');
  byId('feature-artwork').style.setProperty('--parallax-x','0px');
  byId('feature-artwork').style.setProperty('--parallax-y','0px');
 });
 const spatial=byId('spatial-stage');
 spatial.addEventListener('pointermove',event=>{
  if(prefersReduced||event.pointerType==='touch')return;
  const bounds=spatial.getBoundingClientRect(),x=(event.clientX-bounds.left)/Math.max(1,bounds.width)-.5;
  for(const id of ['spatial-prev','spatial-current','spatial-next']){
   byId(id).style.setProperty('--parallax-x',(x*12).toFixed(1)+'px');
  }
 });
 spatial.addEventListener('pointerleave',()=>{
  for(const id of ['spatial-prev','spatial-current','spatial-next'])byId(id).style.setProperty('--parallax-x','0px');
 });
 cinema.querySelector('.cinema-viewport').addEventListener('pointermove',event=>{
  if(prefersReduced||event.pointerType==='touch')return;
  const frame=cinema.querySelector('.cinema-viewport'),box=frame.getBoundingClientRect();
  frame.style.setProperty('--parallax-x',(((event.clientX-box.left)/Math.max(1,box.width)-.5)*15).toFixed(1)+'px');
  frame.style.setProperty('--parallax-y',(((event.clientY-box.top)/Math.max(1,box.height)-.5)*15).toFixed(1)+'px');
 });
 byId('back-to-all').addEventListener('click',goHome);
 byId('search').addEventListener('input',renderHome);
 byId('surprise').addEventListener('click',()=>{const pool=byId('search').value.trim()?artists:curationArtists();if(pool.length)goArtist(pool[Math.floor(Math.random()*pool.length)])});
 byId('wall-mode').addEventListener('click',()=>changeMode('wall'));
 byId('spatial-mode').addEventListener('click',()=>changeMode('spatial'));
 byId('spatial-prev').addEventListener('click',()=>moveSpatial(-1));
 byId('spatial-next').addEventListener('click',()=>moveSpatial(1));
 byId('stage-prev-button').addEventListener('click',()=>moveSpatial(-1));
 byId('stage-next-button').addEventListener('click',()=>moveSpatial(1));
 byId('spatial-current').addEventListener('click',()=>startCinema(artists,Math.max(0,artists.findIndex(x=>artistID(x)===artistID(currentArtist))),spatialIndex,false));
 byId('choose-slideshow').addEventListener('click',()=>{makeChecklist();byId('selection-modal').showModal()});
 byId('close-selection').addEventListener('click',()=>byId('selection-modal').close());
 byId('select-all').addEventListener('click',()=>selectAll(true));
 byId('select-none').addEventListener('click',()=>selectAll(false));
 byId('launch-selection').addEventListener('click',()=>startCinema(artists.filter(a=>selection.has(artistID(a))),0,0,true));
 document.querySelectorAll('[data-info]').forEach(b=>b.addEventListener('click',()=>openHelp(b.dataset.info)));
 byId('close-help').addEventListener('click',()=>byId('help-modal').close());
 byId('help-done').addEventListener('click',()=>byId('help-modal').close());
 byId('cinema-info').addEventListener('click',()=>openHelp('cinema'));
 byId('cinema-download').addEventListener('click',()=>{const a=viewerArtists[viewerArtistIndex];if(a)downloadPoster(a,byId('cinema-download'))});
 byId('cinema-close').addEventListener('click',stopCinema);
 byId('cinema-previous').addEventListener('click',()=>cinemaStep(-1));
 byId('cinema-next').addEventListener('click',()=>cinemaStep(1));
 byId('cinema-previous-artist').addEventListener('click',()=>cinemaArtistStep(-1));
 byId('cinema-next-artist').addEventListener('click',()=>cinemaArtistStep(1));
 byId('cinema-play').addEventListener('click',()=>setPlaying(!timer));
 byId('cinema-speed').addEventListener('change',()=>{if(timer)setPlaying(true)});
 document.addEventListener('keydown',event=>{
  if(byId('cinema').classList.contains('active')){
   revealCinemaControls();
   if(byId('help-modal').open)return;
   const key=event.key;
   if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Escape'].includes(key))event.preventDefault();
   if(key==='Escape')stopCinema();
   if(key==='ArrowLeft')cinemaStep(-1);
   if(key==='ArrowRight')cinemaStep(1);
   if(key==='ArrowUp')cinemaArtistStep(-1);
   if(key==='ArrowDown')cinemaArtistStep(1);
   if(key===' ')setPlaying(!timer);
  }else if(currentArtist&&wallMode==='spatial'&&!byId('help-modal').open&&!(event.target instanceof HTMLInputElement)){
   if(event.key==='ArrowRight')moveSpatial(1);
   if(event.key==='ArrowLeft')moveSpatial(-1);
  }
 });
 let startX=0,startY=0;
 const c=byId('cinema');
 c.addEventListener('touchstart',event=>{startX=event.changedTouches[0].clientX;startY=event.changedTouches[0].clientY},{passive:true});
 c.addEventListener('touchend',event=>{
  const dx=event.changedTouches[0].clientX-startX,dy=event.changedTouches[0].clientY-startY;
  if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.2)cinemaStep(dx<0?1:-1);
  else if(Math.abs(dy)>65&&Math.abs(dy)>Math.abs(dx)*1.2)cinemaArtistStep(dy<0?1:-1);
 },{passive:true});
 window.addEventListener('popstate',()=>{renderRoute();window.scrollTo(0,0)});
}
async function syncLatestExhibitions(){
 try{
  const response=await fetch('/artists.json?v='+Date.now(),{cache:'no-store'});
  if(!response.ok)return;
  const data=await response.json();
  if(!Array.isArray(data))return;
  const fresh=sortArtists(data.filter(valid));
  if(!fresh.length)return;
  const previousIds=new Set(artists.map(artistID));
  const combined=new Map(artists.map(a=>[artistID(a),a]));
  fresh.forEach(a=>combined.set(artistID(a),a));
  if(combined.size===previousIds.size)return;
  artists=sortArtists([...combined.values()]);
  byId('artist-count').textContent=artists.length;
  byId('work-count').textContent=(artists.length*20).toLocaleString();
  if(!byId('cinema').classList.contains('active'))renderRoute();
  featureWork(false);
  void renderArrivalImage();
  scheduleHeadlineFit();
 }catch(error){console.warn('Live stats refresh deferred:',error.message)}
}
async function load(){
 setDayPhase();initializeTheme();setInterval(()=>{setDayPhase();featureWork(false)},60000);bindUI();
 window.setInterval(syncLatestExhibitions,120000);
 let seeded=[];
 try{
  const el=byId('seeded-artists');
  if(el){
   const data=JSON.parse(el.textContent);
   if(Array.isArray(data))seeded=sortArtists(data.filter(valid));
  }
 }catch(error){console.warn('Initial exhibition seed could not be read:',error)}
 if(!seeded.length){
  seeded=sourceArtistsFromArtworkDOM();
  seedRecoverySource='rendered HTML';
 }
 // Paint all twenty artworks immediately, without a network request.
 if(seeded.length){
  artists=seeded;
  byId('artist-count').textContent=artists.length;
  byId('work-count').textContent=(artists.length*20).toLocaleString();
  renderRoute();
  featureWork(false);
  void renderArrivalImage();
  scheduleHeadlineFit();
 }
 try{
  const response=await fetch('/artists.json?v='+Math.floor(Date.now()/900000),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data))throw Error('Exhibition data format error');
  const fresh=sortArtists(data.filter(valid));
  if(!fresh.length)throw Error('No complete twenty-work exhibitions found');
  // A partial or broken live update must never erase the embedded works.
  const retained=new Map(seeded.map(a=>[artistID(a),a]));
  fresh.forEach(a=>retained.set(artistID(a),a));
  artists=sortArtists([...retained.values()]);
  byId('artist-count').textContent=artists.length;
  byId('work-count').textContent=(artists.length*20).toLocaleString();
  renderRoute();
  featureWork(false);
  void renderArrivalImage();
 }catch(error){
  if(!seeded.length){
   byId('home-status').textContent='The exhibition could not load: '+error.message;
   byId('home-view').hidden=false;byId('artist-view').hidden=true;
  }else console.warn('Live refresh unavailable; displaying bundled artworks:',error.message);
 }
}
load();
