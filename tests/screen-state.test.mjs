// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import {clampPage,pageSlice,catalogCapacity,sessionPosition,resumeSet,textPages} from '../public/screen-state.mjs';

test('every catalog exercise remains reachable without a growing list',()=>{
 const exercises=Array.from({length:2844},(_,id)=>({id}));
 for(const size of [1,2,4,6,8]){
  const count=pageSlice(exercises,0,size).count,seen=[];
  for(let page=0;page<count;page++)seen.push(...pageSlice(exercises,page,size).items.map(e=>e.id));
  assert.deepEqual(seen,exercises.map(e=>e.id));assert.equal(pageSlice(exercises,count+10,size).page,count-1);
 }
 assert.deepEqual(pageSlice([],500,6),{page:0,count:1,start:0,items:[]});assert.equal(clampPage(NaN,5),0);assert.throws(()=>pageSlice(exercises,1,0));
});
test('cards adapt to short, mobile and wide viewports',()=>{
 assert.deepEqual(catalogCapacity(390,844),{columns:1,rows:1,size:1});
 assert.equal(catalogCapacity(1280,720).size,6);assert.equal(catalogCapacity(1280,640).size,3);assert.equal(catalogCapacity(1600,900).size,8);
});
test('resume moves through warmup, unfinished sets and finish without changing records',()=>{
 const session={warmup:[{done:false},{done:false}],exercises:[{sets:[{done:false},{done:false}]},{sets:[{done:false}]}]};
 assert.deepEqual(sessionPosition(session),{page:'warm-0',set:0});session.warmup[0].done=true;
 assert.equal(sessionPosition(session).page,'warm-1');session.warmup[1].done=true;
 assert.deepEqual(sessionPosition(session),{page:'lift-0',set:0});session.exercises[0].sets[0].done=true;
 assert.deepEqual(sessionPosition(session),{page:'lift-0',set:1});assert.equal(resumeSet(session.exercises[0]),1);
 session.exercises[0].sets[1].done=true;assert.deepEqual(sessionPosition(session),{page:'lift-1',set:0});
 session.exercises[1].sets[0].done=true;assert.equal(sessionPosition(session).page,'finish');assert.equal(resumeSet(session.exercises[0]),1);
 const snapshot=structuredClone(session);sessionPosition(session);assert.deepEqual(session,snapshot);
});
test('long notes retain every character when split across cards',()=>{
 for(const text of ['','공백 없는 아주 긴 운동 설명 '.repeat(140),'가'.repeat(2300),'First paragraph.\n\nSecond paragraph.\n'.repeat(80)]){
  const pages=textPages(text,450);assert.equal(pages.join(''),text);assert.ok(pages.every(p=>p.length<=451));
 }
 assert.throws(()=>textPages('hello',0));
});
