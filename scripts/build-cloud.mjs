import {build} from 'esbuild';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await build({entryPoints:[resolve(root,'src/cloud.mjs')],outfile:resolve(root,process.argv.includes('--dist')?'dist/cloud.js':'public/cloud.js'),bundle:true,minify:true,format:'esm',platform:'browser',target:['es2022'],legalComments:'linked'});
