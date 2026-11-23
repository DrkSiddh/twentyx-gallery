#!/usr/bin/env node
/**
 * Build the self-contained, fully artwork-seeded GitHub Pages landing page.
 * No API keys, network requests, build service, or database required.
 *
 * Produces a single index.html with:
 *  - embedded CSS and JS (no relative asset requests to break in previews)
 *  - embedded current artists.json (network-independent first paint)
 *  - server-rendered 20-work artist mosaics for even JS-disabled browsers
 *
 * New validated artist records are always rendered on the next publication.
 */
import fs from 'node:fs';
import {hasAdmissionEvidence} from './admissions.mjs';
import QRCode from 'qrcode';
import {inflateRawSync} from 'node:zlib';

const load=file=>fs.readFileSync(file,'utf8');
const html=load('src/index.template.html');
function loadComputeristFont(){
 // The user supplied Computerist.ttf inside this precise existing ZIP.
 // Extract it deterministically at build time, then embed within the
 // fully self-contained artist pages. No font is downloaded externally.
 const zip=fs.readFileSync('Themes/Default theme (unstated)/H3/computerist.zip');
 if(zip.readUInt32LE(0)!==0x04034b50)throw Error('Computerist ZIP header missing');
 const method=zip.readUInt16LE(8),compressed=zip.readUInt32LE(18);
 const filenameSize=zip.readUInt16LE(26),extraSize=zip.readUInt16LE(28);
 const from=30+filenameSize+extraSize;
 if(compressed<1000||from+compressed>zip.length)throw Error('Computerist ZIP data corrupt');
 const font=method===8?inflateRawSync(zip.subarray(from,from+compressed)):
  method===0?zip.subarray(from,from+compressed):null;
 if(!font||font.length<10000||font.length>1000000)throw Error('Computerist font invalid');
 return '@font-face{font-family:"Computerist";src:url("data:font/ttf;base64,'+
  font.toString('base64')+'") format("truetype");font-display:swap}\n';
}
const css=load('styles.css')+'\n'+loadComputeristFont();
const javascript=load('app.js');
const artists=JSON.parse(load('artists.json'));
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const idOf=artist=>String(artist.postUrl||'').match(/\/status\/(\d+)\/?$/)?.[1];
const handle=artist=>new URL(artist.postUrl).pathname.split('/')[1];
const validMedia=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='pbs.twimg.com'&&u.pathname.startsWith('/media/')}catch{return false}};
if(!Array.isArray(artists)||!artists.length)throw Error('No artists: refusing blank exhibition build');
const ids=new Set();
for(const a of artists){
 const id=idOf(a),h=handle(a);
 if(!hasAdmissionEvidence(a))throw Error('Missing #TwentyX evidence for post '+id);
 if(!id||!h||ids.has(id))throw Error('Duplicate or invalid artist source: '+a.name);
 if(!Array.isArray(a.media)||a.media.length!==20||new Set(a.media).size!==20)throw Error('Not twenty works: '+a.name);
 if(a.media.some(u=>!validMedia(u)))throw Error('Unsafe media source for '+a.name);
 ids.add(id);
}
// Gallery arrivals are chronological, independent of feature priority.
const ordered=[...artists].sort((a,b)=>idOf(b).localeCompare(idOf(a)));
const creditedArtists=[...new Map(ordered.map(a=>[handle(a).toLowerCase(),a])).values()]
 .sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
const credits=creditedArtists.map(a=>'<li><a href="/@'+esc(handle(a).toLowerCase())+'/">'+esc(a.name)+'</a></li>').join('');
const formatCuration=date=>{
 const [y,m,d]=String(date||'').split('-');
 return d&&m&&y?d+' '+m+' '+y+' curation':'Artist curation';
};
function renderCard(a,index,total){
 const title=esc(a.name),artistHandle=esc(handle(a)),date=esc(a.date||''),slug=artistHandle.toLowerCase();
 const originals=a.media.map((u,i)=>'<a class="artwork-thumb" href="'+esc(a.postUrl)+'" target="_blank" rel="noopener noreferrer" aria-label="Work '+(i+1)+' of 20 by '+title+'"><img src="'+esc(u)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="Artwork '+(i+1)+' by '+title+'"></a>').join('');
 return '<article class="collection-card" data-artist-handle="'+slug+'" id="artist-'+idOf(a)+'">'
  +'<div class="card-mosaic">'+originals+'</div>'
  +'<div class="card-meta"><span class="collection-sequence">'+String(index+1).padStart(2,'0')+' / '+String(total).padStart(2,'0')+'</span><div class="card-heading"><h3 class="card-name"><a class="artist-name-link" href="/@'+slug+'/">'+title+'</a></h3><div class="card-labels"><span class="card-handle">@'+artistHandle+' on X</span><span class="card-count">20 works</span></div></div></div>'
  +'<div class="card-footer"><span class="card-date" data-raw-date="'+date+'">'+esc(formatCuration(a.date))+'</span>'
  +'<div class="card-link-actions"><a class="pill primary" href="https://twitter.com/intent/follow?screen_name='+artistHandle+'" data-follow="true" target="_blank" rel="noopener noreferrer">Follow on X ↗</a>'
  +'<a class="ghost" href="'+esc(a.postUrl)+'" target="_blank" rel="noopener noreferrer">Original post ↗</a></div></div></article>';
}
// Server render only the selected Postphotography room to prevent an
// uncurated anime-heavy flash before the client-side gallery initializes.
const frontRoom=new Set(['turonworld','skelevaggio','stunnifer','ctwlk','pepavaggio','giselxphoto','exolorian','jjjjere','allthebots','ciphervoss']);
const firstRoom=ordered.filter(a=>frontRoom.has(handle(a).toLowerCase()));
const initial=firstRoom.map((a,i)=>renderCard(a,i,firstRoom.length)).join('\n');
const seed=JSON.stringify(ordered).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
let output=html;
const requireReplace=(from,to)=>{if(!output.includes(from))throw Error('Missing expected HTML anchor: '+from);output=output.replace(from,to)};
const curated=ordered.find(a=>['skelevaggio','stunnifer','pepavaggio','giselxphoto','hplovebux','artxygenishim'].includes(handle(a).toLowerCase()))||ordered[0];
const sourceFeatured=curated.media[0];
requireReplace('<strong id="artist-count">0</strong>','<strong id="artist-count">'+artists.length+'</strong>');
requireReplace('<strong id="work-count">0</strong>','<strong id="work-count">'+(artists.length*20)+'</strong>');
requireReplace('<img id="feature-image" alt="Featured TwentyX artwork" loading="eager" decoding="async">',
 '<img id="feature-image" src="'+esc(sourceFeatured)+'" alt="Featured original artwork curated by '+esc(curated.name)+'" loading="eager" decoding="async">');
requireReplace('<h2 id="feature-title" class="feature-artist-name">Artist spotlight</h2>',
 '<h2 id="feature-title" class="feature-artist-name">'+esc(curated.name)+'</h2>');

requireReplace('<link rel="stylesheet" href="./styles.css">','<style>\n'+css+'\n</style>');
requireReplace('<script src="./app.js" defer></script>','');
requireReplace('<ul id="artist-credits-list" class="artist-credits-list"></ul>','<ul id="artist-credits-list" class="artist-credits-list">'+credits+'</ul>');
requireReplace('<div class="home-gallery" id="home-gallery"></div>','<div class="home-gallery" id="home-gallery">\n'+initial+'\n</div>');
requireReplace('</body>','<script id="seeded-artists" type="application/json">'+seed+'</script>\n<script>\n'+javascript.replaceAll('</script','<\\/script')+'\n</script>\n</body>');
if(!output.includes('id="seeded-artists"')||!output.includes('class="card-mosaic"')||!output.includes('id="featured-six-gallery"')||!output.includes('pbs.twimg.com/media/')) {
 throw Error('Missing verified artwork grid, six-artist feature, or seeded gallery data');
}
const result='index.html';
fs.writeFileSync(result,output);
const slugs=new Set();
for(const artist of ordered){
 const slug=handle(artist).toLowerCase();
 if(!/^[a-z0-9_]{1,15}$/.test(slug)||slugs.has(slug))throw Error('Unsafe or duplicate artist handle '+slug);
 slugs.add(slug);
 const path='@'+slug;
 fs.mkdirSync(path,{recursive:true});
 const canonical='https://twentyx.artvision.today/'+path+'/';
 const artistHtml=output.replace('<title>TwentyX • ArtVision X</title>','<title>'+esc(artist.name)+' — TwentyX Presented By ArtVision</title>')
   .replace('</head>','<link rel="canonical" href="'+canonical+'">\n<meta property="og:title" content="'+esc(artist.name)+' — TwentyX">\n<meta property="og:description" content="A twenty-work digital art exhibition curated by '+esc(artist.name)+'.">\n</head>');
 fs.writeFileSync(path+'/index.html',artistHtml);
}

// Fallback brochures exist at every publication, even when remote artwork
// thumbnail downloads fail. The SVG has a built-in QR and references each
// original artist artwork, so a brochure click never points to a missing file.
fs.mkdirSync('welcome',{recursive:true});
const svgEsc=esc;
for(const artist of ordered){
 const h=handle(artist).toLowerCase();
 const id=idOf(artist);
 const name=svgEsc(artist.name);
 const slug='welcome/'+h+'-'+id+'.svg';
 const qr=await QRCode.toDataURL('https://twentyx.artvision.today/@'+h+'/',{
   width:160,margin:2,errorCorrectionLevel:'H',
   color:{dark:'#151329',light:'#ffffff'}
 });
 const qrData=qr.replace(/^data:image\/png;base64,/,'');
 const titleSize=artist.name.length>24?39:artist.name.length>15?50:artist.name.length>10?62:76;
 const works=artist.media.map((url,i)=>{
   const x=76+(i%5)*187,y=399+Math.floor(i/5)*187;
   return '<rect x="'+(x-2)+'" y="'+(y-2)+'" width="184" height="184" fill="#15182d" stroke="#fffc"/>'+
     '<image x="'+x+'" y="'+y+'" width="180" height="180" preserveAspectRatio="xMidYMid meet" href="'+svgEsc(url)+'"/>'+
     '<text x="'+(x+8)+'" y="'+(y+171)+'" font-family="sans-serif" font-size="15" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke">'+String(i+1).padStart(2,'0')+'</text>';
 }).join('');
 const poster= [
 '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1080 1350" width="1080" height="1350">',
 '<metadata>https://twentyx.artvision.today/@'+h+'/</metadata>',
 '<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0b102b"/><stop offset=".52" stop-color="#281a41"/><stop offset="1" stop-color="#090d20"/></linearGradient>'+
 '<linearGradient id="chrome" x2="1" y2="1"><stop stop-color="#fee5f7"/><stop offset=".28" stop-color="#f4a2c8"/><stop offset=".5" stop-color="#fff"/><stop offset=".72" stop-color="#9bb8e5"/><stop offset="1" stop-color="#f4a2c8"/></linearGradient></defs>',
 '<rect width="1080" height="1350" fill="url(#bg)"/>',
 '<path d="M0 8H1080" stroke="url(#chrome)" stroke-width="16"/>',
 '<rect x="22" y="22" width="1036" height="1306" rx="9" fill="none" stroke="#f4a2c8" stroke-opacity=".42"/>',
 '<text x="64" y="74" font-family="sans-serif" font-size="22" font-weight="bold" letter-spacing="4" fill="#f4a2c8">ARTVISION / MULTIDIMENSIONAL EXHIBITION</text>',
 '<text x="62" y="190" font-family="Dune Rise, sans-serif" font-size="115" font-weight="bold" fill="url(#chrome)">TWENTYX</text>',
 '<line x1="65" y1="209" x2="1015" y2="209" stroke="#f4a2c8" stroke-opacity=".55"/>',
 '<text x="65" y="253" font-family="sans-serif" font-size="23" letter-spacing="3" fill="#f4a2c8">WELCOME TO THE EXHIBITION</text>',
 '<text x="65" y="329" font-family="sans-serif" font-size="'+titleSize+'" font-weight="bold" fill="#fff5fc">CURATED BY '+name+'.</text>',
 '<text x="67" y="364" font-family="sans-serif" font-size="20" fill="#ddd0e8">@'+h+'  /  20 WORKS  /  '+svgEsc(artist.date||'')+'</text>',
 '<rect x="64" y="385" width="952" height="758" rx="10" fill="#100f21" stroke="#ffffff" stroke-opacity=".2"/>',
 works,
 '<rect x="65" y="1168" width="146" height="146" rx="5" fill="#fff"/>',
 '<image x="67" y="1170" width="142" height="142" href="data:image/png;base64,'+qrData+'"/>',
 '<text x="241" y="1213" font-family="sans-serif" font-size="25" font-weight="bold" fill="#fff">TwentyX Presented By ArtVision</text>',
 '<text x="241" y="1252" font-family="sans-serif" font-size="21" fill="#e8dbf0">Scan to explore the full size exhibition.</text>',
 '<text x="241" y="1293" font-family="sans-serif" font-size="19" fill="#f4a2c8">#TWENTYX  &#8226;  Twenty works of art on X</text>',
 '</svg>'
 ].join('\n');
 fs.writeFileSync(slug,poster);
}

// Match the chosen visitor theme in downloadable brochures, retaining all
// twenty unchanged works via their existing self-contained collage PNG.
const {buildThemeBrochures}=await import('./build-theme-brochures.mjs');
await buildThemeBrochures(ordered);

console.log('Built TwentyX exhibition:',artists.length,'artist rooms;',artists.length*20,'works;',Buffer.byteLength(output),'bytes home');
