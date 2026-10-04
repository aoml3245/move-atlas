// SPDX-License-Identifier: AGPL-3.0-only
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex').slice(0,16);
export async function buildRelease({root=resolve(import.meta.dirname,'..'),out=resolve(root,'dist'),revision,releasedAt}={}){
 revision??=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 releasedAt??=new Date(execFileSync('git',['show','-s','--format=%cI','HEAD'],{cwd:root,encoding:'utf8'}).trim()).toISOString();
 const {version}=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
 // A release identity is stable across local/CI builds of the same commit and inputs.
 const hash=createHash('sha256').update(version).update(revision);
 for(const name of (await readdir(out)).sort())if(/\.(?:js|mjs|css|html|json|txt)$/.test(name)){hash.update(name);hash.update(await readFile(resolve(out,name)));}
 const release={schema:1,version,build:hash.digest('hex').slice(0,16),releasedAt,revision,assets:{}};
 const assets=resolve(out,'assets');await mkdir(assets,{recursive:true});
 for(const [key,name]of [['styles','styles.css'],['training','training.css'],['screen','screen.css'],['cloud','cloud.js']]){
  const bytes=await readFile(resolve(out,name)),ext=name.split('.').at(-1),file=`assets/${key}-${digest(bytes)}.${ext}`;release.assets[key]=file;await writeFile(resolve(out,file),bytes);
 }
 // Retain the linked dependency license next to the fingerprinted cloud module.
 await cp(resolve(out,'cloud.js.LEGAL.txt'),resolve(assets,'cloud.js.LEGAL.txt'));
 release.assets.app=`assets/app-${release.build}.js`;
 await build({entryPoints:[resolve(root,'public/app.js')],outfile:resolve(out,release.assets.app),bundle:true,minify:true,format:'esm',platform:'browser',target:['es2022'],define:{__MOVE_ATLAS_RELEASE__:JSON.stringify(release)},legalComments:'inline'});
 let html=await readFile(resolve(out,'index.html'),'utf8');
 html=html.replace('./styles.css','./'+release.assets.styles).replace('./training.css','./'+release.assets.training).replace('./screen.css','./'+release.assets.screen).replace('./app.js','./'+release.assets.app);
 await writeFile(resolve(out,'index.html'),html);await writeFile(resolve(out,'version.json'),JSON.stringify(release,null,2)+'\n');
 console.log(`Release v${version} · ${release.build}`);return release;
}
