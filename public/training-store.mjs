export function mergeSession(a,b){
 const latest=(a.changedAt||0)>(b.changedAt||0)?a:b, other=latest===a?b:a;
 const merged=structuredClone(latest);
 merged.removedExercises={...(a.removedExercises||{})};
 for(const [id,time]of Object.entries(b.removedExercises||{}))merged.removedExercises[id]=Math.max(time,merged.removedExercises[id]||0);
 // Keep additions from either device, with explicit removals winning over older additions.
 for(const e of other.exercises||[])if(e.additional&&!merged.exercises.some(x=>x.exerciseId===e.exerciseId))merged.exercises.push(structuredClone(e));
 merged.exercises=merged.exercises.map(e=>({...e,sets:e.sets.map(s=>{
  const prior=other.exercises?.find(o=>o.exerciseId===e.exerciseId)?.sets.find(t=>t.id===s.id);
  return prior&&(prior.changedAt||0)>(s.changedAt||0)?structuredClone(prior):s;
 })}));
 merged.exercises=merged.exercises.filter(e=>!e.additional||!merged.removedExercises[e.exerciseId]||(e.addedAt||0)>merged.removedExercises[e.exerciseId]||e.sets.some(s=>s.done));
 merged.warmup=merged.warmup.map(w=>{const old=other.warmup?.find(o=>o.id===w.id);return old&&(old.changedAt||0)>(w.changedAt||0)?old:w;});
 clearCompletedWarmupTimer(merged);
 return merged;
}
export function mergeEntity(a,b){
 if(!a)return b;if(!b)return a;
 const latest=a.updatedAt>b.updatedAt?a:b;
 if(a.kind==='session'&&b.kind==='session'&&!a.deleted&&!b.deleted)return {...latest,value:mergeSession(a.value,b.value)};
 return latest;
}
export class TrainingStore {
 constructor(storage=globalThis.localStorage){this.storage=storage;this.namespace='guest';this.listeners=new Set();this.onWrite=null;this.load();}
 get key(){return `move-atlas.training:v1:${this.namespace}`;}
 load(){try{const p=JSON.parse(this.storage.getItem(this.key)||'{}');this.entities=p.version===1&&p.entities&&typeof p.entities==='object'?p.entities:{};}catch{this.entities={};}this.notify();}
 switchAccount(uid){this.namespace=uid||'guest';this.load();}
 all(kind){return Object.values(this.entities).filter(e=>e.kind===kind&&!e.deleted).map(e=>e.value);}
 get(kind,id){const e=this.entities[`${kind}_${id}`];return e&&!e.deleted?e.value:null;}
 save(kind,id,value){const key=`${kind}_${id}`,now=Math.max(Date.now(),(this.entities[key]?.updatedAt||0)+1);const entity={id:key,kind,value:structuredClone(value),updatedAt:now};this.entities[key]=entity;const durable=this.persist();this.notify();this.onWrite?.(entity);if(!durable)throw Error('기기 저장 공간이 부족해요. 현재 기록은 화면에 남아 있으니 설정에서 백업을 저장해 주세요.');return value;}
 receive(entity){try{validateEntity(entity);}catch{this.storageError='불러온 일부 기록의 형식을 확인해 주세요.';return;}const merged=mergeEntity(this.entities[entity.id],entity);if(JSON.stringify(this.entities[entity.id])===JSON.stringify(merged))return;this.entities[entity.id]=merged;this.persist();this.notify();if(JSON.stringify(merged)!==JSON.stringify(entity))this.onWrite?.(merged);}
 persist(){try{this.storage.setItem(this.key,JSON.stringify({version:1,entities:this.entities}));this.storageError=null;return true;}catch{this.storageError='기기 저장 공간이 부족해요. 기록을 백업해 주세요.';return false;}}
 notify(){for(const fn of this.listeners)fn();}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 backup(){return {format:'move-atlas-training-backup',version:1,exportedAt:new Date().toISOString(),entities:structuredClone(this.entities)};}
 importBackup(backup){
  const entries=validateBackup(backup);
  for(const [id,e]of entries){this.entities[id]=mergeEntity(this.entities[id],e);this.onWrite?.(this.entities[id]);}const durable=this.persist();this.notify();if(!durable)throw Error('기기 저장 공간이 부족해 가져온 기록을 보관하지 못했어요. 원본 백업 파일을 보관해 주세요.');return entries.length;
 }
}
export function validateBackup(backup){
 if(backup?.format!=='move-atlas-training-backup'||backup.version!==1||!backup.entities||Array.isArray(backup.entities)||typeof backup.entities!=='object'||Object.keys(backup.entities).length>50000)throw Error('Move Atlas 기록 백업 파일을 골라 주세요.');
 const entries=Object.entries(backup.entities);for(const [id,e]of entries)validateEntity(e,id);return entries;
}
import {validateProfile,BASIS,PROGRAMS,SPLITS,clearCompletedWarmupTimer} from './training.mjs';
function validateEntity(e,id=e?.id){
 if(!e||e.id!==id||!['profile','max','session','preferences'].includes(e.kind)||!Number.isFinite(e.updatedAt)||e.updatedAt<=0||e.updatedAt>Date.now()+300000||!e.value||Array.isArray(e.value)||id.length>150||!new RegExp(`^${e.kind}_[A-Za-z0-9_-]+$`).test(id))throw Error('기록 형식을 확인해 주세요.');
 const v=e.value;
 if(e.kind==='profile')validateProfile(v);
 if(e.kind==='max'&&(!Number.isFinite(v.value)||v.value<=0||v.value>3000||typeof v.exerciseId!=='string'||id!==`max_${v.exerciseId}`||!['measured','estimated'].includes(v.source)||!BASIS[v.basis]||!Number.isFinite(v.step)||v.step<=0||v.step>100||!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||!Number.isFinite(new Date(v.date).getTime())))throw Error('중량 기록 형식을 확인해 주세요.');
 if(e.kind==='max'&&['testWeight','testReps','testRir'].some(k=>v[k]!==undefined&&(!Number.isFinite(v[k])||v[k]<0||v[k]>3000)))throw Error('최대 중량의 테스트 값을 확인해 주세요.');
 if(e.kind==='preferences'&&(!Array.isArray(v.tools)||!Array.isArray(v.favorites)||[...v.tools,...v.favorites].some(x=>typeof x!=='string')))throw Error('도감 설정 형식을 확인해 주세요.');
 if(e.kind==='session'){
  if(id!==`session_${v.id}`||!PROGRAMS[v.program]||!SPLITS[v.split]||!['active','complete','abandoned'].includes(v.status)||!Array.isArray(v.exercises)||!Array.isArray(v.warmup)||v.exercises.length>40||!Number.isFinite(v.startedAt))throw Error('운동 기록 형식이 올바르지 않아요.');
  if(v.warmup.length!==2||!v.warmup.some(w=>w.id==='walk'&&w.seconds===300)||!v.warmup.some(w=>w.id==='dynamic'&&w.seconds===180))throw Error('걷기와 스트레칭 기록을 확인해 주세요.');
  if(v.removedExercises!==undefined&&(!v.removedExercises||Array.isArray(v.removedExercises)||typeof v.removedExercises!=='object'||Object.keys(v.removedExercises).length>200||Object.entries(v.removedExercises).some(([id,t])=>!/^ex_[a-f0-9]{14}$/.test(id)||!Number.isFinite(t)||t<=0)))throw Error('추가 운동 변경 기록을 확인해 주세요.');
  for(const exercise of v.exercises){if(!/^ex_[a-f0-9]{14}$/.test(exercise.exerciseId)||!BASIS[exercise.basis]||!Array.isArray(exercise.sets)||exercise.sets.length>50)throw Error('세트 기록 형식을 확인해 주세요.');
   if(exercise.progressionProgram!==undefined&&!PROGRAMS[exercise.progressionProgram]||exercise.addedAt!==undefined&&(!Number.isFinite(exercise.addedAt)||exercise.addedAt<=0))throw Error('운동 추가 설정을 확인해 주세요.');
   for(const s of exercise.sets){if(!['work','warmup'].includes(s.kind)||!Number.isFinite(s.reps)||s.reps<=0||s.reps>2000||!Number.isFinite(s.restSeconds)||s.restSeconds<0||s.restSeconds>1800||(s.weight!==null&&(!Number.isFinite(s.weight)||s.weight<0||s.weight>3000)))throw Error('세트 목표를 확인해 주세요.');if(s.done&&(!Number.isFinite(s.actualWeight)||s.actualWeight<0||!Number.isFinite(s.actualReps)||s.actualReps<=0))throw Error('완료 세트 값을 확인해 주세요.');}
   for(const s of exercise.sets)if(['actualWeight','actualReps','actualRir','rir','repsMax'].some(k=>s[k]!==undefined&&(!Number.isFinite(s[k])||s[k]<0||s[k]>3000)))throw Error('세트의 중량과 반복 값을 확인해 주세요.');
  }
  if(v.timer&&(!Number.isFinite(v.timer.deadline)||typeof v.timer.id!=='string'||(v.timer.paused&&(!Number.isFinite(v.timer.remaining)||v.timer.remaining<0))))throw Error('타이머 기록 형식을 확인해 주세요.');
 }
 return e;
}
