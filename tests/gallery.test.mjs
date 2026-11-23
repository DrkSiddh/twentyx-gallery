import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const archive=JSON.parse(readFileSync('data/collections.json','utf8'));
const original=JSON.parse(readFileSync('artists.json','utf8'));
const ids=data=>data.map(a=>a.postUrl.match(/\/status\/(\d+)/)?.[1]);
const handle=url=>new URL(url).pathname.split('/')[1];
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'twentyx-test-'));
 mkdirSync(join(dir,'data'),{recursive:true});
 mkdirSync(join(dir,'scripts'),{recursive:true});
 writeFileSync(join(dir,'data/collections.json'),JSON.stringify(archive));
 writeFileSync(join(dir,'artists.json'),JSON.stringify(original));
 writeFileSync(join(dir,'data/inbox.json'),'[]');
 writeFileSync(join(dir,'scripts/publish.mjs'),readFileSync('scripts/publish.mjs'));
 writeFileSync(join(dir,'scripts/withdrawals.mjs'),readFileSync('scripts/withdrawals.mjs'));
 writeFileSync(join(dir,'data/withdrawn-artists.json'),readFileSync('data/withdrawn-artists.json'));
 const run=env=>spawnSync(process.execPath,['scripts/publish.mjs'],{cwd:dir,encoding:'utf8',env:{...process.env,...env}});
 const get=path=>JSON.parse(readFileSync(join(dir,path),'utf8'));
 const cleanup=()=>rmSync(dir,{force:true,recursive:true});
 return {dir,run,get,cleanup};
}
test('published records contain exactly twenty distinct full-media URLs',()=>{
 assert.ok(original.length>0);
 assert.equal(new Set(ids(original)).size,original.length);
 original.forEach(a=>{
  assert.equal(a.media.length,20,a.name);
  assert.equal(new Set(a.media).size,20,a.name);
  assert.ok(handle(a.postUrl),a.name);
  assert.ok(a.media.every(x=>x.startsWith('https://pbs.twimg.com/media/')),a.name);
 });
});
test('publisher preserves all existing collections on repeated runs',()=>{
 const f=fixture();
 try{
  assert.equal(f.run().status,0);
  assert.equal(f.get('artists.json').length,original.length);
  assert.equal(f.run().status,0);
  assert.deepEqual(new Set(ids(f.get('artists.json'))),new Set(ids(original)));
 }finally{f.cleanup()}
});
test('publisher refuses a one-image submission without overwriting anything',()=>{
 const f=fixture();
 try{
  const broken={...original[0],postUrl:'https://x.com/example/status/99999999999999999',media:[original[0].media[0]]};
  writeFileSync(join(f.dir,'data/inbox.json'),JSON.stringify([broken]));
  const before=readFileSync(join(f.dir,'artists.json'),'utf8');
  const result=f.run();
  assert.notEqual(result.status,0);
  assert.equal(readFileSync(join(f.dir,'artists.json'),'utf8'),before);
 }finally{f.cleanup()}
});
test('publisher merges new eligible records, deduplicates, and never shrinks',()=>{
 const f=fixture();
 try{
  const added={...original[0],name:'New Contributor',postUrl:'https://x.com/newartist/status/99999999999999999'};
  writeFileSync(join(f.dir,'data/inbox.json'),JSON.stringify([added,added]));
  assert.equal(f.run().status,0);
  assert.equal(f.get('artists.json').length,original.length+1);
  assert.ok(f.get('data/collections.json').some(a=>a.name==='New Contributor'));
  writeFileSync(join(f.dir,'data/inbox.json'),'[]');
  assert.equal(f.run().status,0);
  assert.equal(f.get('artists.json').length,original.length+1);
 }finally{f.cleanup()}
});

test('maintainer-approved withdrawals remove the work and prevent later republication',()=>{
 const f=fixture();
 try{
  const artist=original[0];
  const artistHandle=handle(artist.postUrl).toLowerCase();
  const postId=ids([artist])[0];
  const approval=join(f.dir,'approval.json');
  writeFileSync(approval,JSON.stringify([[{
   body:'@someone_else',
   labels:[{name:'withdraw:@'+artistHandle}]
  }]]));
  mkdirSync(join(f.dir,'@'+artistHandle));
  writeFileSync(join(f.dir,'@'+artistHandle,'index.html'),'unpublished page');
  mkdirSync(join(f.dir,'welcome'));
  const brochure=join(f.dir,'welcome',artistHandle+'-'+postId+'--analog.png');
  writeFileSync(brochure,'unpublished brochure');
  assert.equal(f.run({TWENTYX_APPROVALS_FILE:approval}).status,0);
  assert.deepEqual(ids(f.get('artists.json')),ids(original).filter(id=>id!==postId));
  assert.throws(()=>readFileSync(join(f.dir,'@'+artistHandle,'index.html')), {code:'ENOENT'});
  assert.throws(()=>readFileSync(brochure), {code:'ENOENT'});
  const {publishedAt,...report}=f.get('data/removal-report.json');
  assert.ok(publishedAt);
  assert.deepEqual(report,{artistsRemoved:1,collectionsRemoved:1,artworksRemoved:20});
  writeFileSync(join(f.dir,'data/inbox.json'),JSON.stringify([artist]));
  assert.equal(f.run().status,0);
  assert.ok(!ids(f.get('artists.json')).includes(postId));
  assert.deepEqual(f.get('data/inbox.json'),[]);
 }finally{f.cleanup()}
});
