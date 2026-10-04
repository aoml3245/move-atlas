import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut} from 'firebase/auth';
import {getFirestore,collection,doc,onSnapshot,runTransaction} from 'firebase/firestore';
import {mergeEntity} from '../public/training-store.mjs';

// Firebase Web configuration is public. Service-account credentials never belong here.
export function connectCloud(config,store,onStatus,onUser){
 const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);let unsubscribe=null,user=null,epoch=0;
 const pending=new Map();let ready=false,sending=false;
 async function flush(){
  if(!user||!ready||sending||!navigator.onLine)return;
  sending=true;const current=epoch,uid=user.uid;onStatus('syncing','동기화 중…');
  try{for(const [id,e]of [...pending]){
   if(epoch!==current)break;
   const ref=doc(db,'users',uid,'items',id);
   const merged=await runTransaction(db,async tx=>{const snap=await tx.get(ref);const value=mergeEntity(snap.exists()?snap.data():null,e);tx.set(ref,value);return value;});
   if(epoch!==current)break;
   store.receive(merged);if(pending.get(id)===e)pending.delete(id);
  }if(epoch===current)onStatus(pending.size?'pending':'synced',pending.size?'전송 대기 중':'기기 간 동기화 완료');
  }catch(error){if(epoch===current)onStatus('error',error.code==='permission-denied'?'동기화 권한을 확인해 주세요. 기록은 이 기기에 보관됩니다.':'연결을 기다리고 있어요. 기록은 이 기기에 보관됩니다.');}
  finally{if(epoch===current){sending=false;if(pending.size&&ready)setTimeout(flush,10000);}}
 }
 store.onWrite=e=>{if(user){pending.set(e.id,e);flush();}};
 const authWatch=onAuthStateChanged(auth,next=>{
  epoch++;unsubscribe?.();pending.clear();ready=false;sending=false;user=next;
  store.switchAccount(user?.uid);onUser(user?{uid:user.uid,name:user.displayName||'나의 계정',email:user.email||''}:null);
  if(!user){onStatus('guest','이 기기에 저장 중');return;}
  const current=epoch;onStatus('loading','내 기록을 가져오는 중…');
  // Remote first, then merge the per-account local queue. No guest-data overwrite.
  unsubscribe=onSnapshot(collection(db,'users',user.uid,'items'),{includeMetadataChanges:true},snapshot=>{
   if(current!==epoch)return;
   snapshot.forEach(d=>store.receive(d.data()));
   if(!snapshot.metadata.fromCache&&!ready){ready=true;Object.values(store.entities).forEach(e=>pending.set(e.id,e));flush();}
   if(ready&&!sending&&!pending.size)onStatus('synced','기기 간 동기화 완료');
  },error=>onStatus('error',error.code==='permission-denied'?'동기화 권한을 확인해 주세요.':'클라우드에 연결하지 못했어요. 기록은 이 기기에 보관됩니다.'));
 });
 window.addEventListener('online',flush);
 return {
  login:()=>{const p=new GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});return signInWithPopup(auth,p);},
  logout:async()=>{if(pending.size)throw Error('동기화가 끝난 뒤 로그아웃해 주세요. 백업을 먼저 저장할 수도 있어요.');return signOut(auth);},
  dispose:()=>{unsubscribe?.();authWatch();store.onWrite=null;window.removeEventListener('online',flush);}
 };
}
