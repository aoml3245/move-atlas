// SPDX-License-Identifier: AGPL-3.0-only
import {mergeEntity,validateBackup} from './training-store.mjs';
export const PREFERENCES_KEY='move-atlas.preferences:v1';
export const TRAINING_PREFIX='move-atlas.training:v1:';
export const isPersonalDataKey=key=>key===PREFERENCES_KEY||typeof key==='string'&&key.startsWith(TRAINING_PREFIX)&&/^[A-Za-z0-9_-]{1,128}$/.test(key.slice(TRAINING_PREFIX.length));
export function deviceSnapshot(storage,store){
 const entries={};for(let i=0;i<storage.length;i++){const key=storage.key(i);if(isPersonalDataKey(key))entries[key]=storage.getItem(key);}
 // Include a record still in memory after a storage-capacity error in the backup.
 if(store)entries[store.key]=JSON.stringify({version:1,entities:store.entities});
 return entries;
}
export function deviceSummary(entries){
 const result={profiles:0,maxima:0,sessions:0,active:0,favorites:0,spaces:0,unreadable:0};const favorites=new Set();
 for(const [key,raw]of Object.entries(entries))try{
  const data=JSON.parse(raw);if(key===PREFERENCES_KEY){for(const id of data.favorites||[])favorites.add(id);continue;}
  result.spaces++;for(const entry of Object.values(data.entities||{})){if(entry.deleted)continue;if(entry.kind==='profile')result.profiles++;if(entry.kind==='max')result.maxima++;if(entry.kind==='session'){result.sessions++;if(entry.value.status==='active')result.active++;}if(entry.kind==='preferences')for(const id of entry.value.favorites||[])favorites.add(id);}
 }catch{result.unreadable++;}
 result.favorites=favorites.size;return result;
}
export function deviceBackup(storage,store){return {format:'move-atlas-device-backup',version:1,exportedAt:new Date().toISOString(),entries:deviceSnapshot(storage,store)};}

function commitChanges(storage,changes){
 const before=new Map(Object.keys(changes).map(key=>[key,storage.getItem(key)]));
 try{for(const [key,value]of Object.entries(changes))value===null?storage.removeItem(key):storage.setItem(key,value);}
 catch{
  let restored=true;for(const [key,value]of before)try{value===null?storage.removeItem(key):storage.setItem(key,value);}catch{restored=false;}
  throw Error(restored?'기기 저장소에 접근하지 못해 변경을 취소했어요. 다시 시도해 주세요.':'기기 저장소 오류로 일부 데이터만 변경됐을 수 있어요. 백업 파일을 보관해 주세요.');
 }
}
export function clearDeviceData(storage){
 const snapshot=deviceSnapshot(storage);commitChanges(storage,Object.fromEntries(Object.keys(snapshot).map(key=>[key,null])));
 return Object.keys(snapshot).length;
}
export function importDeviceBackup(storage,backup){
 if(backup?.format!=='move-atlas-device-backup'||backup.version!==1||!backup.entries||Array.isArray(backup.entries)||typeof backup.entries!=='object'||Object.keys(backup.entries).length>51)throw Error('Move Atlas 기기 백업 파일을 골라 주세요.');
 const changes={};let count=0;
 // Validate and prepare every namespace before changing any stored data.
 for(const [key,raw]of Object.entries(backup.entries)){
  if(!isPersonalDataKey(key)||typeof raw!=='string')throw Error('백업에 알 수 없는 저장 항목이 있어요.');const incoming=JSON.parse(raw);
  let local;try{local=JSON.parse(storage.getItem(key)||'null');}catch{}
  if(key===PREFERENCES_KEY){
   if(incoming?.version!==1||!Array.isArray(incoming.tools)||!Array.isArray(incoming.favorites)||[...incoming.tools,...incoming.favorites].some(x=>typeof x!=='string'))throw Error('도감 설정 형식을 확인해 주세요.');
   changes[key]=JSON.stringify({...incoming,tools:[...new Set([...(local?.tools||[]),...incoming.tools])],favorites:[...new Set([...(local?.favorites||[]),...incoming.favorites])]});
  }else{
   validateBackup({format:'move-atlas-training-backup',version:incoming?.version,entities:incoming?.entities});count+=Object.keys(incoming.entities).length;if(count>50000)throw Error('백업의 기록 수가 너무 많아요.');
   const entities=local?.version===1?{...local.entities}:{};for(const [id,entry]of Object.entries(incoming.entities))entities[id]=mergeEntity(entities[id],entry);
   changes[key]=JSON.stringify({version:1,entities});
  }
 }
 commitChanges(storage,changes);return count;
}
