import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc} from 'firebase/firestore';
const enabled=!!process.env.FIRESTORE_EMULATOR_HOST;
test('Firestore isolates accounts and rejects anonymous or malformed writes',{skip:!enabled},async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-move-atlas',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
 try{
  const alice=env.authenticatedContext('alice').firestore(),bob=env.authenticatedContext('bob').firestore(),guest=env.unauthenticatedContext().firestore();
  const data={id:'profile_main',kind:'profile',value:{split:'full'},updatedAt:Date.now()};
  await assertSucceeds(setDoc(doc(alice,'users/alice/items/profile_main'),data));
  await assertSucceeds(getDoc(doc(alice,'users/alice/items/profile_main')));
  await assertFails(getDoc(doc(bob,'users/alice/items/profile_main')));
  await assertFails(setDoc(doc(bob,'users/alice/items/profile_main'),data));
  await assertFails(getDoc(doc(guest,'users/alice/items/profile_main')));
  await assertFails(setDoc(doc(alice,'users/alice/items/profile_main'),{...data,kind:'admin'}));
  await assertFails(setDoc(doc(alice,'users/alice/items/profile_main'),{...data,updatedAt:Date.now()+86400000}));
  await assertFails(setDoc(doc(alice,'users/alice/items/profile_main'),{...data,value:'bad'}));
 }finally{await env.cleanup();}
});
