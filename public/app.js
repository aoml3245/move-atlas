import { matchesExercise, sortExercises } from './filters.mjs';
import { assetUrl } from './urls.mjs';
import { initTraining } from './training-ui.mjs';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n.toLocaleString('ko-KR');
const iconPaths = {
 search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
 star:'<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-2.9-5.6 2.9 1-6.2L3.9 9.6l6.3-.9z"/>',
 arrow:'<path d="m9 5 7 7-7 7"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
 sliders:'<path d="M4 6h4m4 0h8M4 12h9m4 0h3M4 18h2m4 0h10"/><circle cx="10" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
 dumbbell:'<path d="m7 7 10 10M4 9l5-5m6 16 5-5M2 7l5-5m10 20 5-5"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
 leaf:'<path d="M20 3c-9-1-16 3-16 9a7 7 0 0 0 7 7c6 0 9-7 9-16ZM4 21 16 9"/>',
 link:'<path d="m10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
 download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
 check:'<path d="m5 12 4 4L19 6"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.2"/>',
 reset:'<path d="M4 11a8 8 0 1 1 2 7M4 4v7h7"/>',
 steps:'<path d="M3 20h6v-6h6V8h6M4 4h3m3 0h3"/>',
};
function icon(name, cls='') {return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.dumbbell}</svg>`;}
let data, results = [], shown = 60, openExercise, expandedTools = false;
let illustrations={version:1,approvedCount:0,assets:{}};
let illustrationProgress=null;
let training;
const KEY='move-atlas.preferences:v1';
function resetCatalogPreferences(){state={...base,tools:[],muscles:[],favorites:[],labels:{equipment:data.equipment,muscles:data.muscles}};$('#search').value='';renderFilters();updateResults();}
window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue===null&&data)resetCatalogPreferences();});
const base={region:'all',muscles:[],tools:[],availableOnly:false,includeSecondary:false,activity:'all',onlyFavorites:false,withImages:false,favorites:[],query:'',sort:'classic'};
let state={...base};
try {const p=JSON.parse(localStorage.getItem(KEY)||'null');if(p?.version===1) state={...state,tools:Array.isArray(p.tools)?p.tools:[],availableOnly:!!p.availableOnly,favorites:Array.isArray(p.favorites)?p.favorites:[]};} catch {}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({version:1,tools:state.tools,availableOnly:state.availableOnly,favorites:state.favorites}));window.dispatchEvent(new Event('move-atlas-preferences'));}catch{}}
const regions=[['all','모든 운동','grid'],['upper','상체','dumbbell'],['lower','하체','steps'],['core','코어','target'],['full','전신·유산소','bolt']];
const activities={all:'모든 유형',strength:'근력 운동',stretching:'스트레칭',cardio:'유산소',plyometrics:'점프·폭발력',powerlifting:'파워리프팅','olympic weightlifting':'역도',strongman:'스트롱맨',recovery:'호흡·회복'};
const commonTools=['dumbbell','barbell','bench','cable','machine','band','kettlebell','pullup_bar'];

async function start(){
 try {
  const response=await fetch(assetUrl('/catalog.json'),{cache:'no-cache'});if(!response.ok)throw Error('데이터를 불러오지 못했습니다.');data=await response.json();
  try {const r=await fetch(assetUrl('/illustrations/manifest.json'),{cache:'no-cache'});if(r.ok)illustrations=await r.json();}catch{}
  try {const r=await fetch(assetUrl('/illustrations/progress.json'));if(r.ok)illustrationProgress=await r.json();}catch{}
  data.exercises.forEach(x=>{x.hasIllustration=!!illustrations.assets[x.id];});
  state.tools=state.tools.filter(id=>data.equipment[id]&&id!=='unknown');
  state.favorites=state.favorites.filter(id=>data.exercises.some(x=>x.id===id));
  state.labels={equipment:data.equipment,muscles:data.muscles};
  $('#app').innerHTML=`
   <header class="topbar"><a class="brand" href="./" aria-label="Move Atlas 홈"><img src="./favicon.svg" alt=""><span>move<span class="brand-light">atlas</span><small>나의 운동 도감</small></span></a>
    <nav aria-label="메인 메뉴"><button class="nav-tab active" data-action="catalog">운동 도감</button><button class="nav-tab" data-action="favorites">${icon('star')} 즐겨찾기 <span id="favorite-count">${state.favorites.length}</span></button></nav>
    <button class="source-button" data-action="about" aria-label="데이터 출처">${icon('info')} <span>데이터 출처</span></button></header>
   <div class="workspace"><aside class="sidebar" id="filters" aria-label="운동 필터"></aside>
    <main><section class="intro"><div><div class="eyebrow"><span class="blue-dot"></span> YOUR MOVEMENT LIBRARY</div><h1>내 도구로 할 수 있는<br><span>운동을 찾아보세요.</span></h1><p>운동 부위와 준비된 도구를 골라 나에게 맞는 움직임을 탐색하세요.</p></div>
     <div class="catalog-stat"><span class="stat-decoration">${icon('dumbbell')}</span><small>하나로 모은 운동</small><strong>${fmt(data.meta.catalogTotal)}<span>개</span></strong><div><span class="source-dots"><i>F</i><i>E</i><i>W</i><i>L</i></span><span>4개의 공개 목록 통합</span></div></div></section>
     <div id="illustration-progress"></div><div class="search-toolbar"><div class="search-wrap">${icon('search')}<input id="search" type="search" placeholder="운동 이름, 부위, 도구로 검색" aria-label="운동 검색" autocomplete="off"><kbd>⌘ K</kbd></div><button class="mobile-filters" data-action="mobile-filters">${icon('sliders')} 필터</button></div>
     <div id="active-filters" class="active-filters"></div><div id="result-header"></div><div id="exercise-list" aria-label="운동 목록"></div><div id="list-footer"></div>
     <footer class="main-footer"><span>MOVE ATLAS <span class="footer-dot">·</span> 작은 움직임부터, 꾸준하게.</span><div class="footer-links"><a href="https://github.com/aoml3245/move-atlas" target="_blank" rel="noopener noreferrer">소스 코드</a><a href="./credits.html">출처·라이선스</a><button data-action="about">통합 기준 ${icon('arrow')}</button></div></footer>
    </main></div><div class="mobile-backdrop" data-action="mobile-close"></div>`;
  bind();renderFilters();updateResults();renderIllustrationProgress();
  training=initTraining({catalog:data,illustrations,getPreferences:()=>({tools:state.tools,availableOnly:state.availableOnly,favorites:state.favorites}),setPreferences:p=>{state.tools=(p.tools||[]).filter(id=>data.equipment[id]&&id!=='unknown');state.favorites=(p.favorites||[]).filter(id=>data.exercises.some(x=>x.id===id));state.availableOnly=!!p.availableOnly;try{localStorage.setItem(KEY,JSON.stringify({version:1,tools:state.tools,availableOnly:state.availableOnly,favorites:state.favorites}));}catch{}renderFilters();updateResults();},resetPreferences:resetCatalogPreferences,showDetail});
  if(illustrationProgress?.scope==='all-exercises')setInterval(refreshIllustrations,60000);
 } catch (error){$('#app').innerHTML=`<div class="initial-loading"><h1>운동 목록을 불러오지 못했어요.</h1><p>${esc(error.message)}</p><button id="retry" class="primary-button">다시 불러오기</button></div>`;$('#retry')?.addEventListener('click',()=>location.reload());}
}

function renderIllustrationProgress(){
 if(!illustrationProgress||!$('#illustration-progress'))return;
 const total=data.exercises.length,done=illustrations.approvedCount;
 const label=done===total?'전체 동작 이미지 검수 완료':illustrationProgress.status==='running'?'전체 운동 이미지 제작 중':'전체 운동 이미지 제작 현황';
 $('#illustration-progress').innerHTML=`<section class="production-progress" aria-label="전체 운동 이미지 제작 현황"><div><strong>${label}</strong><span>검수 완료 <b>${fmt(done)}</b> / ${fmt(total)}개</span></div><progress value="${done}" max="${total}" aria-label="동작 이미지 검수 완료"></progress><p>${done===total?'모든 운동의 동작 그림을 확인할 수 있어요.':`검수된 그림부터 추가하고 있어요.${illustrationProgress.awaitingVisualReview?` 새 그림 ${fmt(illustrationProgress.awaitingVisualReview)}개 검수 대기.`:''}`}</p></section>`;
}
async function refreshIllustrations(){
 if(document.hidden)return;
 try{
  const [mr,pr]=await Promise.all([fetch(assetUrl('/illustrations/manifest.json'),{cache:'no-store'}),fetch(assetUrl('/illustrations/progress.json'),{cache:'no-store'})]);
  if(pr.ok)illustrationProgress=await pr.json();
  if(mr.ok){
   const next=await mr.json();
   if(next.revision!==illustrations.revision||next.approvedCount!==illustrations.approvedCount){
    if(next.catalogRevision!==illustrations.catalogRevision){const cr=await fetch(assetUrl('/catalog.json'),{cache:'no-store'});if(cr.ok){data=await cr.json();state.labels={equipment:data.equipment,muscles:data.muscles};}}
    illustrations=next;data.exercises.forEach(x=>{x.hasIllustration=!!next.assets[x.id];});
    renderFilters();updateResults(false);
    if($('#detail-dialog').open&&!$('#image-dialog').open&&openExercise){const top=$('#detail-dialog').scrollTop;showDetail(openExercise.id);$('#detail-dialog').scrollTop=top;}
   }
  }
  renderIllustrationProgress();
 }catch{}
}

function renderFilters(){
 const toolIds=expandedTools?Object.keys(data.equipment).filter(x=>x!=='unknown'):commonTools;
 $('#filters').innerHTML=`<div class="sidebar-title"><span>${icon('sliders')} 운동 필터</span><button data-action="reset" title="필터 초기화" aria-label="필터 초기화">${icon('reset')}</button><button class="mobile-close" data-action="mobile-close" aria-label="필터 닫기">${icon('close')}</button></div>
  <section class="filter-section"><div class="filter-heading">운동 범위</div><div class="region-options">${regions.map(([id,label,ic])=>`<button data-region="${id}" class="region-option ${state.region===id?'selected':''}" aria-pressed="${state.region===id}">${icon(ic)}<span>${label}</span>${state.region===id?icon('check'):''}</button>`).join('')}</div></section>
  <section class="filter-section"><div class="filter-heading">집중할 부위 <small>여러 개 선택 가능</small></div><div class="muscle-chips">${Object.entries(data.muscles).map(([id,label])=>`<button class="muscle-chip ${state.muscles.includes(id)?'selected':''}" data-muscle="${id}" aria-pressed="${state.muscles.includes(id)}">${esc(label)}</button>`).join('')}</div><label class="secondary-option"><input id="include-secondary" type="checkbox" ${state.includeSecondary?'checked':''}> 보조 근육도 포함</label></section>
  <section class="filter-section tools-section"><div class="filter-heading">사용 가능한 도구 <button class="mode-toggle ${state.availableOnly?'on':''}" data-action="tools-mode" aria-pressed="${state.availableOnly}" title="선택한 도구로만 필터링">${state.availableOnly?'필터 켜짐':'모두 보기'}</button></div>
   <p class="tool-hint">${state.availableOnly?'선택한 도구를 모두 갖춘 운동과<br>맨몸 운동을 보여드려요.':'도구를 고르면 내 도구로 가능한<br>운동만 모아서 볼 수 있어요.'}</p>
   <div class="tool-list">${toolIds.map(id=>`<label class="tool-option"><input type="checkbox" data-tool="${id}" ${state.tools.includes(id)?'checked':''}><span>${esc(data.equipment[id])}</span></label>`).join('')}</div><button class="expand-tools" data-action="expand-tools">${expandedTools?'접기':'모든 도구 보기'} <span>${expandedTools?'−':'+'}</span></button>
   <div class="bodyweight-note">${icon('check')} 맨몸 운동은 항상 포함</div></section>
  <section class="filter-section"><label class="filter-heading" for="activity">운동 유형</label><select id="activity">${Object.entries(activities).map(([id,label])=>`<option value="${id}" ${state.activity===id?'selected':''}>${label}</option>`).join('')}</select></section>
  <section class="filter-section"><label class="illustrated-option"><input id="with-images" type="checkbox" ${state.withImages?'checked':''}><span>동작 이미지 있는 운동 <small>${fmt(illustrations.approvedCount)}개</small></span></label></section>
  <div class="sidebar-foot"><span class="blue-dot"></span> 도구와 즐겨찾기는 이 기기에 저장돼요.</div>`;
}

function updateResults(reset=true){
 if(reset)shown=60;
 results=sortExercises(data.exercises.filter(x=>matchesExercise(x,state)),state.sort);
 renderResults();renderActiveFilters();
 $('#favorite-count').textContent=state.favorites.length;
 if(!document.body.classList.contains('training-open'))document.querySelectorAll('.nav-tab').forEach(el=>el.classList.toggle('active',el.dataset.action===(state.onlyFavorites?'favorites':'catalog')));
}
function renderActiveFilters(){
 const chips=[];
 if(state.region!=='all')chips.push(`<button data-action="remove-region">${regions.find(x=>x[0]===state.region)[1]} ${icon('close')}</button>`);
 state.muscles.forEach(id=>chips.push(`<button data-remove-muscle="${id}">${esc(data.muscles[id])} ${icon('close')}</button>`));
 if(state.availableOnly)chips.push(`<button data-action="tools-mode">${state.tools.length?`내 도구 ${state.tools.length}개 + 맨몸`:'맨몸 운동'} ${icon('close')}</button>`);
  if(state.activity!=='all')chips.push(`<button data-action="remove-activity">${esc(activities[state.activity])} ${icon('close')}</button>`);
 if(state.withImages)chips.push(`<button data-action="remove-images">동작 이미지 ${icon('close')}</button>`);
 $('#active-filters').innerHTML=chips.length?chips.join('')+'<button class="clear-filters" data-action="reset">모두 지우기</button>':'';
}
function renderResults(){
 const title=state.onlyFavorites?'즐겨찾는 운동':'운동 목록';
 $('#result-header').innerHTML=`<div class="result-heading"><h2>${title} <span role="status" aria-live="polite">${fmt(results.length)}</span></h2><div><button class="images-toggle ${state.withImages?'active':''}" data-action="images-mode" aria-pressed="${state.withImages}">동작 이미지 <b>${fmt(illustrations.approvedCount)}</b></button><span class="result-note">${state.availableOnly?'내 도구로 가능한 운동':'동작·장비별로 정리된 목록'}</span><select id="sort" aria-label="목록 정렬"><option value="classic" ${state.sort==='classic'?'selected':''}>대표 운동 먼저</option><option value="korean" ${state.sort==='korean'?'selected':''}>가나다순</option><option value="english" ${state.sort==='english'?'selected':''}>영문 이름순</option><option value="sources" ${state.sort==='sources'?'selected':''}>출처가 많은 순</option></select></div></div>`;
 if(!results.length){
  const noFavorites=state.onlyFavorites&&!state.favorites.length;
  $('#exercise-list').innerHTML=`<div class="empty-state"><div>${icon(state.onlyFavorites?'star':'search')}</div><h3>${noFavorites?'아직 즐겨찾는 운동이 없어요.':state.onlyFavorites?'조건에 맞는 즐겨찾기가 없어요.':'조건에 맞는 운동이 없어요.'}</h3><p>${noFavorites?'운동 옆의 별을 눌러 나만의 목록을 만들어보세요.':'부위나 도구 조건을 조금 넓혀보세요.'}</p><button class="primary-button" data-action="${noFavorites?'catalog':'reset'}">${noFavorites?'운동 둘러보기':'필터 초기화'}</button></div>`;$('#list-footer').innerHTML='';return;
 }
 $('#exercise-list').innerHTML=`<div class="list-labels"><span>운동</span><span>주요 부위</span><span>필요한 도구</span><span></span></div><div class="exercise-rows">${results.slice(0,shown).map(x=>row(x)).join('')}</div>`;
 $('#list-footer').innerHTML=`<div class="list-end"><span>${fmt(Math.min(shown,results.length))} / ${fmt(results.length)}개 표시</span>${shown<results.length?`<button class="load-more" data-action="more">운동 더 보기 <span>+${Math.min(60,results.length-shown)}</span></button>`:'<span class="end-note">목록을 모두 확인했어요.</span>'}</div>`;
}
function row(x){
 const fav=state.favorites.includes(x.id),count=new Set(x.sources.map(s=>s.source)).size;
 const ic=x.activity==='stretching'?'leaf':x.activity==='cardio'?'bolt':x.regions.includes('core')?'target':'dumbbell';
 const illustration=illustrations.assets[x.id];
 const symbol=illustration?`<span class="exercise-preview"><img src="${esc(assetUrl(illustration.url))}" alt="" loading="lazy" decoding="async"></span>`:`<span class="exercise-symbol ${x.regions.includes('lower')?'lower':x.regions.includes('core')?'core':''}">${icon(ic)}</span>`;
 return `<article class="exercise-row"><button class="exercise-open" data-exercise="${x.id}" aria-label="${esc(x.nameKo)} 상세 정보">${symbol}<span class="exercise-names"><strong>${esc(x.nameKo)}</strong><span>${esc(x.name)}</span><span class="row-mobile-meta">${esc(x.primaryMuscles.map(m=>data.muscles[m]).join(' · ') || '부위 확인 필요')} <i>·</i> ${esc(x.equipment.map(e=>data.equipment[e]).join(' · ') || '맨몸')}</span></span></button><div class="row-muscles">${x.primaryMuscles.slice(0,2).map(m=>`<span>${esc(data.muscles[m])}</span>`).join('') || '<span class="muted">부위 확인 필요</span>'}${x.primaryMuscles.length>2?`<small>+${x.primaryMuscles.length-2}</small>`:''}</div><div class="row-equipment">${esc(x.equipment.map(e=>data.equipment[e]).join(' · ') || '맨몸')}<small>${count}개 출처${x.needsReview?' · 일부 정보 확인 필요':''}</small></div><button class="favorite ${fav?'saved':''}" data-favorite="${x.id}" aria-label="${esc(x.nameKo)} 즐겨찾기 ${fav?'해제':'추가'}" aria-pressed="${fav}">${icon('star')}</button><button class="row-arrow" data-exercise="${x.id}" aria-label="${esc(x.nameKo)} 상세 열기">${icon('arrow')}</button></article>`;
}

function illustrationExample(asset){
 if(!asset.exampleNoteKo)return "";
 return `<p class="illustration-example">${esc(asset.exampleNoteKo)}${(asset.referenceLinks||[]).map(r=>` <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label)}</a>`).join('')}</p>`;
}
function illustrationStep(asset,index,label,tag='p'){
 let step=((asset.stepsKo||[])[index]||'').trim();
 const caption=label.trim();
 if(!step||step===caption)return '';
 if(caption&&step.startsWith(caption)&&/\s/.test(step[caption.length]||''))step=step.slice(caption.length).trim();
 return `<${tag}>${esc(step)}</${tag}>`;
}
function methodImage(x){
 const asset=illustrations.assets[x.id];
 if(!asset)return `<section class="method-pending"><span>${icon('info')}</span><div><strong>동작 이미지 준비 중</strong><p>이 운동에 맞는 그림을 제작하고 있어요. 아래의 원본 운동 설명을 먼저 확인할 수 있어요.</p></div></section>`;
 const labels=asset.panels||['준비 자세','동작 자세'];
 return `<section class="method-section"><div class="method-heading"><h3>이미지로 보는 운동 방법</h3><span>직접 제작한 일러스트</span></div><button class="method-image-button" data-action="expand-image" aria-label="${esc(x.nameKo)} 동작 이미지 크게 보기"><img src="${esc(assetUrl(asset.url))}" alt="${esc(x.nameKo)}의 ${esc(labels.join('와 '))}" decoding="async"><span>${icon('search')} 크게 보기</span></button><div class="method-captions">${labels.map((label,i)=>`<div><strong><i>${i+1}</i>${esc(label)}</strong>${illustrationStep(asset,i,label)}</div>`).join('')}</div>${illustrationExample(asset)}</section>`;
}

function bodyMap(x){
 const has=part=>x.primaryMuscles.includes(part),color=active=>active?'#5270ed':'#dce0ed';
 const figure=back=>`<circle cy="17" r="11" fill="#dce0ed"/><path d="M-5 30h10v10H-5z" fill="${color(has('neck'))}"/><path d="M-19 39h38l10 31-9 48h-40l-9-48z" fill="#e6e9f2"/><path d="m-21 40-12 6-10 26 12 4 13-20m39-16 12 6 10 26-12 4-13-20" fill="${color(has('shoulders'))}"/><path d="m-42 76-7 21 11 4 8-23m72-2 7 21-11 4-8-23" fill="${color(has(back?'triceps':'biceps'))}"/><path d="m-49 100-9 30 9 3 11-30m87-3 9 30-9 3-11-30" fill="${color(has('forearms'))}"/>${back?`<path d="M-18 42h36l5 18-23 10-23-10z" fill="${color(has('upper_back'))}"/><path d="M-23 64-2 73-4 94h-14zm46 0L2 73l2 21h14z" fill="${color(has('lats'))}"/><path d="M-16 98h32l2 18h-36z" fill="${color(has('lower_back'))}"/><path d="M-20 120h18v17h-20zm22 0h18l2 17H2z" fill="${color(has('glutes'))}"/>`:`<path d="M-18 44h16v25h-23zm20 0h16l7 25H2z" fill="${color(has('chest'))}"/><path d="M-15 75h30l-2 36h-26z" fill="${color(has('abs'))}"/><path d="M-12 113h24l-12 8z" fill="${color(has('pelvic_floor'))}"/>`}<path d="M-20 ${back?140:122}h18l-4 41h-18zm22 0h18l4 41H6z" fill="${color(has(back?'hamstrings':'quads'))}"/><path d="M-3 124l-4 23h-7l4-23zM3 124l4 23h7l-4-23z" fill="${color(has('adductors'))}"/><path d="M-23 122h5l-2 22h-7zm41 0h5l4 22h-7z" fill="${color(has('abductors'))}"/><path d="m-24 167 18 1-4 29h-15zm30 1 18-1 1 30H10z" fill="${color(has('calves'))}"/>`;
 return `<svg class="body-map" viewBox="0 0 240 218" aria-label="주요 운동 부위 개요: ${esc(x.primaryMuscles.map(m=>data.muscles[m]).join(', '))}" role="img"><g transform="translate(61 0)">${figure(false)}</g><g transform="translate(179 0)">${figure(true)}</g><g fill="#8e9bb1" font-size="10" text-anchor="middle"><text x="61" y="214">앞</text><text x="179" y="214">뒤</text></g></svg>`;
}
function showDetail(id){
 const x=data.exercises.find(e=>e.id===id);if(!x)return;openExercise=x;
 const d=$('#detail-dialog');
 d.innerHTML=`<div class="detail-top"><span>운동 자세히 보기</span><button data-action="close-detail" aria-label="상세 닫기">${icon('close')}</button></div><div class="detail-content"><div class="detail-eyebrow">${esc(activities[x.activity]||'근력 운동')} <span>·</span> ${esc(x.movementLabel)}</div><h2>${esc(x.nameKo)}</h2><p class="detail-english">${esc(x.name)}</p><button class="detail-favorite ${state.favorites.includes(x.id)?'saved':''}" data-favorite="${x.id}">${icon('star')} ${state.favorites.includes(x.id)?'즐겨찾기에 저장됨':'즐겨찾기에 저장'}</button>
  ${['strength','powerlifting'].includes(x.activity)&&x.equipment.length?`<button class="detail-favorite" data-train="max-edit" data-id="${x.id}">${icon('target')} 내 최대 중량 입력</button>`:''}
  ${methodImage(x)}
  <div class="anatomy-card">${bodyMap(x)}<div><small>주요 운동 부위</small><strong>${esc(x.primaryMuscles.map(m=>data.muscles[m]).join(' · ')||'확인 필요')}</strong><span>${x.regions.map(r=>({upper:'상체',lower:'하체',core:'코어',full:'전신·유산소',recovery:'회복',uncategorized:'미분류'}[r])).join(' · ')}</span><div class="map-legend"><i></i> 주요 부위 표시</div></div></div>
  <p class="detail-summary">${esc(x.summaryKo)}</p><section class="detail-section"><h3>운동 정보</h3><dl><div><dt>필요한 도구</dt><dd>${esc(x.equipment.map(e=>data.equipment[e]).join(' · ')||'맨몸')}</dd></div><div><dt>함께 쓰는 부위</dt><dd>${esc(x.secondaryMuscles.map(m=>data.muscles[m]).join(' · ')||'원본에 추가 정보 없음')}</dd></div><div><dt>분류 방식</dt><dd>원본 정보를 공통 부위로 정리${x.supplements.length?' · 누락 정보 보완':''}</dd></div></dl>${x.needsReview?'<p class="review-note">원본의 도구 또는 주요 부위가 명확하지 않아 일부 정보는 확인이 필요해요. 도구가 미확인인 운동은 ‘내 도구’ 필터에서 제외됩니다.</p>':''}</section>
  ${x.aliases.length>1?`<details class="detail-section"><summary>다른 이름 <span>${x.aliases.length}</span></summary><div class="alias-list">${x.aliases.map(a=>`<span>${esc(a)}</span>`).join('')}</div></details>`:''}
  ${x.originalInstructions?`<details class="detail-section"><summary>원본 운동 설명 <span>${esc(data.sources[x.originalInstructions.source].name)}</span></summary><p class="original-instructions">${esc(x.originalInstructions.text)}</p><p class="license-caption"><a href="${esc(assetUrl(x.originalInstructions.licenseUrl))}" target="_blank" rel="noopener noreferrer">${esc(x.originalInstructions.license)}</a> · ${esc(x.originalInstructions.author||data.sources[x.originalInstructions.source].name)}<br>원문 HTML·공백 정리 · 출처별 이용 조건 유지</p></details>`:''}
  <section class="detail-section"><h3>이 운동의 출처 <span>${x.sources.length}</span></h3><div class="source-records">${x.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span><strong>${esc(data.sources[s.source].name)}</strong><small>${esc(s.name)}</small><small>${esc(s.license)}${s.author?' · '+esc(s.author):s.authorStatus==='not-supplied-by-upstream'?' · 작성자 미제공':''}</small></span>${icon('link')}</a>`).join('')}</div></section>
  <div class="detail-foot"><a href="./credits.html">전체 출처·저작권·이용 조건</a> · 그림·새 한국어 안내: <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a><br>한국어 표기·요약과 공통 분류는 도감을 위해 보완했습니다.<br>동작 일러스트는 원본 설명을 참고해 직접 제작했습니다.</div></div>`;
 if(!d.open)d.showModal();d.scrollTop=0;
}
function showAbout(){
 const d=$('#about-dialog');d.innerHTML=`<div class="detail-top"><span>하나의 도감, 여러 출처</span><button data-action="close-about" aria-label="출처 창 닫기">${icon('close')}</button></div><div class="about-content"><div class="eyebrow">THE CATALOG</div><h2>운동을 모으고,<br>같은 움직임을 연결했어요.</h2><div class="about-stats"><div><strong>${fmt(data.meta.inputTotal)}</strong><span>원본 항목</span></div><div><strong>${fmt(data.meta.mergedAway)}</strong><span>통합한 중복</span></div><div><strong>${fmt(data.meta.catalogTotal)}</strong><span>도감의 운동</span></div></div><div class="about-source-list">${Object.entries(data.sources).map(([id,s])=>`<div><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ${icon('link')}</a><strong>${fmt(data.meta.inputCounts[id])}개</strong><small><a href="${esc(assetUrl(s.licenseUrl))}" target="_blank" rel="noopener noreferrer">${esc(s.license)}</a>${id==='liftosaur'?' · 장비 변형 포함':''}</small></div>`).join('')}</div><section><h3>어떻게 정리했나요?</h3><p>이름의 표현·어순·복수형과 도구 이름을 통일해 같은 운동을 연결했습니다. 장비, 각도, 그립, 한팔·한발, 보조·중량 및 번호가 있는 변형은 따로 유지합니다.</p><p>근육 부위와 도구는 원본을 기준으로 정리하고, 누락된 정보는 동작 이름 또는 일치하는 다른 원본으로 보완했습니다. ${data.meta.needsReview}개 항목에는 명확하지 않은 정보가 남아 있어 ‘확인 필요’로 표시합니다. 서로 다른 이름의 모든 동작을 사람이 검수한 목록은 아닙니다.</p><p>원본 사진과 GIF는 가져오지 않았습니다. 동작 일러스트는 직접 제작했으며, 현재 ${fmt(illustrations.approvedCount)}개 운동의 그림을 검수해 연결했습니다. 원본 설명의 라이선스와 출처는 운동 상세에서 확인할 수 있습니다.</p></section><section><h3>이용 조건과 공개 소스</h3><p>웹앱 코드는 AGPL-3.0으로 공개합니다. 가져온 설명은 각 원본의 이용 조건을 유지하며, 작성자와 번역별 라이선스를 함께 보존합니다. 그림과 새 한국어 안내는 CC BY-SA 4.0으로 제공합니다.</p><p><a href="./credits.html">전체 출처·저작권·라이선스 고지</a> · <a href="https://github.com/aoml3245/move-atlas" target="_blank" rel="noopener noreferrer">소스 코드 받기</a></p></section><div class="about-bottom"><small>원본 확인 · ${data.meta.checkedAt}</small><a class="primary-button" href="./catalog.json" target="_blank" rel="noopener noreferrer">${icon('download')} 통합 목록 JSON</a></div></div>`;d.showModal();
}

function toggleFavorite(id){
 state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];persist();updateResults(false);
 if($('#detail-dialog').open&&openExercise?.id===id){const top=$('#detail-dialog').scrollTop;showDetail(id);$('#detail-dialog').scrollTop=top;}
}
function reset(){state={...state,region:'all',muscles:[],availableOnly:false,includeSecondary:false,withImages:false,activity:'all',query:''};$('#search').value='';persist();renderFilters();updateResults();}
function closeMobile(){document.body.classList.remove('filters-open');}
function bind(){
 $('#search').addEventListener('input',e=>{state.query=e.target.value;updateResults();});
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search').focus();}if(e.key==='Escape')closeMobile();});
 document.addEventListener('change',e=>{
  if(e.target.dataset.tool){const id=e.target.dataset.tool;state.tools=e.target.checked?unique([...state.tools,id]):state.tools.filter(x=>x!==id);state.availableOnly=true;persist();renderFilters();updateResults();}
  if(e.target.id==='include-secondary'){state.includeSecondary=e.target.checked;updateResults();}
  if(e.target.id==='with-images'){state.withImages=e.target.checked;updateResults();}
  if(e.target.id==='activity'){state.activity=e.target.value;updateResults();}
  if(e.target.id==='sort'){state.sort=e.target.value;updateResults();}
 });
 document.addEventListener('click',e=>{
  const el=e.target.closest('button, [data-action]');if(!el)return;
  if(el.dataset.region){state.region=el.dataset.region;renderFilters();updateResults();}
  if(el.dataset.muscle||el.dataset.removeMuscle){const id=el.dataset.muscle||el.dataset.removeMuscle;state.muscles=state.muscles.includes(id)?state.muscles.filter(x=>x!==id):[...state.muscles,id];renderFilters();updateResults();}
  if(el.dataset.exercise)showDetail(el.dataset.exercise);
  if(el.dataset.favorite)toggleFavorite(el.dataset.favorite);
  if(el.dataset.imagePanel){$('.image-stage').dataset.stage=el.dataset.imagePanel;$('#image-dialog').dataset.stage=el.dataset.imagePanel;$('#image-dialog').querySelectorAll('[data-image-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.imagePanel===el.dataset.imagePanel)));}
  const action=el.dataset.action;
  if(action==='reset')reset();
  if(action==='remove-region'){state.region='all';renderFilters();updateResults();}
  if(action==='remove-activity'){state.activity='all';renderFilters();updateResults();}
  if(action==='remove-images'){state.withImages=false;renderFilters();updateResults();}
  if(action==='images-mode'){state.withImages=!state.withImages;renderFilters();updateResults();}
  if(action==='tools-mode'){state.availableOnly=!state.availableOnly;persist();renderFilters();updateResults();}
  if(action==='expand-tools'){expandedTools=!expandedTools;renderFilters();}
  if(action==='more'){shown+=60;renderResults();}
  if(action==='favorites'||action==='catalog'){state.onlyFavorites=action==='favorites';updateResults();}
  if(action==='about')showAbout();
  if(action==='close-detail')$('#detail-dialog').close();
  if(action==='close-about')$('#about-dialog').close();
  if(action==='expand-image'&&openExercise){const asset=illustrations.assets[openExercise.id];if(asset){const d=$('#image-dialog');d.innerHTML=`<div class="detail-top"><span>${esc(openExercise.nameKo)}</span><button data-action="close-image" aria-label="이미지 닫기">${icon('close')}</button></div><div class="image-panel-options" aria-label="이미지 자세 선택"><button data-image-panel="all" aria-pressed="true">전체</button><button data-image-panel="setup" aria-pressed="false">${esc(asset.panels[0])}</button><button data-image-panel="action" aria-pressed="false">${esc(asset.panels[1])}</button></div><div class="image-stage" data-stage="all"><img src="${esc(assetUrl(asset.url))}" alt="${esc(openExercise.nameKo)} 동작 일러스트"></div><div class="image-dialog-captions">${(asset.panels||['준비 자세','동작 자세']).map((p,i)=>`<span data-image-caption="${i?'action':'setup'}"><strong>${esc(p)}</strong>${illustrationStep(asset,i,p,'small')}</span>`).join('')}</div>${illustrationExample(asset)}`;d.dataset.stage='all';d.showModal();}}
  if(action==='close-image')$('#image-dialog').close();
  if(action==='mobile-filters')document.body.classList.add('filters-open');
  if(action==='mobile-close')closeMobile();
 });
 for(const d of [$('#detail-dialog'),$('#about-dialog'),$('#image-dialog')])d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
}
function unique(xs){return [...new Set(xs)];}
start();
