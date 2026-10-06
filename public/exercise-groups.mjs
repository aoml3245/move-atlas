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
export const equipmentKey=variant=>[...variant.exercise.equipment].sort().join('|')||'bodyweight';
export function equipmentOptions(group,labels,variants=group.variants){
 const options=new Map();
 for(const variant of variants){const key=equipmentKey(variant);if(!options.has(key))options.set(key,{key,label:equipmentLabel(variant.exercise,labels),variants:[]});options.get(key).variants.push(variant);}
 return [...options.values()];
}
export function conditionLabel(variant,group){
 const label=[...new Set((variant.conditions||[]).map(c=>c.label))].join(' · ')||'기본';
 const same=group.variants.filter(v=>equipmentKey(v)===equipmentKey(variant)&&([...(v.conditions||[])].map(c=>`${c.type}:${c.label}`).sort().join('|')===[...(variant.conditions||[])].map(c=>`${c.type}:${c.label}`).sort().join('|')));
 // Same-equipment/same-condition entries remain separate until reviewed.
 return same.length>1?`${label} · ${variant.exercise.name}${same.filter(v=>v.exercise.name===variant.exercise.name).length>1?' · '+(same.indexOf(variant)+1):''}`:label;
}
export function variantLabel(variant,group,labels){
 const gear=equipmentLabel(variant.exercise,labels),condition=conditionLabel(variant,group);
 return group.variants.length>1||variant.conditions?.length?`${gear} · ${condition}`:gear;
}
export function chooseEquipmentVariant(group,key,currentId,variants=group.variants){
 const current=group.variants.find(v=>v.exerciseIds.includes(currentId)),options=variants.filter(v=>equipmentKey(v)===key);
 if(!options.length)return null;
 if(options.includes(current))return current;
 const conditionSet=v=>new Set((v?.conditions||[]).map(c=>`${c.type}:${c.label}`)),wanted=conditionSet(current);
 const distance=v=>{const actual=conditionSet(v);return [...wanted].filter(c=>!actual.has(c)).length+[...actual].filter(c=>!wanted.has(c)).length;};
 // Preserve the condition combination when the new apparatus offers it.
 return options.reduce((best,v)=>distance(v)<distance(best)?v:best,options[0]);
}
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function variantPickerHtml(group,id,labels,{prefix,variants=group.variants}={}){
 const selected=variants.find(v=>v.exerciseIds.includes(id))||variants[0];if(!selected)return '<p>사용할 수 있는 조건이 없어요.</p>';
 const equipment=equipmentOptions(group,labels,variants),key=equipmentKey(selected),conditions=equipment.find(e=>e.key===key).variants;
 return `<div class="variant-picker" data-variant-picker="${escapeHtml(prefix)}" data-group-id="${group.id}" data-selected-id="${selected.id}" data-variant-ids="${variants.map(v=>v.id).join(',')}"><label for="${prefix}-gear">장비<select id="${prefix}-gear" data-variant-gear>${equipment.map(e=>`<option value="${escapeHtml(e.key)}" ${e.key===key?'selected':''}>${escapeHtml(e.label)}</option>`).join('')}</select></label><label for="${prefix}">그립·각도·자세<select id="${prefix}" data-variant-condition>${conditions.map(v=>`<option value="${v.id}" ${v===selected?'selected':''}>${escapeHtml(conditionLabel(v,group))}</option>`).join('')}</select></label></div>`;
}
export function pickerSelection(index,target){
 const root=target.closest('[data-variant-picker]');if(!root)return null;
 const group=index.byGroup.get(root.dataset.groupId);if(!group)return null;
 const allowed=new Set(root.dataset.variantIds.split(',')),variants=group.variants.filter(v=>allowed.has(v.id));
 const variant=target.hasAttribute('data-variant-gear')?chooseEquipmentVariant(group,target.value,root.dataset.selectedId,variants):variants.find(v=>v.id===target.value);
 return variant?{group,variant,prefix:root.dataset.variantPicker}:null;
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
