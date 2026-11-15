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
const PINNED=['pepavaggio','stunnifer','ciphervoss'];
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
let seedRecoverySource='embedded JSON';
const prefersReduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const help={
  about:['What is TwentyX?','TwentyX Presented By ArtVision is a multidimensional self-evolving art exhibition. Every artist curates twenty works of art on X. Enter their solo exhibitions, experience the work in multiple dimensions, and follow the artists who made it.'],
  updates:['When does the gallery update?','The publishing window is 6:00 AM and 6:00 PM Pacific Time. Scheduled GitHub Actions can be delayed or skipped. New works enter the exhibition only after all twenty media references pass validation.'],
  join:['How to participate','Your post must contain exactly 20 artworks to appear in TwentyX. Posts containing 1–19 are not eligible. Twenty is the maximum number allowed in a single X post. Include #TwentyX and share your work with ArtVision on X; each complete exhibition is verified before inclusion.'],
  browse:['Exploring the exhibition','Select an artist to view all twenty works on a full-width exhibition wall, or switch to the spatial carousel. Use Surprise me for a chance encounter. The slideshow studio lets you select any combination of artists, or play the entire gallery.'],
  qr:['What does the exhibition brochure do?','Download a portrait-format exhibition invitation featuring all twenty original works, the artist’s curatorial credit, and a scannable QR code linking to their full-sized solo exhibition. The link will function on the public domain when this update is published.'],
  spatial:['About the spatial carousel','A cinematic, three-panel perspective viewer. The original two-dimensional artworks remain unchanged. Use Previous or Next to cycle through all twenty; click the center image to enter the immersive viewer.'],
  cinema:['Cinematic slideshow controls','Left and right arrows move between artworks. Up and down arrows switch between the artists you selected. On touchscreens, swipe horizontally for artwork and vertically to move between artists. Space toggles autoplay; Escape exits. Camera gestures are not required or enabled.']
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
 const rank=a=>{const p=parsePost(a.postUrl);const handle=p.handle.toLowerCase();const found=PINNED.indexOf(handle);return found<0?99:found};
 return [...list].sort((a,b)=>rank(a)-rank(b)||parsePost(b.postUrl).id.localeCompare(parsePost(a.postUrl).id));
}
function artistID(a){return parsePost(a.postUrl).id}
function artistHandle(a){return parsePost(a.postUrl).handle}
function artistX(a){return 'https://x.com/'+artistHandle(a)}
function followIntent(a){return 'https://twitter.com/intent/follow?screen_name='+encodeURIComponent(artistHandle(a))}
function popFollow(event){
 const a=event.target.closest('a[data-follow]');if(!a)return;
 event.preventDefault();
 const width=510,height=660;
 const left=Math.max(0,Math.round((window.screen.width-width)/2)),top=Math.max(0,Math.round((window.screen.height-height)/2));
 const popup=window.open(a.href,'twentyx_x_follow','popup=yes,width='+width+',height='+height+',left='+left+',top='+top);
 if(!popup)window.open(a.href,'_blank','noopener,noreferrer');
}
function artistURL(a){return CANONICAL+'?artist='+encodeURIComponent(artistID(a))}
function link(label,url,className){
 const a=create('a',className,label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;
}
function button(label,className,callback){
 const b=create('button',className,label);b.type='button';b.addEventListener('click',callback);return b;
}
function setDayPhase(){
 const hour=new Date().getHours();
 const phase=hour>=5&&hour<10?'daybreak':hour>=10&&hour<17?'day':hour>=17&&hour<21?'sunset':'night';
 document.body.dataset.phase=phase;
 byId('phase-label').textContent='LOCAL LIGHT / '+({daybreak:'DAYBREAK',day:'DAYLIGHT',sunset:'SUNSET',night:'AFTER DARK'}[phase]);
}
function routeArtist(){return new URLSearchParams(location.search).get('artist')}
function goHome(){
 history.pushState(null,'',location.pathname);
 renderRoute();window.scrollTo({top:0,behavior:prefersReduced?'auto':'smooth'});
}
function goArtist(a){
 history.pushState(null,'','?artist='+encodeURIComponent(artistID(a)));
 renderRoute();window.scrollTo({top:0,behavior:prefersReduced?'auto':'smooth'});
}
function makeTile(a,i,className){
 const tile=button('',className||'artwork-thumb',()=>startCinema([a],0,i,false));
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
function featureWork(next=false){
 if(!artists.length)return;
 const latest=newestArtist();
 const artistChanged=!featuredArtist||artistID(featuredArtist)!==artistID(latest);
 featuredArtist=latest;
 if(artistChanged)featuredIndex=Math.floor(Math.random()*20);
 else if(next)featuredIndex=(featuredIndex+1+Math.floor(Math.random()*19))%20;
 const img=byId('feature-image');
 if(!img)return;
 img.classList.add('change');
 const src=featuredArtist.media[featuredIndex];
 const reveal=()=>{
  img.src=src;
  img.alt='Featured work '+(featuredIndex+1)+' of 20 curated by '+featuredArtist.name;
  byId('feature-number').textContent=String(featuredIndex+1).padStart(2,'0')+' / 20';
  byId('feature-title').textContent=featuredArtist.name;
  byId('feature-subline').textContent='An exhibition curated by '+featuredArtist.name+' · '+featuredArtist.date;
  img.classList.remove('change');
 };
 if(prefersReduced||!next)reveal();
 else window.setTimeout(reveal,220);
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
function renderHome(){
 const q=byId('search').value.trim().toLowerCase();
 const shown=artists.filter(a=>(a.name+' '+artistHandle(a)).toLowerCase().includes(q));
 const root=byId('home-gallery');root.replaceChildren();
 shown.forEach((a,idx)=>{
  const card=create('article','collection-card');card.id='artist-'+artistID(a);
  const head=create('div','card-meta');
  const titleWrap=create('div');
  if(idx<3&&!q)titleWrap.append(create('div','card-overline','FEATURED ARTIST  /  '+String(idx+1).padStart(2,'0')));
  const title=create('h3','card-name',a.name);titleWrap.append(title,create('div','card-handle','@'+artistHandle(a)+' · 20 / 20'));
  head.append(titleWrap,create('span','card-date',a.date||''));card.append(head);
  const grid=create('div','card-mosaic');a.media.forEach((_,i)=>grid.append(makeTile(a,i)));card.append(grid);
  const actions=create('div','card-footer');
  const follow=link('Follow on X ↗',followIntent(a),'pill primary');follow.dataset.follow='true';actions.append(follow);
  actions.append(link('Original post ↗',a.postUrl,'ghost'));
  actions.append(button('Explore 20 →','ghost artist-open',()=>goArtist(a)));
  card.append(actions);root.append(card);
 });
 if(!shown.length)root.append(create('div','empty','No artists match this search. Try another name or handle.'));
 byId('home-status').textContent=shown.length+' complete collections · All contain twenty artworks';
}
function changeMode(mode){
 wallMode=mode;
 const isWall=mode==='wall';
 byId('artist-wall').hidden=!isWall;
 byId('spatial-stage').hidden=isWall;
 byId('wall-mode').classList.toggle('active',isWall);
 byId('spatial-mode').classList.toggle('active',!isWall);
 byId('wall-mode').setAttribute('aria-pressed',String(isWall));
 byId('spatial-mode').setAttribute('aria-pressed',String(!isWall));
 if(!isWall)renderSpatial();
}
function renderSpatial(){
 if(!currentArtist)return;
 const n=currentArtist.media.length;
 byId('stage-main').src=currentArtist.media[spatialIndex];
 byId('stage-main').alt='Artwork '+(spatialIndex+1)+' of 20 by '+currentArtist.name;
 byId('stage-left').src=currentArtist.media[(spatialIndex+n-1)%n];
 byId('stage-right').src=currentArtist.media[(spatialIndex+1)%n];
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
 byId('artist-title').textContent=a.name;
 byId('artist-handle').textContent='@'+artistHandle(a)+'  ·  20 / 20 works';
 byId('artist-date').textContent=a.date||'';
 byId('follow-link').href=followIntent(a);byId('follow-link').dataset.follow='true';
 byId('original-link').href=a.postUrl;
 const wall=byId('artist-wall');wall.replaceChildren();
 a.media.forEach((_,i)=>wall.append(makeTile(a,i)));
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
 byId('play-artist').onclick=()=>startCinema([a],0,0,true);
}
function renderRoute(){
 const id=routeArtist(),match=artists.find(a=>artistID(a)===id);
 const onArtist=Boolean(match);
 byId('home-view').hidden=onArtist;
 byId('artist-view').hidden=!onArtist;
 if(onArtist)renderArtist(match);
 else{
  currentArtist=null;document.title='TwentyX • ArtVision X';
  renderHome();
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
function showCinema(){
 const c=byId('cinema');c.classList.add('active');c.setAttribute('aria-hidden','false');
 document.body.style.overflow='hidden';c.focus();
 // The center modal is immersive but does not seize the operating-system fullscreen state.
}
function startCinema(list,artistIndex,artIndex,autoplay){
 if(!list.length)return;
 lastFocus=document.activeElement;
 viewerArtists=list.slice();viewerArtistIndex=artistIndex||0;viewerWorkIndex=artIndex||0;
 if(byId('selection-modal').open)byId('selection-modal').close();
 showCinema();renderCinema();setPlaying(Boolean(autoplay)&&!prefersReduced);
}
function renderCinema(){
 if(!viewerArtists.length)return;
 const a=viewerArtists[viewerArtistIndex];
 byId('cinema-artist').textContent=a.name;
 byId('cinema-follow').href=followIntent(a);byId('cinema-follow').dataset.follow='true';
 byId('cinema-progress').textContent='WORK '+String(viewerWorkIndex+1).padStart(2,'0')+' / 20  ·  ARTIST '+String(viewerArtistIndex+1).padStart(2,'0')+' / '+String(viewerArtists.length).padStart(2,'0');
 const image=byId('cinema-img');
 image.src=a.media[viewerWorkIndex];image.alt='Artwork '+(viewerWorkIndex+1)+' of 20 by '+a.name;
 image.style.animation='none';void image.offsetWidth;image.style.animation='';
 const rail=byId('cinema-filmstrip');rail.replaceChildren();
 a.media.forEach((src,i)=>{
  const thumb=button('','',()=>{viewerWorkIndex=i;renderCinema()});
  const picture=create('img');picture.src=src;picture.alt='Artwork '+(i+1);picture.loading='lazy';
  thumb.append(picture);
  thumb.setAttribute('aria-label','Go to artwork '+(i+1));
  if(i===viewerWorkIndex)thumb.classList.add('active');
  rail.append(thumb);
 });
 const focused=rail.querySelector('.active');if(focused&&focused.scrollIntoView)focused.scrollIntoView({block:'nearest',inline:'center'});
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
function setPlaying(playing){
 if(timer){clearInterval(timer);timer=null}
 byId('cinema-play').textContent=playing?'Ⅱ Pause':'▶ Play';
 if(playing)timer=setInterval(()=>cinemaStep(1),Number(byId('cinema-speed').value)||5000);
}
function stopCinema(){
 setPlaying(false);
 const el=byId('cinema');el.classList.remove('active');el.setAttribute('aria-hidden','true');
 document.body.style.overflow='';
 if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 viewerArtists=[];
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
 const original=target.textContent;target.disabled=true;target.textContent='Preparing collector brochure…';
 try{
  const filename='welcome/'+artistHandle(a).toLowerCase()+'-'+artistID(a)+'.png';
  const prepared=await fetch(filename,{method:'HEAD',cache:'no-store'}).catch(()=>null);
  if(prepared?.ok){
   const response=await fetch(filename);
   if(!response.ok)throw Error('Could not retrieve collector brochure');
   const blob=await response.blob(),objectURL=URL.createObjectURL(blob);
   const download=document.createElement('a');download.href=objectURL;
   download.download='TwentyX-'+artistHandle(a)+'-brochure.png';
   document.body.append(download);download.click();download.remove();
   setTimeout(()=>URL.revokeObjectURL(objectURL),6000);return;
  }
  if(!window.QRCode)throw Error('QR renderer unavailable. Please refresh while online.');
  const c=document.createElement('canvas');c.width=1080;c.height=1350;
  const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,1080,1350);
  g.addColorStop(0,'#12122c');g.addColorStop(.56,'#5a2a50');g.addColorStop(1,'#263a61');
  ctx.fillStyle=g;ctx.fillRect(0,0,1080,1350);
  ctx.fillStyle='#f4a2c8';ctx.font='bold 34px Inter, sans-serif';ctx.fillText('ARTVISION X  /  TWENTYX',74,114);
  ctx.fillStyle='#ffffff';ctx.font='900 112px Inter, sans-serif';ctx.fillText('WELCOME',66,308);
  ctx.fillStyle='#f4a2c8';ctx.fillText('TO THE 20.',66,426);
  let fontSize=88;
  do{ctx.font='800 '+fontSize+'px Inter, sans-serif';fontSize-=2}while(ctx.measureText(a.name).width>920&&fontSize>26);
  ctx.fillStyle='#ffffff';ctx.fillText('CURATED BY',74,520);ctx.fillText(a.name,74,600);
  ctx.font='32px Inter, sans-serif';ctx.fillStyle='#e3d6ee';ctx.fillText('@'+artistHandle(a)+'  ·  20 WORKS / ONE POST',76,635);
  ctx.fillStyle='#ffffff';ctx.fillRect(76,711,445,445);
  const qr=await window.QRCode.toDataURL(artistURL(a),{width:420,margin:2,errorCorrectionLevel:'H',color:{dark:'#1b1432',light:'#ffffff'}});
  const img=new Image();img.src=qr;await img.decode();ctx.drawImage(img,88,724,420,420);
  ctx.font='bold 41px Inter, sans-serif';ctx.fillStyle='#ffffff';
  ctx.fillText('EXPLORE',552,824);ctx.fillText('THE FULL',552,880);ctx.fillText('COLLECTION',552,936);
  ctx.font='27px Inter, sans-serif';ctx.fillStyle='#e9d6f2';
  ctx.fillText('Scan to explore the full size',552,1010);ctx.fillText('exhibition.',552,1051);
  ctx.font='30px Inter, sans-serif';ctx.fillStyle='#f4a2c8';
  ctx.fillText('#TWENTYX • Twenty works of art on X',74,1255);
  const out=document.createElement('a');out.download='TwentyX-'+artistHandle(a)+'-welcome.png';
  out.href=c.toDataURL('image/png');document.body.append(out);out.click();out.remove();
 }catch(error){window.alert('Could not create poster: '+error.message)}
 finally{target.disabled=false;target.textContent=original}
}
function bindUI(){
 document.addEventListener('click',popFollow);
 byId('home-link').addEventListener('click',event=>{event.preventDefault();goHome()});
 byId('feature-artwork').addEventListener('click',()=>{if(featuredArtist)startCinema([featuredArtist],0,featuredIndex,false)});
 byId('feature-enter').addEventListener('click',()=>{if(featuredArtist)goArtist(featuredArtist)});
 byId('feature-rotate').addEventListener('click',()=>featureWork(true));
 const chamber=byId('feature-chamber');
 chamber.addEventListener('pointermove',e=>{
  if(prefersReduced||e.pointerType==='touch')return;
  const r=chamber.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
  chamber.style.setProperty('--tiltX',(-y*4).toFixed(2)+'deg');chamber.style.setProperty('--tiltY',(x*5).toFixed(2)+'deg');
 });
 chamber.addEventListener('pointerleave',()=>{chamber.style.setProperty('--tiltX','0deg');chamber.style.setProperty('--tiltY','0deg')});
 byId('back-to-all').addEventListener('click',goHome);
 byId('search').addEventListener('input',renderHome);
 byId('surprise').addEventListener('click',()=>{if(artists.length)goArtist(artists[Math.floor(Math.random()*artists.length)])});
 byId('wall-mode').addEventListener('click',()=>changeMode('wall'));
 byId('spatial-mode').addEventListener('click',()=>changeMode('spatial'));
 byId('spatial-prev').addEventListener('click',()=>moveSpatial(-1));
 byId('spatial-next').addEventListener('click',()=>moveSpatial(1));
 byId('stage-prev-button').addEventListener('click',()=>moveSpatial(-1));
 byId('stage-next-button').addEventListener('click',()=>moveSpatial(1));
 byId('spatial-current').addEventListener('click',()=>startCinema([currentArtist],0,spatialIndex,false));
 byId('choose-slideshow').addEventListener('click',()=>{makeChecklist();byId('selection-modal').showModal()});
 byId('close-selection').addEventListener('click',()=>byId('selection-modal').close());
 byId('select-all').addEventListener('click',()=>selectAll(true));
 byId('select-none').addEventListener('click',()=>selectAll(false));
 byId('launch-selection').addEventListener('click',()=>startCinema(artists.filter(a=>selection.has(artistID(a))),0,0,true));
 document.querySelectorAll('[data-info]').forEach(b=>b.addEventListener('click',()=>openHelp(b.dataset.info)));
 byId('close-help').addEventListener('click',()=>byId('help-modal').close());
 byId('help-done').addEventListener('click',()=>byId('help-modal').close());
 byId('cinema-info').addEventListener('click',()=>openHelp('cinema'));
 byId('cinema-close').addEventListener('click',stopCinema);
 byId('cinema-previous').addEventListener('click',()=>cinemaStep(-1));
 byId('cinema-next').addEventListener('click',()=>cinemaStep(1));
 byId('cinema-previous-artist').addEventListener('click',()=>cinemaArtistStep(-1));
 byId('cinema-next-artist').addEventListener('click',()=>cinemaArtistStep(1));
 byId('cinema-play').addEventListener('click',()=>setPlaying(!timer));
 byId('cinema-speed').addEventListener('change',()=>{if(timer)setPlaying(true)});
 document.addEventListener('keydown',event=>{
  if(byId('cinema').classList.contains('active')){
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
  const response=await fetch('./artists.json?v='+Date.now(),{cache:'no-store'});
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
 }catch(error){console.warn('Live stats refresh deferred:',error.message)}
}
async function load(){
 setDayPhase();setInterval(setDayPhase,60000);bindUI();
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
 }
 try{
  const response=await fetch('./artists.json?v='+Math.floor(Date.now()/900000),{cache:'no-store'});
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
 }catch(error){
  if(!seeded.length){
   byId('home-status').textContent='The exhibition could not load: '+error.message;
   byId('home-view').hidden=false;byId('artist-view').hidden=true;
  }else console.warn('Live refresh unavailable; displaying bundled artworks:',error.message);
 }
}
load();
