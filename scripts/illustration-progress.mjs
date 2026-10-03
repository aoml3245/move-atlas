import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const catalog=JSON.parse(await readFile(resolve(root,'public/catalog.json'),'utf8'));
const manifest=JSON.parse(await readFile(resolve(root,'public/illustrations/manifest.json'),'utf8'));
const campaign=JSON.parse(await readFile(resolve(root,'work/illustration-campaign/campaign.json'),'utf8'));
const sourceJobs=JSON.parse(await readFile(resolve(root,'work/illustration-campaign/source-review.json'),'utf8')).jobs;
const ids=new Set(catalog.exercises.map(x=>x.id));
const approved=new Set(Object.keys(manifest.assets));
const candidates=new Set(), resolvedSources=new Set();
for(const [folder,kind] of [['records','candidate'],['source-resolutions','source']]){
 const directory=resolve(root,'work/illustration-campaign',folder);
 let files=[];try{files=await readdir(directory);}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const file of files.filter(x=>x.endsWith('.json'))){
  let record;try{record=JSON.parse(await readFile(resolve(directory,file),'utf8'));}catch{continue;}
  if(!ids.has(record.exerciseId)||approved.has(record.exerciseId))continue;
  if(kind==='source'&&record.status==='resolved')resolvedSources.add(record.exerciseId);
  if(kind==='candidate'&&record.status==='generated'){
   const path=resolve(root,record.imagePath||'');
   if(!path.startsWith(resolve(root,'work/illustration-campaign/candidates')+sep))continue;
   try{if((await stat(path)).size>1000)candidates.add(record.exerciseId);}catch{}
  }
 }
}
const sourceCheckCount=sourceJobs.filter(x=>!approved.has(x.exerciseId)&&!resolvedSources.has(x.exerciseId)).length;
const progress={version:1,scope:'all-exercises',total:catalog.exercises.length,approved:approved.size,awaitingVisualReview:candidates.size,sourceCheckCount,remaining:catalog.exercises.length-approved.size,status:approved.size===catalog.exercises.length?'complete':campaign.status||'running',updatedAt:new Date().toISOString()};
await writeFile(resolve(root,'public/illustrations/progress.json'),JSON.stringify(progress,null,2)+'\n');
console.log(JSON.stringify(progress));
