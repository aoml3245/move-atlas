import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';

// This command records an explicit visual review; it never chooses candidates.
const args=process.argv.slice(2);
const id=args[args.indexOf('--id')+1];
const notes=args[args.indexOf('--notes')+1];
if(!args.includes('--id')||!args.includes('--notes')||!/^ex_[a-f0-9]+$/.test(id)||!notes?.trim())throw Error('Provide --id and the visual reviewer\'s --notes');
const root=resolve(import.meta.dirname,'..');
const catalog=JSON.parse(await readFile(resolve(root,'public/catalog.json'),'utf8'));
if(!catalog.exercises.some(x=>x.id===id))throw Error('Unknown exercise ID');
const reviewPath=resolve(root,'work/illustration-reviews.json');
const reviews=JSON.parse(await readFile(reviewPath,'utf8'));
if(reviews[id]?.status==='approved')throw Error('This exercise already has a reviewed image');
const record=JSON.parse(await readFile(resolve(root,'work/illustration-campaign/records',id+'.json'),'utf8'));
if(record.exerciseId!==id||!['generated','needs_review'].includes(record.status)||!Array.isArray(record.stepsKo)||record.stepsKo.length!==2||!record.stepsKo.every(x=>typeof x==='string'&&x.trim())||!Array.isArray(record.panels)||record.panels.length!==2||!record.panels.every(x=>typeof x==='string'&&x.trim())||!record.prompt)throw Error('Candidate metadata incomplete');
if(record.humanReviewed===true)throw Error('Agent visual review must not be marked as human-reviewed');
if(record.status==='needs_review'&&!args.includes('--resolve-concern'))throw Error('Resolve the documented concern before visual approval');
const source=resolve(root,record.imagePath);
if(!source.startsWith(resolve(root,'work/illustration-campaign/candidates')+sep)||!source.endsWith('.png'))throw Error('Candidate path outside work queue');
const bytes=await readFile(source);
if(bytes.length<1000)throw Error('Missing raster image');
const digest=createHash('sha256').update(bytes).digest('hex');
if(Object.values(reviews).some(x=>x.status==='approved'&&x.sha256===digest))throw Error('Image reused for another exercise');
const imagePath='public/illustrations/'+id+'.png';
const target=resolve(root,imagePath);
try {await copyFile(source,target,constants.COPYFILE_EXCL);}catch(error){
 if(error.code!=='EEXIST'||createHash('sha256').update(await readFile(target)).digest('hex')!==digest)throw error;
}
const batchPath=resolve(root,'work/illustration-batches/campaign-approved.json');
let batch={assets:[]};
try{batch=JSON.parse(await readFile(batchPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(batch.assets.some(x=>x.exerciseId===id))throw Error('Duplicate batch exercise');
batch.assets.push({...record,humanReviewed:false,status:'generated',candidateReviewStatus:record.status,candidateImagePath:record.imagePath,imagePath,parentReviewNotes:notes});
await writeFile(batchPath,JSON.stringify(batch,null,2)+'\n');
reviews[id]={status:'approved',imagePath,sha256:digest,reviewedAt:new Date().toISOString(),reviewer:'parent-visual-review',notes};
await writeFile(reviewPath,JSON.stringify(reviews,null,2)+'\n');
console.log('Recorded visual approval for '+id+'. Run illustrations:sync to publish.');
