// SPDX-License-Identifier: AGPL-3.0-only
import {matchesExercise,sortExercises} from './filters.mjs';

export function createExerciseIndex(catalog,payload){
 const byId=new Map(catalog.exercises.map(x=>[x.id,x])),byExercise=new Map(),byGroup=new Map();
 const groups=payload.groups.map(g=>{
  const variants=g.variants.map(v=>{
   const x=byId.get(v.id);if(!x)throw Error('통합 운동의 원본을 찾을 수 없어요.');
   const variant={...v,exercise:x};
   for(const id of v.exerciseIds){if(!byId.has(id)||byExercise.has(id))throw Error('통합 운동 연결을 확인해 주세요.');byExercise.set(id,{group:null,variant});byId.get(id).recordIds=v.exerciseIds;}
   return variant;
  });
  const group={...g,variants};byGroup.set(g.id,group);
  for(const v of variants)for(const id of v.exerciseIds){byExercise.get(id).group=group;byId.get(id).groupId=group.id;}
  return group;
 });
 if(byExercise.size!==byId.size)throw Error('통합 목록에 빠진 운동이 있어요.');
 return {groups,byId,byExercise,byGroup};
}

export function matchingGroups(index,state){
 const matched=[];
 for(const group of index.groups){
  const variants=group.variants.filter(v=>v.exerciseIds.some(id=>matchesExercise(index.byId.get(id),state)));
  if(variants.length)matched.push({...group,matches:variants,representative:variants[0].exercise});
 }
 const sorted=sortExercises(matched.map(g=>({...g.representative,name:g.name,nameKo:g.nameKo,group:g})),state.sort);
 return sorted.map(x=>x.group);
}

export function equipmentLabel(exercise,labels){
 const primary=['dumbbell','barbell','ez_bar','kettlebell','smith','cable','machine','band'];
 return [...exercise.equipment].sort((a,b)=>(primary.includes(a)?primary.indexOf(a):100)-(primary.includes(b)?primary.indexOf(b):100)).map(t=>labels[t]||t).join(' · ')||'맨몸';
}
export function variantLabel(variant,group,labels){
 const equipment=equipmentLabel(variant.exercise,labels);
 const same=group.variants.filter(v=>equipmentLabel(v.exercise,labels)===equipment);
 if(same.length===1)return equipment;
 const name=variant.exercise.name;
 // Unreviewed same-equipment entries retain their own instruction and records.
 return `${equipment} · ${name}${same.filter(v=>v.exercise.name===name).length>1?' · '+(same.indexOf(variant)+1):''}`;
}
export function groupExerciseName(index,id,labels){
 const link=index.byExercise.get(id);if(!link)return index.byId.get(id)?.nameKo||'운동';
 return `${link.group.nameKo} · ${variantLabel(link.variant,link.group,labels)}`;
}

// Resolve reviewed aliases on read, retaining all durable legacy entities and
// choosing the last saved value. Equipment variants never share maxima.
export function resolveMaxima(index,entities){
 const result={};
 for(const group of index.groups)for(const variant of group.variants){
  const records=variant.exerciseIds.map(id=>entities[`max_${id}`]).filter(e=>e&&!e.deleted&&e.kind==='max');
  const latest=records.sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id))[0];
  if(latest)for(const id of variant.exerciseIds)result[id]=latest.value;
 }
 return result;
}
