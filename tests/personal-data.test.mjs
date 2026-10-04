import test from 'node:test';
import assert from 'node:assert/strict';
import {TrainingStore} from '../public/training-store.mjs';
import {readFile} from 'node:fs/promises';
import {DEFAULT_PROFILE,buildRoutine,createSession} from '../public/training.mjs';
import {PREFERENCES_KEY,TRAINING_PREFIX,clearDeviceData,deviceBackup,deviceSnapshot,deviceSummary,importDeviceBackup,isPersonalDataKey} from '../public/personal-data.mjs';
const storage=()=>{const map=new Map();return {get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
function fixture(){const data=storage(),store=new TrainingStore(data);store.save('profile','main',DEFAULT_PROFILE);store.save('preferences','catalog',{tools:['dumbbell'],favorites:['ex_1234567890abcd'],availableOnly:true});data.setItem(PREFERENCES_KEY,JSON.stringify({version:1,tools:['dumbbell'],favorites:['ex_1234567890abcd'],availableOnly:true}));store.switchAccount('account-a');store.save('max','ex_1234567890abcd',{exerciseId:'ex_1234567890abcd',value:50,source:'measured',basis:'total',step:2.5,date:'2026-10-04'});data.setItem('other-app.data','retain');data.setItem('firebase:authUser','retain');return{data,store};}
test('device reset removes every Move Atlas personal namespace and leaves other apps/auth data intact',()=>{
 const {data,store}=fixture(),backup=deviceBackup(data,store);assert.equal(Object.keys(backup.entries).length,3);
 assert.equal(clearDeviceData(data),3);assert.equal(data.getItem(PREFERENCES_KEY),null);assert.equal(data.getItem(TRAINING_PREFIX+'guest'),null);assert.equal(data.getItem(TRAINING_PREFIX+'account-a'),null);assert.equal(data.getItem('other-app.data'),'retain');assert.equal(data.getItem('firebase:authUser'),'retain');
 store.load();assert.equal(store.all('max').length,0);assert.equal(clearDeviceData(data),0);
});
test('a device backup restores settings, favorites and per-account records without overwriting newer data',()=>{
 const {data,store}=fixture(),backup=deviceBackup(data,store);clearDeviceData(data);assert.equal(importDeviceBackup(data,backup),3);store.load();assert.equal(store.all('max')[0].value,50);store.switchAccount('guest');assert.deepEqual(store.get('profile','main'),DEFAULT_PROFILE);assert.equal(deviceSummary(deviceSnapshot(data,store)).favorites,1);
 store.switchAccount('account-a');store.save('max','ex_1234567890abcd',{...store.all('max')[0],value:60});importDeviceBackup(data,backup);store.load();assert.equal(store.all('max')[0].value,60);assert.equal(data.getItem('other-app.data'),'retain');
});
test('invalid device backups cannot mutate any namespace or unrelated storage',()=>{
 const {data,store}=fixture(),before=deviceSnapshot(data,store);for(const bad of [{...deviceBackup(data,store),entries:{[TRAINING_PREFIX+'guest']:before[TRAINING_PREFIX+'guest'],'other-app.data':'delete'}},{...deviceBackup(data,store),entries:{[TRAINING_PREFIX+'guest']:before[TRAINING_PREFIX+'guest'],[TRAINING_PREFIX+'account-a']:'{"version":1,"entities":{"bad":{}}}'}}])assert.throws(()=>importDeviceBackup(data,bad));
 assert.deepEqual(deviceSnapshot(data,store),before);assert.equal(data.getItem('other-app.data'),'retain');assert.equal(isPersonalDataKey(TRAINING_PREFIX+'bad/namespace'),false);
});
test('a failed reset restores removed keys and reports failure instead of silently losing part of the data',()=>{
 const {data,store}=fixture(),before=deviceSnapshot(data,store),remove=data.removeItem;let once=true;data.removeItem=key=>{if(key===PREFERENCES_KEY&&once){once=false;throw Error('blocked');}return remove(key);};
 assert.throws(()=>clearDeviceData(data),/취소/);assert.deepEqual(deviceSnapshot(data,store),before);
});
test('a backup includes unsaved in-memory data after a storage failure and counts active workouts',()=>{
 const {data,store}=fixture();store.entities.session_example={id:'session_example',kind:'session',updatedAt:1,value:{status:'active'}};
 const summary=deviceSummary(deviceSnapshot(data,store));assert.equal(summary.active,1);assert.equal(summary.sessions,1);assert.equal(summary.profiles,1);assert.equal(summary.maxima,1);assert.equal(summary.favorites,1);
 assert.ok(JSON.parse(deviceBackup(data,store).entries[store.key]).entities.session_example);assert.equal(data.getItem(store.key).includes('session_example'),false);
});
test('a full reset and backup restore retains a valid active session, completed sets, notes and paused timer',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../public/catalog.json',import.meta.url))).exercises,{data,store}=fixture();store.switchAccount('guest');
 const session=createSession(buildRoutine(DEFAULT_PROFILE,{},[],catalog),0,Date.now(),'restore-session');
 Object.assign(session.exercises[0].sets[0],{done:true,actualWeight:10,actualReps:8,actualRir:2,changedAt:Date.now()});
 session.notes='fixture note';session.timer={id:'timer-fixture',deadline:Date.now()+90000,paused:true,remaining:75,label:'rest',notified:false};store.save('session',session.id,session);
 const backup=deviceBackup(data,store);clearDeviceData(data);store.load();assert.equal(store.get('session',session.id),null);importDeviceBackup(data,backup);store.load();
 assert.deepEqual(store.get('session',session.id),session);assert.equal(deviceSummary(deviceSnapshot(data,store)).active,1);
});
test('a failed backup import rolls back changes across namespaces',()=>{
 const {data,store}=fixture(),backup=deviceBackup(data,store),before=deviceSnapshot(data,store),set=data.setItem;let once=true;
 data.setItem=(key,value)=>{if(key===PREFERENCES_KEY&&once){once=false;throw Error('quota');}set(key,value);};
 assert.throws(()=>importDeviceBackup(data,backup),/취소/);assert.deepEqual(deviceSnapshot(data,store),before);
});
