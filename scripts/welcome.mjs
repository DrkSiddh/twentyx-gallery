#!/usr/bin/env node
/**
 * TwentyX exhibition invitation brochure.
 * Makes a PNG and self-contained SVG of the artist's REAL 20 images with QR.
 * Source media is hotlinked for retrieval, never modified on X or invented.
 * If any media cannot be fetched, we do not publish an incomplete brochure.
 */
import fs from 'node:fs';
import sharp from 'sharp';
import QRCode from 'qrcode';
import {pathToFileURL} from 'node:url';
const ROOT='https://twentyx.artvision.today/';
const W=1080,H=1350;
const ESC=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const idOf=a=>a.postId||a.postUrl.match(/\/status\/(\d+)/)?.[1];
const handleOf=a=>a.handle||new URL(a.postUrl).pathname.split('/')[1];
const escapeFilename=s=>s.replace(/[^a-zA-Z0-9_]/g,'').slice(0,15).toLowerCase();
const isPhotoUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='pbs.twimg.com'&&u.pathname.startsWith('/media/')}catch{return false}};
async function getThumb(url){
 if(!isPhotoUrl(url))throw Error('Non-X media URL');
 const u=new URL(url);
 u.searchParams.set('name','small');
 const response=await fetch(u,{signal:AbortSignal.timeout(18000)});
 if(!response.ok)throw Error('Media HTTP '+response.status);
 if(!String(response.headers.get('content-type')||'').startsWith('image/'))throw Error('Media is not an image');
 const length=Number(response.headers.get('content-length')||0);
 if(length>8_000_000)throw Error('Image too large');
 const input=Buffer.from(await response.arrayBuffer());
 if(input.length>8_000_000)throw Error('Image too large');
 return sharp(input).rotate().resize(180,180,{fit:'contain',background:'#151827'}).jpeg({quality:80,mozjpeg:true}).toBuffer();
}
function backdrop(){
 return [
 '<defs>',
 '<linearGradient id="chrome" x1="0%" y1="10%" x2="95%" y2="90%"><stop offset="0%" stop-color="#fee5f7"/><stop offset="23%" stop-color="#f4a2c8"/><stop offset="48%" stop-color="#ffffff"/><stop offset="66%" stop-color="#9bb8e5"/><stop offset="83%" stop-color="#d39dd9"/><stop offset="100%" stop-color="#fff0d9"/></linearGradient>',
 '<linearGradient id="night" x1="0" x2="1" y2="1"><stop stop-color="#0b102b"/><stop offset=".52" stop-color="#281a41"/><stop offset="1" stop-color="#090d20"/></linearGradient>',
 '<radialGradient id="halo"><stop stop-color="#dc84cb" stop-opacity=".3"/><stop offset="1" stop-color="#dc84cb" stop-opacity="0"/></radialGradient>',
 '</defs>',
 '<rect width="1080" height="1350" fill="url(#night)"/>',
 '<circle cx="925" cy="120" r="450" fill="url(#halo)"/>',
 '<path d="M0 7 H1080" stroke="url(#chrome)" stroke-width="14"/>',
 '<rect x="21" y="21" width="1038" height="1308" rx="6" fill="none" stroke="#f4a2c8" stroke-opacity=".33" stroke-width="1"/>'
 ].join('\n');
}
export async function makeBrochure(a,{loadImage=getThumb}={}){
 if(!a||!Array.isArray(a.media)||a.media.length!==20||new Set(a.media).size!==20)throw Error('Must have 20 distinct original works');
 const id=idOf(a);const handle=handleOf(a);
 if(!/^\d+$/.test(id)||!/^[a-z0-9_]{1,15}$/i.test(handle))throw Error('Invalid artist URL');
 const tiles=await Promise.all(a.media.map(loadImage));
 if(tiles.some(b=>!Buffer.isBuffer(b)))throw Error('Incomplete media retrieval');
 const code=await QRCode.toDataURL(ROOT+'?artist='+id,{margin:2,errorCorrectionLevel:'H',width:170,color:{dark:'#151329',light:'#ffffff'}});
 const qrBase64=code.split(',')[1];
 const name=ESC(a.name),at=ESC(handle);
 const titleSize=a.name.length>26?36:a.name.length>18?44:a.name.length>12?52:68;
 const font='font-family="Inter,DejaVu Sans,sans-serif"';
 const lines=[
 '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'">',
 backdrop(),
 '<text x="65" y="79" '+font+' font-size="20" font-weight="750" letter-spacing="5" fill="#f4a2c8">ARTVISION PRESENTS     /     A MULTIDIMENSIONAL EXHIBITION</text>',
 '<text x="62" y="181" font-family="Dune Rise,Inter,sans-serif" font-weight="900" font-size="109" letter-spacing="-4" fill="url(#chrome)">TWENTYX</text>',
 '<line x1="66" y1="206" x2="1014" y2="206" stroke="#f4a2c8" stroke-opacity=".45"/>',
 '<text x="65" y="249" '+font+' font-size="17" font-weight="700" letter-spacing="5" fill="#f4a2c8">WELCOME TO THE EXHIBITION</text>',
 '<text x="62" y="329" '+font+' font-size="'+titleSize+'" font-weight="850" fill="#fff7fb">CURATED BY '+name+'.</text>',
 '<text x="68" y="359" '+font+' font-size="23" fill="#d4c7de">@'+at+'     ·     20 / 20 WORKS     ·     '+ESC(a.date||'')+'</text>',
 '<rect x="64" y="386" width="952" height="756" rx="11" fill="#100e20" stroke="#ffffff" stroke-opacity=".15" stroke-width="2"/>'
 ];
 const left=76,top=399,size=180,gap=7;
 for(let i=0;i<20;i++){
  const x=left+(i%5)*(size+gap),y=top+Math.floor(i/5)*(size+gap);
  lines.push('<rect x="'+(x-2)+'" y="'+(y-2)+'" width="'+(size+4)+'" height="'+(size+4)+'" rx="5" fill="#252136" stroke="#ffffff" stroke-opacity=".10"/>');
  lines.push('<image x="'+x+'" y="'+y+'" width="'+size+'" height="'+size+'" href="data:image/jpeg;base64,'+tiles[i].toString('base64')+'"/>');
  lines.push('<text x="'+(x+8)+'" y="'+(y+size-9)+'" '+font+' font-size="13" font-weight="700" fill="#ffffff" stroke="#000000" stroke-width="2" paint-order="stroke">'+String(i+1).padStart(2,'0')+'</text>');
 }
 lines.push(
 '<image x="65" y="1168" width="146" height="146" href="data:image/png;base64,'+qrBase64+'"/>',
 '<text x="243" y="1211" '+font+' font-size="24" font-weight="800" fill="#fff6fa">TwentyX Presented By ArtVision</text>',
 '<text x="243" y="1248" '+font+' font-size="22" fill="#d7d0e5">Scan to explore the full size exhibition.</text>',
 '<text x="243" y="1286" '+font+' font-size="18" font-weight="700" letter-spacing="2" fill="#f4a2c8">#TWENTYX  &#8226;  Twenty works of art on X</text>',
 '<line x1="65" y1="1320" x2="1015" y2="1320" stroke="#e2acd2" stroke-opacity=".5"/>',
 '</svg>');
 const svg=lines.join('\n');
 const png=await sharp(Buffer.from(svg)).png({compressionLevel:8}).toBuffer();
 return {svg,png,name:escapeFilename(handle)+'-'+id};
}
export async function generate(){
 const entries=JSON.parse(fs.readFileSync('artists.json','utf8'));
 const previousFile='data/previous-posts.json';
 const previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile,'utf8')):[];
 // A prior ID should only suppress creation if a new style PNG actually exists.
 const prior=new Set(previous);
 fs.mkdirSync('welcome',{recursive:true});
 let created=0,failed=0;
 for(const a of entries){
  const id=idOf(a);
  if(!id)continue;
  const filename=escapeFilename(handleOf(a))+'-'+id;
  const pngPath='welcome/'+filename+'.png';
  const svgPath='welcome/'+filename+'.svg';
  if(prior.has(id)&&fs.existsSync(pngPath)&&fs.existsSync(svgPath))continue;
  try{
   const poster=await makeBrochure(a);
   fs.writeFileSync(svgPath,poster.svg);
   fs.writeFileSync(pngPath,poster.png);
   console.log('Collector brochure:',filename+'.png');
   created++;
  }catch(e){
   failed++;
   console.warn('Brochure deferred for '+handleOf(a)+': '+e.message);
  }
 }
 const completed=entries.filter(a=>{
  const file='welcome/'+escapeFilename(handleOf(a))+'-'+idOf(a);
  return fs.existsSync(file+'.png')&&fs.existsSync(file+'.svg');
 }).map(idOf);
 fs.writeFileSync(previousFile,JSON.stringify(completed,null,2)+'\n');
 console.log('Brochures created='+created+' deferred='+failed+' saved='+completed.length);
 // Never fail publication because X media CDN is temporarily unavailable.
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 generate().catch(e=>{console.error(e);process.exitCode=1});
}
