import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CURRENT_RELEASE,checkForUpdate,validateRelease,updateUrl} from '../public/app-lifecycle.mjs';
import {buildRelease} from '../scripts/build-release.mjs';

const release=(build='1234567890abcdef')=>({schema:1,version:'0.2.0',build,releasedAt:'2026-10-04T00:00:00.000Z',revision:'a'.repeat(40),assets:{app:`assets/app-${build}.js`,styles:'assets/styles-1234567890abcdef.css',training:'assets/training-1234567890abcdef.css',cloud:'assets/cloud-1234567890abcdef.js'}});
test('version checks distinguish the running build, including a new build with the same version',async()=>{
 const current=release();let request;
 const fetcher=async(...args)=>{request=args;return{ok:true,json:async()=>current};};
 assert.equal((await checkForUpdate(current,{base:'https://example.test/move-atlas/',fetcher,now:123})).available,false);
 assert.equal(request[0],'https://example.test/move-atlas/version.json?check=123');assert.equal(request[1].cache,'no-store');
 assert.equal((await checkForUpdate(release('abcdef1234567890'),{base:'https://example.test/move-atlas/',fetcher})).available,true);
});
test('failed and invalid update responses are never reported as current',async()=>{
 for(const fetcher of [async()=>({ok:false}),async()=>({ok:true,json:async()=>({version:'0.2.0'})}),async()=>{throw Error('offline');}])await assert.rejects(checkForUpdate(release(),{base:'https://example.test/',fetcher}));
 assert.throws(()=>validateRelease({...release(),assets:{...release().assets,app:'https://evil.test/app.js'}}));
 assert.throws(()=>validateRelease({...release(),build:'<script>'}));
});
test('update navigation stays on the current app origin/path and preserves unrelated URL parameters',()=>{
 const url=new URL(updateUrl(release(),'https://example.test/move-atlas/?foo=1#today',456));
 assert.equal(url.origin,'https://example.test');assert.equal(url.pathname,'/move-atlas/');assert.equal(url.searchParams.get('foo'),'1');assert.equal(url.searchParams.get('move-atlas-update'),release().build);assert.equal(url.searchParams.get('reload'),'456');assert.equal(url.hash,'#settings');
 assert.equal(CURRENT_RELEASE.build,'development');
});
test('release builds fingerprint code and styles, embed the running version, and keep dependency notices',async()=>{
 const root=await mkdtemp(join(tmpdir(),'move-atlas-release-')),out=join(root,'dist'),source=join(root,'public');
 try{
  await mkdir(source);await mkdir(out);await writeFile(join(root,'package.json'),JSON.stringify({version:'0.2.0'}));
  await writeFile(join(source,'app.js'),'import {CURRENT_RELEASE} from "./app-lifecycle.mjs"; console.log(CURRENT_RELEASE);');await cp(new URL('../public/app-lifecycle.mjs',import.meta.url),join(source,'app-lifecycle.mjs'));
  const originals={'styles.css':'body{color:red}','training.css':'.card{display:block}','screen.css':'.screen{display:flex}','cloud.js':'export const cloud=1;\n/*! For license information please see cloud.js.LEGAL.txt */','cloud.js.LEGAL.txt':'Apache notice','index.html':'<link href="./styles.css"><link href="./training.css"><link href="./screen.css"><script src="./app.js"></script>'};
  async function prepare(){for(const [name,value]of Object.entries(originals))await writeFile(join(out,name),value);await rm(join(out,'version.json'),{force:true});}
  await prepare();const options={root,out,revision:'a'.repeat(40),releasedAt:'2026-10-04T00:00:00Z'},first=await buildRelease(options);validateRelease(first);
  const html=await readFile(join(out,'index.html'),'utf8'),js=await readFile(join(out,first.assets.app),'utf8');
  assert.ok(html.includes(first.assets.app)&&html.includes(first.assets.styles)&&html.includes(first.assets.training)&&html.includes(first.assets.screen));assert.ok(!html.includes('./app.js'));assert.ok(js.includes(first.build)&&js.includes('0.2.0'));assert.equal(await readFile(join(out,'assets/cloud.js.LEGAL.txt'),'utf8'),'Apache notice');
  await prepare();const repeat=await buildRelease(options);assert.deepEqual(repeat,first);
  originals['screen.css']+=' .new-feature{color:blue}';await prepare();const next=await buildRelease(options);assert.notEqual(next.build,first.build);assert.notEqual(next.assets.screen,first.assets.screen);assert.notEqual(next.assets.app,first.assets.app);assert.equal(await readFile(join(out,first.assets.app),'utf8'),js);
 }finally{await rm(root,{recursive:true,force:true});}
});
