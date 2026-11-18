#!/usr/bin/env node
/**
 * Produce fully downloadable themed brochures using actual TwentyX artwork.
 * Art pixels are extracted WITHOUT recoloring from the existing (verified)
 * exhibition brochure PNG, then placed on a freshly themed page.
 * The art mosaic is never AI-generated, fabricated or recolored.
 * Only brochure furniture / backdrop changes. Source colorway images are
 * taken from user-supplied case-sensitive Themes/ folder.
 */
import fs from 'node:fs';
import sharp from 'sharp';
import QRCode from 'qrcode';
import {pathToFileURL} from 'node:url';

const THEMES={
 violet:{name:'ArtVision Violet',bg:'#160b27',deep:'#311342',frame:'#ce99ec',text:'#fcf4ff',muted:'#e8d5f0',accent:'#d7a7f9',reference:null},
 analog:{name:'Analog Nostalgia',bg:'#241425',deep:'#5a2349',frame:'#f7a48f',text:'#fff4e5',muted:'#f6d7d2',accent:'#f6ba8b',reference:'Themes/Analog Nostalgia/Analog Nostalgia Colorways/TwentyX Daylight.png'},
 heritage:{name:'Minimalist Heritage',bg:'#151221',deep:'#332a48',frame:'#c3a8de',text:'#f6f2fd',muted:'#d4c9e0',accent:'#d7c4ea',reference:'Themes/Minimalist Heritage/Minimalist Heritage_Colorways/TwentyX GM.png'}
};
const safe=str=>String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&apos;");
const idOf=a=>String(a.postUrl||'').match(/\/status\/(\d+)\/?$/)?.[1];
const handleOf=a=>new URL(a.postUrl).pathname.split('/')[1].toLowerCase();
async function renderThemeBrochure(artist,theme,mosaic){
 const color=THEMES[theme],handle=handleOf(artist),id=idOf(artist);
 if(!color||!mosaic)throw Error('Invalid brochure theme or original mosaic');
 const bg=color.reference?fs.readFileSync(color.reference).toString('base64'):null;
 const qr=(await QRCode.toDataURL('https://twentyx.artvision.today/@'+handle+'/',{
  margin:2,errorCorrectionLevel:'H',width:156,color:{dark:color.bg,light:'#ffffff'}
 })).split(',')[1];
 const name=safe(artist.name),titleSize=artist.name.length>32?33:artist.name.length>20?43:artist.name.length>12?51:69;
 const svg=[
 '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">',
 '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+color.bg+'"/><stop offset=".58" stop-color="'+color.deep+'"/><stop offset="1" stop-color="'+color.bg+'"/></linearGradient></defs>',
 '<rect width="1080" height="1350" fill="url(#bg)"/>',
 bg?'<image x="-1" y="-1" width="1082" height="1352" preserveAspectRatio="xMidYMid slice" opacity=".24" href="data:image/png;base64,'+bg+'"/>':'',
 '<rect width="1080" height="1350" fill="'+color.bg+'" opacity=".73"/>',
 '<path d="M0 8H1080" stroke="'+color.accent+'" stroke-width="15"/>',
 '<rect x="22" y="22" width="1036" height="1306" rx="10" fill="none" stroke="'+color.frame+'" stroke-opacity=".61"/>',
 '<text x="64" y="73" font-family="sans-serif" font-size="21" font-weight="bold" letter-spacing="4" fill="'+color.accent+'">ARTVISION / '+safe(color.name).toUpperCase()+'</text>',
 '<text x="62" y="183" font-family="sans-serif" font-size="113" font-weight="800" letter-spacing="-4" fill="'+color.text+'">TWENTYX</text>',
 '<line x1="65" y1="208" x2="1015" y2="208" stroke="'+color.frame+'" stroke-opacity=".65"/>',
 '<text x="65" y="253" font-family="sans-serif" font-size="21" letter-spacing="3" fill="'+color.accent+'">AN ARTIST-CURATED EXHIBITION</text>',
 '<text x="65" y="333" font-family="sans-serif" font-size="'+titleSize+'" font-weight="bold" fill="'+color.text+'">CURATED BY '+name+'</text>',
 '<text x="68" y="367" font-family="sans-serif" font-size="21" fill="'+color.muted+'">@'+safe(handle)+'   /   20 WORKS   /   '+safe(artist.date||'')+'</text>',
 '<rect x="64" y="387" width="952" height="755" rx="10" fill="'+color.bg+'" stroke="'+color.frame+'" stroke-opacity=".62" stroke-width="2"/>',
 // Extracted 20-artwork mosaic from the existing actual-art brochure, untouched.
 '<image x="76" y="399" width="928" height="741" href="data:image/png;base64,'+mosaic.toString('base64')+'"/>',
 '<rect x="65" y="1168" width="146" height="146" rx="5" fill="#ffffff"/>',
 '<image x="67" y="1170" width="142" height="142" href="data:image/png;base64,'+qr+'"/>',
 '<text x="243" y="1213" font-family="sans-serif" font-size="26" font-weight="bold" fill="'+color.text+'">TwentyX Presented By ArtVision</text>',
 '<text x="243" y="1250" font-family="sans-serif" font-size="21" fill="'+color.muted+'">Scan to see all 20 artworks in full size.</text>',
 '<text x="243" y="1290" font-family="sans-serif" font-size="18" letter-spacing="2" fill="'+color.accent+'">#TWENTYX  &#8226;  '+safe(color.name).toUpperCase()+'</text>',
 '</svg>'
 ].join('\n');
 const base='welcome/'+handle+'-'+id+'--'+theme;
 fs.writeFileSync(base+'.svg',svg);
 const png=await sharp(Buffer.from(svg)).png({compressionLevel:8}).toBuffer();
 fs.writeFileSync(base+'.png',png);
 return base;
}
export async function buildThemeBrochures(artists){
 let generated=0,withoutSource=[];
 for(const artist of artists){
  const base='welcome/'+handleOf(artist)+'-'+idOf(artist);
  if(!fs.existsSync(base+'.png')){withoutSource.push(handleOf(artist));continue}
  const pngBytes=fs.readFileSync(base+'.png');
  let mosaic;
  try{
   mosaic=await sharp(pngBytes).extract({left:76,top:399,width:928,height:741}).png().toBuffer();
  }catch(e){withoutSource.push(handleOf(artist)+': '+e.message);continue}
  for(const theme of Object.keys(THEMES)){
   const svgName=base+'--'+theme+'.svg',pngName=base+'--'+theme+'.png';
   if(fs.existsSync(svgName)&&fs.existsSync(pngName))continue;
   await renderThemeBrochure(artist,theme,mosaic);
   generated++;
  }
 }
 console.log('Themed brochures ready:',generated,'new theme editions; original 20-work PNG unavailable for',withoutSource.length,'artists');
 if(withoutSource.length)console.warn('Themed brochure fallback to original edition:',withoutSource.join(', '));
 return {generated,withoutSource};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const artists=JSON.parse(fs.readFileSync('artists.json','utf8'));
 buildThemeBrochures(artists).catch(e=>{console.error(e);process.exitCode=1});
}
