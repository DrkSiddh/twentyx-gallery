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
 const run=()=>spawnSync(process.execPath,['scripts/publish.mjs'],{cwd:dir,encoding:'utf8'});
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
