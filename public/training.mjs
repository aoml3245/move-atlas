// Independently written training rules. References and template adaptations: training-guide.html.
export const PROGRAMS = {
 percent: {name:'1RM 비율 루틴', description:'최대 중량의 60–80%부터, 목표에 맞춰 반복 수를 배분해요.', flexible:true},
 rir: {name:'RIR · 여유 반복', description:'세트가 끝났을 때 2회 정도 더 할 수 있는 중량을 찾아요.', flexible:true},
 double: {name:'반복 수 먼저 · 이중 점진', description:'8–12회를 모두 채우면 다음 운동에서 조금 증량해요.', flexible:true},
 five: {name:'5×5 · StrongLifts 참고', description:'주 3회 전신 A/B. 스쿼트·프레스·로우와 데드리프트를 순환해요.', flexible:false},
 wave: {name:'5/3/1 · 5’s PRO 참고', description:'훈련 최대 중량(TM) 85% 기준, 3주 파동 + 가벼운 1주. 앱 조정 템플릿이에요.', flexible:false}
};
export const SPLITS = {full:'전신', upperLower:'2분할 · 상체 / 하체', ppl:'3분할 · 밀기 / 당기기 / 하체', four:'4분할 · 가슴 / 등 / 하체 / 어깨'};
export const CANDIDATES = [
 ['ex_1aabe3bea44907','squat',['barbell','plates','power_rack'],'total'],
 ['ex_63bf6684c8192a','squat',['dumbbell'],'single'],
 ['ex_4f4b695cd6fe95','squat',['machine'],'machine'],
 ['ex_b4da1c17872177','squat',[],'bodyweight'],
 ['ex_c9b82dda3a0dfa','bench',['barbell','plates','bench','power_rack'],'total'],
 ['ex_e8875fab9aefae','bench',['dumbbell','bench'],'perHand'],
 ['ex_99b356e3d6487f','bench',[],'bodyweight'],
 ['ex_89a744cf047a80','hinge',['barbell','plates'],'total'],
 ['ex_ce712f77fae89b','hinge',['dumbbell'],'perHand'],
 ['ex_855748705e5152','hinge',[],'bodyweight'],
 ['ex_47661bcde402a9','row',['barbell','plates'],'total'],
 ['ex_0c60f04539e542','row',['dumbbell'],'perHand'],
 ['ex_ef3e95f1806a8f','row',['cable','cable_bar'],'machine'],
 ['ex_6dbf22472400d2','pull',['cable','cable_bar'],'machine'],
 ['ex_faa1ccab50214f','pull',['pullup_bar'],'bodyweight'],
 ['ex_4bacc057ae79a7','press',['barbell','plates','power_rack'],'total'],
 ['ex_53481857b21d13','press',['dumbbell','bench'],'perHand'],
 ['ex_1ee00d2c293c66','curl',['dumbbell'],'perHand'],
 ['ex_cc6db9743ebf21','triceps',['cable','cable_bar'],'machine'],
 ['ex_c8682b6a627e0a','lunge',['dumbbell'],'perHand'],
 ['ex_9deabf2f823925','legCurl',['machine'],'machine'],
 ['ex_9f810ff6c8fcea','calf',['machine'],'machine'],
 ['ex_063a170f9da60b','core',[],'seconds']
].map(([id,role,required,basis])=>({id,role,required,basis}));
export const BASIS = {total:'바 포함 총중량', perHand:'덤벨 한 손당', single:'도구 하나의 중량', machine:'해당 머신 표시 중량', bodyweight:'맨몸', seconds:'시간(초)', added:'추가 중량'};
export const DEFAULT_PROFILE = {split:'upperLower',program:'percent',goal:'muscle',experience:'beginner',days:[1,3,5],minutes:60,equipment:['dumbbell','bench'],step:2.5,barWeight:20,recordMode:'test',sound:true,keepAwake:true};
export function estimate1RM(weight,reps,rir=0){
 weight=Number(weight);reps=Number(reps);rir=Number(rir);
 if(!Number.isFinite(weight)||weight<=0||!Number.isInteger(reps)||reps<1||reps>10||!Number.isInteger(rir)||rir<0||rir>3||reps+rir>10)throw Error('추정에는 1–10회와 여유 반복 0–3회가 필요해요. 두 값을 합쳐 10회 이내로 입력해 주세요.');
 return Math.round((reps===1&&rir===0?weight:weight*(1+(reps+rir)/30))*10)/10;
}
export function roundLoad(weight,step=2.5,min=0){
 if(!Number.isFinite(weight)||weight<=0||!Number.isFinite(step)||step<=0)return null;
 const rounded=Math.floor((weight+1e-8)/step)*step;
 return rounded>=min&&rounded>0?Math.round(rounded*100)/100:null;
}
export function availableCandidates(profile,catalog){
 const byId=new Map(catalog.map(x=>[x.id,x]));
 return CANDIDATES.filter(c=>byId.has(c.id)&&!byId.get(c.id).needsReview&&c.required.every(e=>profile.equipment.includes(e)));
}
const PATTERNS={full:[['전신 A',['squat','bench','row','core']],['전신 B',['hinge','press','pull','core']]],upperLower:[['상체',['bench','row','press','pull','curl']],['하체',['squat','hinge','lunge','legCurl','calf','core']]],ppl:[['밀기',['bench','press','triceps','core']],['당기기',['row','pull','curl','core']],['하체',['squat','hinge','lunge','calf','core']]],four:[['가슴 · 삼두',['bench','triceps','core']],['등 · 이두',['row','pull','curl']],['하체',['squat','hinge','legCurl','calf']],['어깨 · 코어',['press','core']]]};
export function validateProfile(profile){
 if(!PROGRAMS[profile.program]||!SPLITS[profile.split])throw Error('분할과 루틴 방식을 골라 주세요.');
 if(!['muscle','strength','general'].includes(profile.goal)||!['beginner','trained'].includes(profile.experience)||![35,50,60,90].includes(profile.minutes)||!['records','test'].includes(profile.recordMode))throw Error('목표·경험·시간·중량 시작 방법을 확인해 주세요.');
 if(!Array.isArray(profile.days)||!profile.days.length||new Set(profile.days).size!==profile.days.length||profile.days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('운동할 요일을 하나 이상 골라 주세요.');
 if(!Number.isFinite(profile.step)||profile.step<=0||profile.step>100||!Number.isFinite(profile.barWeight)||profile.barWeight<0||profile.barWeight>100)throw Error('증량 단위와 바 중량을 확인해 주세요.');
 if(!Array.isArray(profile.equipment))throw Error('사용 가능한 도구를 골라 주세요.');
 if(profile.program==='five'){
  if(profile.days.length!==3)throw Error('5×5 참고 루틴은 주 3일을 골라 주세요.');
  const ds=[...profile.days].sort((a,b)=>a-b);if(ds.some((d,i)=>(ds[(i+1)%ds.length]+(i===ds.length-1?7:0)-d)<2))throw Error('5×5는 운동일 사이에 하루 이상 쉬도록 요일을 골라 주세요.');
 }
 if(profile.program==='wave'&&profile.days.length!==4)throw Error('5/3/1 참고 루틴은 주 4일을 골라 주세요.');
 if(['five','wave'].includes(profile.program)&&!['barbell','plates','bench','power_rack'].every(e=>profile.equipment.includes(e)))throw Error('이 참고 템플릿에는 바벨, 플레이트, 벤치, 파워랙·안전바가 필요해요. 다른 장비에서는 일반 루틴을 골라 주세요.');
 return profile;
}
export function planSets(program,profile,record,basis,role,cycle=0,prior=null){
 const max=record?.value;const step=record?.step||profile.step;const min=basis==='total'?profile.barWeight:0;
 const load=p=>max&&basis!=='bodyweight'&&basis!=='seconds'?roundLoad(max*p,step,min):null;
 let specs;
 if(basis==='seconds')specs=[[0,30],[0,30]];
 else if(program==='five')specs=Array.from({length:role==='hinge'?1:5},()=>[.6,5]);
 else if(program==='wave'){
  const pcts=[[.65,.75,.85],[.7,.8,.9],[.75,.85,.95],[.4,.5,.6]][cycle%4];
  specs=pcts.map(p=>[p*.85,5]);
 }else if(program==='percent'){
  specs=profile.goal==='strength'&&profile.experience!=='beginner'?[[.7,6],[.8,4],[.9,2]]:profile.experience==='beginner'?[[.6,10],[.65,8],[.7,6]]:[[.6,12],[.7,8],[.8,5]];
 }else specs=Array.from({length:3},()=>[.65,program==='double'?8:8]);
 return specs.map(([pct,reps],i)=>({id:String(i),kind:'work',weight:['five','double','rir'].includes(program)&&prior?.weight>0?roundLoad(prior.weight,step,min):load(pct),reps,repsMax:program==='double'?12:reps,rir:2,percent:max&&pct?Math.round(pct*1000)/10:null,restSeconds:basis==='seconds'?60:program==='five'||program==='wave'||profile.goal==='strength'?180:90,basis}));
}
export function lastProgress(exerciseId,program,sessions,record,profile){
 const completed=sessions.filter(s=>s.status==='complete').sort((a,b)=>b.startedAt-a.startedAt);
 for(const session of completed){
  if(session.program!==program)continue;
  const e=session.exercises?.find(e=>e.exerciseId===exerciseId);if(!e)continue;
  const sets=e.sets.filter(s=>s.kind==='work');if(!sets.length||!sets.every(s=>s.done&&s.actualWeight>0))return null;
  const weight=sets[0].actualWeight;if(!sets.every(s=>s.actualWeight===weight))return null;
  const step=record?.step||profile.step;
  const success=sets.every(s=>s.actualReps>=(program==='double'?12:s.reps)&&(s.actualRir??2)>=1);
  return {weight:weight+(success&&['five','double'].includes(program)?step:0),message:success&&['five','double'].includes(program)?'지난 목표 달성 · 한 단계 증량':'지난 중량으로 시작 · 여유 반복에 맞춰 조절'};
 }
 return null;
}
export function buildRoutine(profile,maxima={},sessions=[],catalog=[]){
 validateProfile(profile);const candidates=availableCandidates(profile,catalog),byId=new Map(catalog.map(e=>[e.id,e]));
 let patterns=PATTERNS[profile.split];
 if(profile.program==='five')patterns=[['5×5 A',['squat','bench','row']],['5×5 B',['squat','press','hinge']]];
 if(profile.program==='wave')patterns=[['프레스',['press','row','core']],['데드리프트',['hinge','pull','core']],['벤치프레스',['bench','row','curl']],['스쿼트',['squat','legCurl','core']]];
 const completed=sessions.filter(s=>s.status==='complete'&&s.program===profile.program&&s.split===profile.split).length;
 const cycle=Math.floor(completed/(profile.program==='wave'?4:Math.max(profile.days.length,1)));
 const maxExercises=profile.minutes<=35?3:profile.minutes<=50?4:6;
 const days=patterns.map(([name,roles],index)=>{
  const missing=[],used=new Set();const exercises=[];
  for(const role of roles.slice(0,maxExercises)){
   let c=candidates.find(c=>c.role===role&&!used.has(c.id));if(!c){missing.push(role);continue;}
   const swap=candidates.find(option=>option.id===profile.swaps?.[c.id]&&option.role===role&&!used.has(option.id));if(swap)c=swap;
   used.add(c.id);
   const x=byId.get(c.id),record=maxima[c.id]?.basis===c.basis?maxima[c.id]:null,prior=lastProgress(c.id,profile.program,sessions,record,profile);
   const mode=profile.program==='wave'&&role!==roles[0]?'double':profile.program;
   let sets=planSets(mode,profile,record,c.basis,role,cycle,prior);
   const testing=!record&&profile.recordMode==='test'&&!['bodyweight','seconds'].includes(c.basis);
   if(testing&&!['five','wave'].includes(profile.program))sets=sets.slice(0,2).map((s,i)=>({...s,reps:i?5:8,repsMax:i?8:8,percent:null,weight:null,restSeconds:180}));
   const working=sets.find(s=>s.weight)?.weight;
   const warmup=working&&c.basis!=='bodyweight'&&c.basis!=='seconds'?[.5,.75].map((p,i)=>({id:`w${i}`,kind:'warmup',weight:roundLoad(working*p,record?.step||profile.step,c.basis==='total'?profile.barWeight:0),reps:i?5:8,restSeconds:60,basis:c.basis})).filter(s=>s.weight&&s.weight<working):[];
   exercises.push({exerciseId:c.id,name:x.nameKo,basis:c.basis,role,testing,sets:[...warmup,...sets],note:prior?.message||(testing?'가벼운 테스트 · 5–8회와 여유 반복을 기록한 뒤 추정 1RM으로 저장해요.':!record&&c.basis!=='bodyweight'&&c.basis!=='seconds'?'중량 미설정 · 가볍게 시작해 기록을 넣어 주세요.':''),measuredAt:record?.date||null});
  }
  return {index,name,exercises,missing,warmup:[{id:'walk',name:'편하게 걷기',seconds:300},{id:'dynamic',name:'동적 스트레칭',seconds:180}],cycle};
 });
 if(days.some(d=>!d.exercises.length))throw Error('선택한 장비로 이 분할을 구성하기 어려워요. 전신 분할을 고르거나 도구를 추가해 주세요.');
 return {program:profile.program,split:profile.split,days,nextDay:completed%days.length,cycle};
}
export function createSession(plan,dayIndex,now=Date.now(),id=globalThis.crypto.randomUUID()){
 const day=plan.days[dayIndex];
 return {id,program:plan.program,split:plan.split,dayIndex,name:day.name,cycle:plan.cycle,startedAt:now,status:'active',warmup:day.warmup.map(w=>({...w,done:false})),exercises:structuredClone(day.exercises),notes:'',timer:null};
}
export function sessionStats(session){
 const done=session.exercises.flatMap(e=>e.sets.filter(s=>s.done&&s.kind==='work').map(s=>({...s,basis:e.basis})));
 return {sets:done.length,volume:done.reduce((n,s)=>n+(s.basis==='seconds'||s.basis==='bodyweight'?0:(s.actualWeight||0)*(s.actualReps||0)*(s.basis==='perHand'?2:1)),0)};
}
export function remainingSeconds(timer,now=Date.now()){
 if(!timer)return 0;return timer.paused?timer.remaining:Math.max(0,Math.ceil((timer.deadline-now)/1000));
}
export function needsReview(record,now=Date.now()){return !!record&&now-new Date(record.date+'T00:00:00').getTime()>56*86400000;}
