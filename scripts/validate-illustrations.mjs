import { readFile, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

const root=resolve(import.meta.dirname,'..');
const publicRoot=resolve(root,'public');
const catalog=JSON.parse(await readFile(resolve(publicRoot,'catalog.json'),'utf8'));
const manifest=JSON.parse(await readFile(resolve(publicRoot,'illustrations/manifest.json'),'utf8'));
const reviews=JSON.parse(await readFile(resolve(root,'data/illustration-reviews.json'),'utf8'));
const ids=new Set(catalog.exercises.map(x=>x.id));
if(manifest.totalExercises!==catalog.exercises.length||manifest.approvedCount!==Object.keys(manifest.assets).length)throw Error('Illustration count mismatch');
if(manifest.approvedCount!==catalog.exercises.length)throw Error('Public release must include every exercise illustration');
if(manifest.catalogRevision!==createHash('sha256').update(await readFile(resolve(publicRoot,'catalog.json'))).digest('hex'))throw Error('Image manifest references an older catalog');
const hashes=new Set();
const publishedFiles=new Set();
for(const [id,asset] of Object.entries(manifest.assets)) {
 if(!ids.has(id)||reviews[id]?.status!=='approved')throw Error('Unreviewed or invalid exercise illustration');
 if(!/^\/illustrations\/ex_[a-f0-9]+(?:-v[0-9]+)?\.(png|jpe?g|webp)$/.test(asset.url))throw Error('Invalid illustration URL');
 const path=resolve(publicRoot,'.'+asset.url);
 if(reviews[id].imagePath!=='public'+asset.url)throw Error('Illustration path differs from selected review');
 publishedFiles.add(asset.url.slice('/illustrations/'.length));
 if(!path.startsWith(publicRoot+sep))throw Error('Unsafe illustration path');
 const bytes=await readFile(path);
 if(bytes.length<1000)throw Error('Exercise raster image is missing or too small');
 const digest=createHash('sha256').update(bytes).digest('hex');
 if(digest!==reviews[id].sha256)throw Error('Image changed after verified delivery encoding');
 if(!/^[a-f0-9]{64}$/.test(reviews[id].sourceReview?.sha256||'')||!reviews[id].sourceReview?.reviewedAt)throw Error('Original visual review provenance is missing');
 if(hashes.has(digest))throw Error('One image was reused for a different exercise');
 hashes.add(digest);
 if(asset.stepsKo?.length!==2||asset.panels?.length!==2)throw Error('Exercise illustration must explain two poses');
}
for(const filename of await readdir(resolve(publicRoot,'illustrations'))) {
 if(/\.(png|jpe?g|webp)$/i.test(filename)&&!publishedFiles.has(filename))throw Error('Unpublished image must be kept in work/: '+filename);
}
console.log(`Verified ${manifest.approvedCount} unique delivery images and original visual-review provenance.`);
