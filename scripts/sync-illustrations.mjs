import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, extname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const root=resolve(import.meta.dirname,'..');
const catalogText=await readFile(resolve(root,'public/catalog.json'),'utf8');
const catalog=JSON.parse(catalogText);
const ids=new Set(catalog.exercises.map(x=>x.id));
const reviews=JSON.parse(await readFile(resolve(root,'data/illustration-reviews.json'),'utf8'));
const directory=resolve(root,'data');
const assets={};
for(const filename of ['illustration-assets.json']) {
 const batch=JSON.parse(await readFile(resolve(directory,filename),'utf8'));
 for(const asset of batch.assets||[]) {
  const review=reviews[asset.exerciseId];
  if(!review||review.status!=='approved')continue;
  if(review.imagePath!==asset.imagePath)continue;
  if(!ids.has(asset.exerciseId))throw Error('Unknown exercise ID: '+asset.exerciseId);
  if(asset.status==='needs_review')throw Error('An image still needs review: '+asset.exerciseId);
  const image=resolve(root,asset.imagePath);
  const publicRoot=resolve(root,'public');
  if(!image.startsWith(resolve(publicRoot,'illustrations')+sep)||!['.png','.jpg','.jpeg','.webp'].includes(extname(image)))throw Error('Invalid image path');
  const bytes=await readFile(image);
  const digest=createHash('sha256').update(bytes).digest('hex');
  if(digest!==review.sha256)throw Error('Image changed since visual review: '+asset.exerciseId);
  if(!asset.stepsKo||asset.stepsKo.length!==2)throw Error('Missing two source-grounded captions');
  if(assets[asset.exerciseId])throw Error('Duplicate reviewed image: '+asset.exerciseId);
  assets[asset.exerciseId]={url:'/'+relative(publicRoot,image).split(sep).join('/'),panels:asset.panels||['준비 자세','동작 자세'],stepsKo:asset.stepsKo,generatedWith:asset.generatedWith,reviewedAt:review.reviewedAt};
  if(asset.exampleNoteKo)assets[asset.exerciseId].exampleNoteKo=asset.exampleNoteKo;
  if(asset.referenceLinks?.length)assets[asset.exerciseId].referenceLinks=asset.referenceLinks.filter(x=>/^https:\/\//.test(x.url)&&x.label).map(x=>({url:x.url,label:x.label}));
  assets[asset.exerciseId].license='CC-BY-SA-4.0';
  assets[asset.exerciseId].licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/';
 }
}
const catalogRevision=createHash('sha256').update(catalogText).digest('hex');
const revision=createHash('sha256').update(JSON.stringify(assets)+catalogRevision).digest('hex');
const manifest={version:2,revision,catalogRevision,totalExercises:catalog.exercises.length,approvedCount:Object.keys(assets).length,licenseNotice:'AI-generated and agent-reviewed illustrations. CC BY-SA 4.0 applies only to rights held by Move Atlas contributors; source rights are retained separately.',assets};
await writeFile(resolve(root,'public/illustrations/manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Published ${manifest.approvedCount} visually reviewed exercise illustrations; ${manifest.totalExercises-manifest.approvedCount} remain.`);
