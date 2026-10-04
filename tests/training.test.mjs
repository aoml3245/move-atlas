import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_PROFILE,CANDIDATES,estimate1RM,roundLoad,validateProfile,buildRoutine,createSession,sessionStats,remainingSeconds,lastProgress} from '../public/training.mjs';
import {TrainingStore,mergeSession,mergeEntity} from '../public/training-store.mjs';
const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url))).exercises;
const gym={...DEFAULT_PROFILE,experience:'trained',recordMode:'records',equipment:['barbell','plates','bench','power_rack','dumbbell','cable','cable_bar','machine']};
const max={ex_c9b82dda3a0dfa:{exerciseId:'ex_c9b82dda3a0dfa',value:100,basis:'total',step:2.5,date:'2026-10-01',source:'measured'}};
const storage=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};

test('1RM estimate validates short rep tests and keeps estimates distinct from measured singles',()=>{
 assert.equal(estimate1RM(60,5,2),74);assert.equal(estimate1RM(100,1,0),100);
 for(const values of [[-1,5,0],[60,11,0],[60,8,3],[60,5.5,0],[Infinity,3,0],[60,3,-1]])assert.throws(()=>estimate1RM(...values));
});
test('loads round down and never invent a load above the target or below the available bar',()=>{
 assert.equal(roundLoad(67.4,2.5),65);assert.equal(roundLoad(18,2.5,20),null);assert.equal(roundLoad(0),null);assert.equal(roundLoad(50,0),null);
});
test('all curated exercise IDs exist and require every necessary piece of equipment',()=>{
 for(const c of CANDIDATES){const e=catalog.find(x=>x.id===c.id);assert.ok(e,c.id);assert.equal(e.needsReview,false);}
 const p={...gym,equipment:['barbell','plates'],split:'full'};const routine=buildRoutine(p,{},[],catalog);
 assert.ok(routine.days.flatMap(d=>d.exercises).every(e=>CANDIDATES.find(c=>c.id===e.exerciseId).required.every(tool=>p.equipment.includes(tool))));
 assert.ok(routine.days.flatMap(d=>d.exercises).every(e=>!['ex_1aabe3bea44907','ex_c9b82dda3a0dfa','ex_4bacc057ae79a7'].includes(e.exerciseId)));
});
test('every routine includes walking five minutes and dynamic stretching, with independent weights',()=>{
 const routine=buildRoutine(gym,max,[],catalog);const upper=routine.days[0];
 assert.deepEqual(upper.warmup.map(w=>w.seconds),[300,180]);
 const bench=upper.exercises.find(e=>e.role==='bench');assert.deepEqual(bench.sets.filter(s=>s.kind==='work').map(s=>s.weight),[60,70,80]);
 assert.ok(upper.exercises.filter(e=>e.exerciseId!==bench.exerciseId).every(e=>e.sets.every(s=>s.weight===null)));
 const mismatched=buildRoutine(gym,{ex_c9b82dda3a0dfa:{...max.ex_c9b82dda3a0dfa,basis:'perHand'}},[],catalog);
 assert.ok(mismatched.days[0].exercises.find(e=>e.role==='bench').sets.every(s=>s.weight===null));
});
test('exercise substitution uses that exercise own maximum instead of the original',()=>{
 const p={...gym,swaps:{ex_c9b82dda3a0dfa:'ex_e8875fab9aefae'}};const routine=buildRoutine(p,max,[],catalog);
 const bench=routine.days[0].exercises.find(e=>e.role==='bench');assert.equal(bench.exerciseId,'ex_e8875fab9aefae');assert.equal(bench.basis,'perHand');assert.ok(bench.sets.every(s=>s.weight===null));
});
test('unmeasured lifts can start as light calibration sets and bodyweight never gets percentage loads',()=>{
 const p={...DEFAULT_PROFILE,split:'full'};const routine=buildRoutine(p,{},[],catalog);
 const dumbbell=routine.days[0].exercises.find(e=>e.basis==='perHand');assert.equal(dumbbell.testing,true);assert.equal(dumbbell.sets.length,2);assert.ok(dumbbell.sets.every(s=>s.weight===null));
 const bw=buildRoutine({...p,equipment:[]}, {},[],catalog).days[0].exercises;
 assert.ok(bw.every(e=>e.sets.every(s=>s.weight===null)));
});
test('named templates enforce their equipment and schedule instead of silently converting split',()=>{
 assert.throws(()=>validateProfile({...gym,program:'five',days:[1,2,3]}));
 assert.throws(()=>validateProfile({...gym,program:'wave',days:[1,3,5]}));
 assert.throws(()=>validateProfile({...DEFAULT_PROFILE,program:'five'}));
 const five=buildRoutine({...gym,program:'five',split:'full'},max,[],catalog);
 assert.equal(five.days.length,2);assert.equal(five.days[1].exercises.find(e=>e.role==='hinge').sets.filter(s=>s.kind==='work').length,1);
 const wave=buildRoutine({...gym,program:'wave',split:'four',days:[1,2,4,5]},max,[],catalog);
 assert.deepEqual(wave.days[2].exercises[0].sets.filter(s=>s.kind==='work').map(s=>s.weight),[55,62.5,70]);
});
test('completion advances the rotation while interrupted sessions preserve the next day',()=>{
 const routine=buildRoutine(gym,max,[],catalog);const s=createSession(routine,0,100,'test');s.status='abandoned';
 assert.equal(buildRoutine(gym,max,[s],catalog).nextDay,0);s.status='complete';assert.equal(buildRoutine(gym,max,[s],catalog).nextDay,1);
});
test('session snapshots remain unchanged after editing max weight or configuration',()=>{
 const routine=buildRoutine(gym,max,[],catalog),s=createSession(routine,0,100,'snapshot');const before=JSON.stringify(s);
 routine.days[0].exercises[0].sets[0].weight=999;buildRoutine({...gym,step:5},{...max,ex_c9b82dda3a0dfa:{...max.ex_c9b82dda3a0dfa,value:200}},[],catalog);
 assert.equal(JSON.stringify(s),before);
});
test('training volume excludes warmups, bodyweight and timed holds',()=>{
 const s={exercises:[{basis:'total',sets:[{kind:'warmup',done:true,actualWeight:20,actualReps:8},{kind:'work',done:true,actualWeight:50,actualReps:5}]},{basis:'perHand',sets:[{kind:'work',done:true,actualWeight:10,actualReps:8}]},{basis:'seconds',sets:[{kind:'work',done:true,actualReps:30,actualWeight:0}]}]};
 assert.deepEqual(sessionStats(s),{sets:3,volume:410});
});
test('double progression increments only when all worksets meet the upper rep goal',()=>{
 const s={status:'complete',program:'double',startedAt:1,exercises:[{exerciseId:'bench',sets:[1,2,3].map(()=>({kind:'work',done:true,actualWeight:50,actualReps:12,actualRir:2,reps:8}))}]};
 assert.equal(lastProgress('bench','double',[s],null,gym).weight,52.5);s.exercises[0].sets[1].actualReps=11;assert.equal(lastProgress('bench','double',[s],null,gym).weight,50);
});
test('timer restoration follows the deadline, supports pauses and caps overdue time at zero',()=>{
 assert.equal(remainingSeconds({deadline:10000,paused:false},1000),9);assert.equal(remainingSeconds({deadline:10000,paused:false},20000),0);assert.equal(remainingSeconds({paused:true,remaining:12},999999),12);
});
test('account data are isolated and backup import merges without discarding existing records',()=>{
 const s=new TrainingStore(storage());s.save('max','lift-a',{...max.ex_c9b82dda3a0dfa,exerciseId:'lift-a'});const backup=s.backup();
 s.switchAccount('account-a');assert.equal(s.all('max').length,0);s.save('max','lift-b',{...max.ex_c9b82dda3a0dfa,exerciseId:'lift-b',value:50});s.importBackup(backup);assert.equal(s.all('max').length,2);
 s.switchAccount('guest');assert.equal(s.all('max').length,1);s.switchAccount('account-b');assert.equal(s.all('max').length,0);
});
test('concurrent set records merge and an explicit later edit can undo completion',()=>{
 const s=createSession(buildRoutine(gym,max,[],catalog),0,1,'concurrent'),a=structuredClone(s),b=structuredClone(s);
 Object.assign(a.exercises[0].sets[0],{done:true,actualReps:8,changedAt:100});a.changedAt=100;
 Object.assign(b.exercises[1].sets[0],{done:true,actualReps:8,changedAt:200});b.changedAt=200;
 const merged=mergeSession(a,b);assert.ok(merged.exercises[0].sets[0].done);assert.ok(merged.exercises[1].sets[0].done);
 const undo=structuredClone(merged);Object.assign(undo.exercises[0].sets[0],{done:false,changedAt:300});undo.changedAt=300;
 assert.equal(mergeSession(merged,undo).exercises[0].sets[0].done,false);
 assert.equal(mergeEntity({updatedAt:1,value:{a:1}},{updatedAt:2,value:{a:2}}).value.a,2);
});
test('malformed backup imports are rejected before any records are changed',()=>{
 const s=new TrainingStore(storage());s.save('max','lift',{value:50});const before=s.backup();
 assert.throws(()=>s.importBackup({format:'move-atlas-training-backup',version:1,entities:{bad:{id:'wrong',kind:'max',updatedAt:1,value:{}}}}));
 assert.deepEqual(s.backup().entities,before.entities);
});
