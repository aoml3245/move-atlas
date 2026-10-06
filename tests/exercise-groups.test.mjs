// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createExerciseIndex,matchingGroups,resolveMaxima,variantLabel,groupExerciseName,equipmentKey,equipmentOptions,conditionLabel,chooseEquipmentVariant} from '../public/exercise-groups.mjs';
import {DEFAULT_PROFILE,makeExercise,exerciseCandidate,buildRoutine,lastProgress,dayKey} from '../public/training.mjs';
const bytes=await readFile(new URL('../public/catalog.json',import.meta.url));
const catalog=JSON.parse(bytes),payload=JSON.parse(await readFile(new URL('../public/exercise-groups.json',import.meta.url)));
catalog.exercises.forEach(x=>x.hasIllustration=true);
const index=createExerciseIndex(catalog,payload);
const state={region:'all',muscles:[],tools:[],availableOnly:false,includeSecondary:false,activity:'all',onlyFavorites:false,withImages:false,favorites:[],query:'',sort:'classic',labels:catalog};
const bench='ex_c9b82dda3a0dfa',dbBench='ex_e8875fab9aefae',rdl='ex_7f695d323bb7cc',oldRdl='ex_0a21d92a82a96a',dbRdl='ex_ce712f77fae89b';

test('every original exercise, source and image ID is reachable once through stable display groups',()=>{
 assert.equal(payload.catalogSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.equal(index.byExercise.size,2844);assert.equal(index.groups.length,1841);assert.equal(payload.meta.equipmentGroupCount,2381);
 assert.equal(index.groups.length,payload.meta.groupCount);
 for(const x of catalog.exercises){assert.ok(index.byExercise.get(x.id).variant.exerciseIds.includes(x.id));assert.ok(x.sources.length);}
 for(const g of index.groups)for(const v of g.variants){assert.ok(v.exerciseIds.includes(v.id));for(const id of v.exerciseIds)assert.deepEqual([...index.byId.get(id).equipment].sort(),[...v.exercise.equipment].sort());}
 assert.throws(()=>createExerciseIndex(catalog,{groups:payload.groups.slice(1)}));
});
test('equipment and explicit condition counterparts share cards while functional movements and apparatus stay separate',()=>{
 assert.equal(index.byExercise.get(bench).group,index.byExercise.get(dbBench).group);
 assert.equal(index.byExercise.get(rdl).group,index.byExercise.get(dbRdl).group);
 assert.equal(index.byExercise.get(rdl).variant,index.byExercise.get(oldRdl).variant);
 for(const pattern of [/Incline Dumbbell Flyes/,/dumbbell incline fly on exercise ball/,/Romanian Deadlift from Deficit/])assert.ok(catalog.exercises.some(x=>pattern.test(x.name)));
 const find=name=>catalog.exercises.find(x=>x.name===name);
 assert.notEqual(index.byExercise.get(find('Incline Dumbbell Flyes').id).group,index.byExercise.get(find('dumbbell incline fly on exercise ball').id).group);
 const deficit=index.byExercise.get(find('Romanian Deadlift from Deficit').id);
 assert.notEqual(index.byExercise.get(rdl).group,deficit.group);assert.notEqual(index.byExercise.get(rdl).variant,deficit.variant);assert.match(conditionLabel(deficit.variant,deficit.group),/디피싯/);
 for(const [a,b] of [['Reverse Lunge','Dumbbell Lunges'],['Reverse Crunch','Crunches'],['Reverse Flyes','Dumbbell Flyes']]){
  const first=find(a),second=find(b);assert.ok(first&&second,`${a} / ${b}`);assert.notEqual(index.byExercise.get(first.id).group,index.byExercise.get(second.id).group);
 }
 const incline=catalog.exercises.find(x=>x.name==='Incline Bench Press'&&x.equipment.includes('dumbbell'));assert.ok(incline);assert.equal(index.byExercise.get(bench).group,index.byExercise.get(incline.id).group);
});
test('availability filters apply to a complete individual variant, not an equipment union across a card',()=>{
 const group=index.byExercise.get(dbBench).group;
 const available=matchingGroups(index,{...state,availableOnly:true,tools:['dumbbell','bench'],query:'bench press'}).find(g=>g.id===group.id);
 assert.ok(available);assert.ok(available.matches.some(v=>v.id===dbBench));assert.ok(available.matches.every(v=>v.exercise.equipment.every(t=>['dumbbell','bench'].includes(t))));
 const unsupported=matchingGroups(index,{...state,availableOnly:true,tools:['dumbbell'],query:'bench press'}).find(g=>g.id===group.id);assert.ok(!unsupported||unsupported.matches.every(v=>v.exercise.equipment.every(t=>t==='dumbbell')));
 assert.equal(matchingGroups(index,{...state,onlyFavorites:true,favorites:[oldRdl]}).length,1);
 assert.match(groupExerciseName(index,dbBench,catalog.equipment),/덤벨/);
 assert.match(variantLabel(index.byExercise.get(bench).variant,group,catalog.equipment),/바벨/);
});
test('legacy maximum aliases resolve by last save without mixing dumbbell and barbell or mutating data',()=>{
 const entity=(id,value,time,basis)=>({id:`max_${id}`,kind:'max',updatedAt:time,value:{exerciseId:id,value,basis,source:'measured',step:2.5,date:'2026-10-04'}});
 const entities={[`max_${rdl}`]:entity(rdl,80,100,'total'),[`max_${oldRdl}`]:entity(oldRdl,100,200,'total'),[`max_${dbRdl}`]:entity(dbRdl,22,300,'perHand')};
 const snapshot=structuredClone(entities),maxima=resolveMaxima(index,entities);
 assert.equal(maxima[rdl].value,100);assert.equal(maxima[oldRdl].value,100);assert.equal(maxima[dbRdl].value,22);assert.deepEqual(entities,snapshot);
 const profile={...DEFAULT_PROFILE,recordMode:'records',equipment:['barbell','plates','dumbbell','bench','power_rack']};
 const bb=makeExercise(exerciseCandidate(index.byId.get(rdl)),profile,maxima,[],catalog.exercises),db=makeExercise(exerciseCandidate(index.byId.get(dbRdl)),profile,maxima,[],catalog.exercises);
 assert.equal(bb.basis,'total');assert.equal(db.basis,'perHand');assert.equal(bb.sets.find(s=>s.kind==='work').weight,60);assert.equal(db.sets.find(s=>s.kind==='work').weight,12.5);
 const noDb=makeExercise(exerciseCandidate(index.byId.get(dbRdl)),profile,resolveMaxima(index,{[`max_${rdl}`]:entities[`max_${rdl}`]}),[],catalog.exercises);
 assert.equal(noDb.sets.find(s=>s.kind==='work').weight,null);
});
test('reviewed duplicate history informs progression, while other equipment history never does',()=>{
 const sessions=[{status:'complete',program:'double',startedAt:100,exercises:[{exerciseId:oldRdl,basis:'total',sets:[{kind:'work',done:true,reps:8,actualWeight:60,actualReps:12,actualRir:2}]}]}];
 const profile={...DEFAULT_PROFILE,recordMode:'records'};
 const sets=makeExercise(exerciseCandidate(index.byId.get(rdl)),profile,{},sessions,catalog.exercises,0,true).sets;
 assert.equal(sets.find(s=>s.kind==='work').weight,62.5);
 assert.equal(lastProgress(dbRdl,'double',sessions,null,profile,'perHand',index.byId.get(dbRdl).recordIds),null);
});
test('general routine equipment choices can use a grouped catalog variant and retain its own maximum',()=>{
 const smith=index.byExercise.get(bench).group.variants.find(v=>v.exercise.equipment.includes('smith')).id;
 const profile={...DEFAULT_PROFILE,equipment:['barbell','plates','power_rack','bench','dumbbell','smith'],recordMode:'records',swaps:{[bench]:smith}};
 const plan=buildRoutine(profile,{[smith]:{value:70,basis:'total',step:2.5}},[],catalog.exercises);
 assert.ok(plan.days[0].exercises.some(e=>e.exerciseId===smith));
 const five=buildRoutine({...profile,program:'five',split:'full'}, {}, [],catalog.exercises);
 assert.ok(five.days[0].exercises.some(e=>e.exerciseId===bench));
});
test('legacy duplicate additions collapse in future plans while different equipment and saved sessions remain distinct',()=>{
 const profile={...DEFAULT_PROFILE,equipment:['barbell','plates','power_rack','bench','dumbbell'],recordMode:'records'},key=dayKey(profile,0);
 profile.dayEdits={[key]:{additions:[{exerciseId:'ex_18b2cfef4217ec',basis:'total'},{exerciseId:dbBench,basis:'perHand'}],order:[]}};
 const sessions=[{status:'abandoned',program:'percent',split:'upperLower',startedAt:1,exercises:[{exerciseId:'ex_18b2cfef4217ec',basis:'total',sets:[]}]}],snapshot=structuredClone(sessions);
 const plan=buildRoutine(profile,{},sessions,catalog.exercises);
 assert.equal(plan.days[0].exercises.filter(e=>index.byExercise.get(e.exerciseId).group===index.byExercise.get(bench).group).length,2);
 assert.ok(plan.days[0].exercises.some(e=>e.exerciseId===bench));assert.ok(plan.days[0].exercises.some(e=>e.exerciseId===dbBench));assert.deepEqual(sessions,snapshot);
});
test('equipment selection retains an available angle and exposes only conditions belonging to that equipment',()=>{
 const group=index.byExercise.get(bench).group;
 const bbIncline=group.variants.find(v=>v.exercise.name==='Incline Bench Press'&&v.exercise.equipment.includes('barbell'));
 const dbIncline=group.variants.find(v=>v.exercise.name==='Incline Bench Press'&&v.exercise.equipment.includes('dumbbell'));
 assert.ok(bbIncline&&dbIncline);assert.match(conditionLabel(bbIncline,group),/인클라인/);
 const gear=equipmentOptions(group,catalog.equipment).find(o=>o.key===equipmentKey(dbIncline));
 assert.ok(gear.variants.some(v=>v.id===dbBench));assert.ok(gear.variants.includes(dbIncline));assert.ok(gear.variants.every(v=>v.exercise.equipment.includes('dumbbell')));
 assert.equal(chooseEquipmentVariant(group,gear.key,bbIncline.id).id,dbIncline.id);
 assert.equal(chooseEquipmentVariant(group,gear.key,bbIncline.id,[index.byExercise.get(dbBench).variant]).id,dbBench);
 assert.equal(chooseEquipmentVariant(group,'unavailable',bbIncline.id),null);
 const labels=gear.variants.map(v=>conditionLabel(v,group));assert.equal(new Set(labels).size,labels.length);
});
test('same barbell with different grip or angle retains independent maxima, progression and routine selection',()=>{
 const group=index.byExercise.get(bench).group;
 const incline=group.variants.find(v=>v.exercise.name==='Incline Bench Press'&&v.exercise.equipment.includes('barbell'));
 const close=group.variants.find(v=>v.exercise.name==='Close-Grip Barbell Bench Press');assert.ok(incline&&close);
 const entity=(id,value)=>({id:`max_${id}`,kind:'max',updatedAt:100,value:{exerciseId:id,value,basis:'total',source:'measured',step:2.5,date:'2026-10-05'}});
 const entities={[`max_${bench}`]:entity(bench,100),[`max_${incline.id}`]:entity(incline.id,70),[`max_${close.id}`]:entity(close.id,80)},snapshot=structuredClone(entities),maxima=resolveMaxima(index,entities);
 assert.equal(maxima[bench].value,100);assert.equal(maxima[incline.id].value,70);assert.equal(maxima[close.id].value,80);assert.deepEqual(entities,snapshot);
 const profile={...DEFAULT_PROFILE,recordMode:'records',equipment:['barbell','plates','bench','power_rack']};
 const basic=makeExercise(exerciseCandidate(index.byId.get(bench)),profile,maxima,[],catalog.exercises),angled=makeExercise(exerciseCandidate(incline.exercise),profile,maxima,[],catalog.exercises);
 assert.equal(basic.sets.find(s=>s.kind==='work').weight,60);assert.equal(angled.sets.find(s=>s.kind==='work').weight,40);
 const unsaved=makeExercise(exerciseCandidate(close.exercise),profile,resolveMaxima(index,{[`max_${bench}`]:entities[`max_${bench}`]}),[],catalog.exercises);assert.equal(unsaved.sets.find(s=>s.kind==='work').weight,null);
 const sessions=[{status:'complete',program:'double',startedAt:100,exercises:[{exerciseId:bench,basis:'total',sets:[{kind:'work',done:true,reps:8,actualWeight:60,actualReps:12,actualRir:2}]}]}];
 assert.equal(lastProgress(incline.id,'double',sessions,null,profile,'total',incline.exercise.recordIds),null);
 const plan=buildRoutine({...profile,swaps:{[bench]:incline.id}},maxima,[],catalog.exercises);assert.ok(plan.days[0].exercises.some(e=>e.exerciseId===incline.id));
});
