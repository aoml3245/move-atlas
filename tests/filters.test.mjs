import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { matchesExercise,sortExercises,exercisePatterns } from '../public/filters.mjs';
const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url),'utf8'));
const state={region:'all',muscles:[],tools:[],availableOnly:false,includeSecondary:false,activity:'all',onlyFavorites:false,favorites:[],query:'',labels:{equipment:catalog.equipment,muscles:catalog.muscles}};
const sample={id:'x',name:'Dumbbell Bench Press',nameKo:'덤벨 벤치프레스',aliases:['DB Bench Press'],regions:['upper'],primaryMuscles:['chest'],secondaryMuscles:['triceps'],equipment:['dumbbell','bench'],activity:'strength',sources:[],needsReview:false};
test('available equipment requires every apparatus, including the bench',()=>{
 assert.equal(matchesExercise(sample,{...state,availableOnly:true,tools:['dumbbell']}),false);
 assert.equal(matchesExercise(sample,{...state,availableOnly:true,tools:['dumbbell','bench']}),true);
});
test('no equipment returns bodyweight, and excludes uncertain tools',()=>{
 assert.equal(matchesExercise({...sample,equipment:[]},{...state,availableOnly:true}),true);
 assert.equal(matchesExercise({...sample,equipment:['unknown']},{...state,availableOnly:true,tools:['unknown']}),false);
});
test('regions, muscles, query and equipment intersect rather than replace each other',()=>{
 const f={...state,region:'upper',muscles:['chest'],availableOnly:true,tools:['dumbbell','bench'],query:'덤벨 프레스'};
 assert.equal(matchesExercise(sample,f),true);
 assert.equal(matchesExercise(sample,{...f,region:'lower'}),false);
 assert.equal(matchesExercise(sample,{...f,muscles:['calves']}),false);
});
test('secondary muscle inclusion is explicit, and selected muscles use OR',()=>{
 assert.equal(matchesExercise(sample,{...state,muscles:['triceps']}),false);
 assert.equal(matchesExercise(sample,{...state,muscles:['triceps'],includeSecondary:true}),true);
 assert.equal(matchesExercise(sample,{...state,muscles:['calves','chest']}),true);
});
test('alias searches, favorites and empty result cases',()=>{
 assert.equal(matchesExercise(sample,{...state,query:'DB bench'}),true);
 assert.equal(matchesExercise(sample,{...state,onlyFavorites:true}),false);
 assert.equal(matchesExercise(sample,{...state,onlyFavorites:true,favorites:['x']}),true);
 assert.equal(matchesExercise(sample,{...state,query:'없는 운동 zz9988'}),false);
});
test('image availability combines with the same region and equipment filters',()=>{
 const illustrated={...sample,hasIllustration:true};
 assert.equal(matchesExercise(illustrated,{...state,withImages:true,region:'upper',availableOnly:true,tools:['bench','dumbbell']}),true);
 assert.equal(matchesExercise(illustrated,{...state,withImages:true,availableOnly:true,tools:['dumbbell']}),false);
 assert.equal(matchesExercise(sample,{...state,withImages:true}),false);
});
test('real catalog: dumbbell alone never admits a bench exercise',()=>{
 const matches=catalog.exercises.filter(x=>matchesExercise(x,{...state,availableOnly:true,tools:['dumbbell']}));
 assert.ok(matches.length>100);
 assert.ok(matches.some(x=>x.equipment.includes('dumbbell')));
 assert.ok(matches.every(x=>x.equipment.every(g=>g==='dumbbell')));
 const both=catalog.exercises.filter(x=>matchesExercise(x,{...state,region:'upper',muscles:['chest'],availableOnly:true,tools:['dumbbell','bench']}));
 assert.ok(both.some(x=>x.equipment.includes('bench')));
 assert.ok(both.every(x=>x.regions.includes('upper')&&x.primaryMuscles.includes('chest')));
});
test('source-defined ab wheel is not admitted by foam-roller availability',()=>{
 const wheel=catalog.exercises.find(x=>x.id==='ex_d712100462a093');
 assert.equal(matchesExercise(wheel,{...state,availableOnly:true,tools:['foam_roller']}),false);
 assert.equal(matchesExercise(wheel,{...state,availableOnly:true,tools:['ab_wheel']}),true);
});
test('all source records survive merging, with stable IDs and attribution',()=>{
 assert.equal(catalog.exercises.length,catalog.meta.catalogTotal);
 assert.equal(new Set(catalog.exercises.map(x=>x.id)).size,catalog.exercises.length);
 const origins=catalog.exercises.flatMap(x=>x.sources);
 assert.equal(origins.length,3506);
 assert.equal(new Set(origins.map(s=>s.source+':'+s.sourceId)).size,3506);
 assert.ok(origins.every(s=>s.name&&s.url.startsWith('https://')&&s.license));
 assert.equal(catalog.meta.inputTotal-catalog.meta.mergedAway,catalog.meta.catalogTotal);
});
test('sort is non-mutating and maintains complete filtered results',()=>{
 const before=catalog.exercises.slice(0,10);const ids=before.map(x=>x.id);
 const sorted=sortExercises(before,'korean');
 assert.deepEqual(before.map(x=>x.id),ids);
 assert.deepEqual(new Set(sorted.map(x=>x.id)),new Set(ids));
});
test('push/pull/legs recognize rear shoulders and hinges, and intersect with existing filters',()=>{
 const find=name=>catalog.exercises.find(x=>x.name===name);
 for(const name of ['Dumbbell Bench Press','Dumbbell Shoulder Press','Triceps Pushdown - Rope Attachment'])assert.deepEqual(exercisePatterns(find(name)),['push']);
 for(const name of ['Reverse Fly','Cross Body Hammer Curl','Lat Pulldown'])assert.deepEqual(exercisePatterns(find(name)),['pull']);
 assert.deepEqual(exercisePatterns(catalog.exercises.find(x=>x.id==='ex_76c72fa0cd7d75')),['pull']);
 for(const name of ['Barbell Deadlift','Romanian Deadlift','Reverse Nordic Curl'])assert.deepEqual(exercisePatterns(find(name)),['legs']);
 assert.deepEqual(exercisePatterns(find('Plank')),[]);assert.deepEqual(exercisePatterns({...sample,activity:'stretching'}),[]);
 assert.equal(matchesExercise(sample,{...state,movementView:'push',tools:['dumbbell','bench'],availableOnly:true}),true);
 assert.equal(matchesExercise(sample,{...state,movementView:'push',tools:['dumbbell'],availableOnly:true}),false);
 assert.equal(matchesExercise(sample,{...state,movementView:'pull'}),false);
 assert.deepEqual(exercisePatterns({...sample,name:'Pushups',movement:'pushup',primaryMuscles:['biceps','lats','chest','upper_back','triceps']}),['push']);
 assert.deepEqual(exercisePatterns({...sample,name:'Chest Dip (on dip-pull-up cage)',movement:'dip'}),['push']);
});
