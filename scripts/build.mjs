import { cp, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {buildRelease} from './build-release.mjs';
const root = resolve(import.meta.dirname,'..');
for (const file of ['app.js','filters.mjs','urls.mjs','training.mjs','training-ui.mjs','training-store.mjs','app-lifecycle.mjs','personal-data.mjs','screen-ui.mjs','screen-state.mjs']) {
  const check = spawnSync(process.execPath,['--check',resolve(root,'public',file)],{stdio:'inherit'});
  if (check.status !== 0) process.exit(check.status || 1);
}
const data=JSON.parse(await readFile(resolve(root,'public/catalog.json'),'utf8'));
if (data.exercises.length !== data.meta.catalogTotal) throw Error('Catalog count mismatch');
const creditsCheck=spawnSync(process.execPath,[resolve(root,'scripts/build-credits.mjs')],{stdio:'inherit'});
if(creditsCheck.status!==0)process.exit(creditsCheck.status||1);
const imageCheck=spawnSync(process.execPath,[resolve(root,'scripts/validate-illustrations.mjs')],{stdio:'inherit'});
if(imageCheck.status!==0)process.exit(imageCheck.status||1);
await rm(resolve(root,'dist'),{recursive:true,force:true});
await cp(resolve(root,'public'),resolve(root,'dist'),{recursive:true});
const cloudBuild=spawnSync(process.execPath,[resolve(root,'scripts/build-cloud.mjs'),'--dist'],{stdio:'inherit'});
if(cloudBuild.status!==0)process.exit(cloudBuild.status||1);
await buildRelease({root});
const { stat, readdir }=await import('node:fs/promises');
async function bytes(path){let total=0;for(const entry of await readdir(path,{withFileTypes:true})){const p=resolve(path,entry.name);total+=entry.isDirectory()?await bytes(p):(await stat(p)).size;}return total;}
const totalBytes=await bytes(resolve(root,'dist'));
if(totalBytes>=1_000_000_000)throw Error('Site exceeds GitHub Pages size limit');
console.log(`Built ${data.exercises.length.toLocaleString('en-US')} exercises into dist/`);
console.log(`Published size: ${(totalBytes/1e6).toFixed(1)} MB`);
