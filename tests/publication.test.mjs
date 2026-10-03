import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assetUrl } from '../public/urls.mjs';
const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url)));

test('assets and licenses resolve below a GitHub Pages project path',()=>{
  const base='https://aoml3245.github.io/move-atlas/';
  assert.equal(assetUrl('/illustrations/ex_abc.webp',base),base+'illustrations/ex_abc.webp');
  assert.equal(assetUrl('/licenses/liftosaur.txt',base),base+'licenses/liftosaur.txt');
  assert.equal(assetUrl('/catalog.json','http://127.0.0.1:5174/'),'http://127.0.0.1:5174/catalog.json');
  assert.equal(assetUrl('https://creativecommons.org/licenses/by-sa/4.0/',base),'https://creativecommons.org/licenses/by-sa/4.0/');
});
test('wger attribution survives merging and retains translation license differences',()=>{
  const records=catalog.exercises.flatMap(x=>x.sources).filter(s=>s.source==='wger');
  assert.equal(records.length,914);
  for(const record of records){
    assert.ok(record.author||record.authorStatus==='not-supplied-by-upstream');
    assert.ok(record.credits.length);
    for(const credit of record.credits){assert.ok(credit.authors.length||credit.authorStatus==='not-supplied-by-upstream');assert.match(credit.licenseUrl,/^https:\/\/creativecommons.org\//);}
  }
  for(const sourceId of ['2478','2549','2555','2557','2564']){
    const exercise=catalog.exercises.find(x=>x.sources.some(s=>s.source==='wger'&&s.sourceId===sourceId));
    if(exercise.originalInstructions?.source==='wger')assert.equal(exercise.originalInstructions.license,'CC-BY-SA-4.0');
    assert.ok(exercise.sources.find(s=>s.sourceId===sourceId).credits.some(c=>c.languageId===2&&c.license==='CC-BY-SA-4.0'));
  }
});
