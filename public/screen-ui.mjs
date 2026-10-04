// SPDX-License-Identifier: AGPL-3.0-only
import {clampPage,resumeSet,sessionPosition,textPages} from './screen-state.mjs';
import {assetUrl} from './urls.mjs';
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const button=(text,action)=>{const node=el('button','screen-button',text);node.type='button';node.dataset.screen=action;return node;};
const children=node=>Array.from(node?.children||[]);

export function showScreenInfo(title,blocks){
 let dialog=document.querySelector('#screen-info-dialog');if(!dialog){dialog=el('dialog','screen-dialog');dialog.id='screen-info-dialog';document.body.append(dialog);}
 const close=button('닫기','info-close'),heading=el('h2','',title),top=el('div','screen-dialog-top');top.append(heading,close);
 const content=el('div','screen-dialog-content'),pages=[];
 for(const original of blocks){
  if(typeof original==='string'){for(const part of textPages(original))pages.push(el('p','',part));}
  else if(original.matches('p')&&original.textContent.length>650&&!original.querySelector('a'))for(const part of textPages(original.textContent))pages.push(el('p','',part));
  else {const copy=original.cloneNode(true);copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));pages.push(copy);}
 }
 if(!pages.length)pages.push(el('p','','아직 내용이 없어요.'));
 let index=0;const footer=el('div','screen-pager'),previous=button('이전','info-prev'),next=button('다음','info-next'),label=el('span','screen-page-count');footer.append(previous,label,next);
 const render=()=>{content.replaceChildren(pages[index]);label.textContent=`${index+1} / ${pages.length}`;previous.disabled=index===0;next.disabled=index===pages.length-1;};
 previous.onclick=()=>{index--;render();};next.onclick=()=>{index++;render();};close.onclick=()=>dialog.close();
 dialog.onclick=e=>{if(e.target.closest('[data-train]'))dialog.close();};dialog.setAttribute('aria-label',title);dialog.replaceChildren(top,content,footer);render();if(!dialog.open)dialog.showModal();
}

export function installCompactNavigation(){
 const top=document.querySelector('.topbar');if(!top||top.querySelector('.screen-menu-toggle'))return;
 const menu=button('메뉴','menu');menu.classList.add('screen-menu-toggle');menu.setAttribute('aria-label','전체 메뉴');top.append(menu);
 menu.onclick=()=>{
  let dialog=document.querySelector('#screen-menu');if(!dialog){dialog=el('dialog','screen-dialog screen-menu');dialog.id='screen-menu';document.body.append(dialog);}
  const title=el('h2','','어디로 갈까요?'),close=button('닫기','menu-close'),head=el('div','screen-dialog-top'),grid=el('nav','screen-menu-grid');head.append(title,close);close.onclick=()=>dialog.close();
  for(const original of top.querySelectorAll('.nav-tab,.source-button')){const copy=original.cloneNode(true);copy.className='screen-button';copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));grid.append(copy);}
  grid.addEventListener('click',e=>{if(e.target.closest('button'))dialog.close();});dialog.replaceChildren(head,grid);dialog.showModal();
 };
 document.body.classList.add('card-app');
 const size=()=>{document.documentElement.style.setProperty('--app-height',`${window.visualViewport?.height||window.innerHeight}px`);};size();window.visualViewport?.addEventListener('resize',size);
}

export class CardScreens {
 constructor(root){
  this.root=root;this.positions=new Map();this.setPositions=new Map();this.drafts=new Map();
  root.addEventListener('click',e=>{const target=e.target.closest('[data-screen]');if(!target)return;
   if(target.dataset.screen==='prev')this.go(this.index-1);
   if(target.dataset.screen==='next')this.go(this.index+1);
   if(target.dataset.screen==='set-prev')this.setGo(Number(target.dataset.ei),-1);
   if(target.dataset.screen==='set-next')this.setGo(Number(target.dataset.ei),1);
  });
  root.addEventListener('change',e=>{if(e.target.dataset.screen==='page-select')this.go(Number(e.target.value));if(e.target.dataset.screen==='set-select')this.setGo(Number(e.target.dataset.ei),0,Number(e.target.value));});
  root.addEventListener('toggle',e=>{if(!e.target.matches('details')||!e.target.open)return;
   const details=e.target,summary=details.querySelector('summary')?.textContent||'설명',list=details.querySelector('dl');details.open=false;
   showScreenInfo(summary,list?children(list):children(details).filter(n=>n.tagName!=='SUMMARY'));
  },true);
  root.addEventListener('invalid',e=>{const page=e.target.closest('.screen-page');if(page)this.go(this.pages.indexOf(page),false);},true);
  root.addEventListener('input',e=>{const form=e.target.closest('.set-form');if(form&&e.target.name)this.drafts.set(`${this.sessionId}:${this.context.session.exercises[Number(form.dataset.ei)].exerciseId}:${form.dataset.si}:${e.target.name}`,e.target.value);});
  document.addEventListener('keydown',e=>{
   if(root.hidden||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable]'))return;
   if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();this.go(this.index+(e.key==='ArrowRight'?1:-1));}
  });
 }
 followSession(session){const position=sessionPosition(session),ei=Number(position.page.split('-')[1]),id=position.page.startsWith('lift-')?session.exercises[ei].exerciseId:null;this.positions.set(`today:${session.id}`,id?`lift-${id}`:position.page);if(id)this.setPositions.set(`${session.id}:${id}`,position.set);}
 makePage(key,title,node){const page=el('section','screen-page');page.dataset.pageKey=key;page.dataset.pageTitle=title;page.append(node);return page;}
 image(id){const asset=this.context.illustrations.assets[id];if(!asset)return el('div','screen-art-empty','동작 그림');const image=el('img');image.src=assetUrl(asset.url);image.alt=`${this.context.byId.get(id)?.nameKo||'운동'} 동작 자세`;image.loading='lazy';return image;}
 mount(view,context){
  this.context=context;this.sessionId=context.session?.id;this.key=view==='today'&&context.session?`today:${context.session.id}`:view==='routine'?`routine:${context.planDay??'next'}`:view;
  const heading=this.root.querySelector('.training-heading');if(!heading)return;this.root.dataset.screenView=view;
  if(view==='routine'){const day=this.root.querySelector('[data-train=plan-day][aria-pressed=true]')?.dataset.day;this.key=`routine:${day??'next'}`;}
  this.pages=[];this.dock=null;this.tail=null;this.form=null;this.toolbar=el('div','screen-toolbar');
  if(this.root.querySelector('#profile-form'))this.setup();
  else if(view==='routine'&&this.root.querySelector('.routine-exercise'))this.routine();
  else if(view==='today'&&context.session)this.today();
  else if(view==='max')this.max();
  else if(view==='history')this.history();
  else this.generic();
  if(!this.pages.length){const remaining=el('div','screen-message');for(const node of children(this.root))if(node!==heading)remaining.append(node);this.pages.push(this.makePage('empty','안내',remaining));}
  const deck=el('div','screen-deck'),stage=el('div','screen-stage');stage.append(...this.pages);this.stage=stage;
  const footer=el('div','screen-pager'),previous=button('← 이전','prev'),next=button('다음 →','next'),select=el('select','screen-page-select');select.dataset.screen='page-select';select.setAttribute('aria-label',this.form?.id==='profile-form'?'루틴 설정 단계':view==='settings'?'설정 항목':'카드 선택');
  for(const [i,page]of this.pages.entries()){const option=el('option','',`${i+1}. ${page.dataset.pageTitle}`);option.value=i;select.append(option);}
  const label=el('span','screen-page-count');label.setAttribute('role','status');label.setAttribute('aria-live','polite');footer.append(previous,select,label,next);this.controls={previous,next,select,label};
  if(this.tail)footer.append(this.tail);
  if(this.form){const retained=[...this.form.querySelectorAll(':scope > input[type=hidden]')];this.form.replaceChildren(...retained,stage,footer);this.form.classList.add('screen-form');deck.append(this.form);}else deck.append(stage,footer);
  const frame=el('div',`screen-frame ${this.dock?'with-dock':''}`);frame.append(deck);if(this.dock)frame.append(this.dock);
  this.root.replaceChildren(heading,this.toolbar,frame);this.dock=null;
  const position=view==='today'&&context.session?sessionPosition(context.session):null,fallback=position?(position.page.startsWith('lift-')?`lift-${context.session.exercises[Number(position.page.split('-')[1])].exerciseId}`:position.page):this.pages[0].dataset.pageKey;
  const current=this.positions.get(this.key)||fallback;this.go(Math.max(0,this.pages.findIndex(p=>p.dataset.pageKey===current)),false);
 }
 go(index,validate=true){
  if(!this.pages?.length)return;const target=clampPage(index,this.pages.length);
  if(validate&&target>this.index&&this.form){const invalid=this.pages[this.index]?.querySelector('input:not(:disabled):invalid,select:not(:disabled):invalid,textarea:not(:disabled):invalid');if(invalid&&!invalid.disabled){invalid.reportValidity();return;}}
  if(this.form?.id==='profile-form'){const data=new FormData(this.form),summary=this.root.querySelector('.screen-setup-summary');if(summary)summary.textContent=`주 ${data.getAll('days').length}회 · 사용할 도구 ${data.getAll('equipment').length}개 · 약 ${data.get('minutes')}분`;}
  this.index=target;this.pages.forEach((page,i)=>page.hidden=i!==target);this.positions.set(this.key,this.pages[target].dataset.pageKey);
  const {previous,next,select,label}=this.controls;previous.disabled=target===0;next.disabled=target===this.pages.length-1;select.value=String(target);label.textContent=`${target+1} / ${this.pages.length}`;
  if(this.form){next.hidden=target===this.pages.length-1;if(this.tail)this.tail.hidden=target!==this.pages.length-1;}
 }
 generic(){
  for(const [i,node]of children(this.root).filter(n=>!n.matches('.training-heading')).entries()){
   const title=node.querySelector('h2,h3')?.textContent||'안내';this.pages.push(this.makePage(`card-${i}`,title,node));
  }
 }
 setup(){
  const form=this.root.querySelector('#profile-form');this.form=form;this.key='onboarding';
  for(const field of form.querySelectorAll('.setup-grid>.setup-field')){const title=field.querySelector('label').textContent;this.pages.push(this.makePage(field.querySelector('select').name,title,field));}
  const sections=children(form).filter(n=>n.matches('fieldset'));
  const days=sections[0];if(days)this.pages.push(this.makePage('days','운동할 요일',days));
  const tools=sections[1];if(tools){const labels=children(tools.querySelector('.setup-tools'));for(let i=0;i<labels.length;i+=4){const block=el('fieldset','setup-section screen-tools');block.append(tools.querySelector('legend').cloneNode(true),tools.querySelector('.setup-question').cloneNode(true));const grid=el('div','training-tools setup-tools');grid.append(...labels.slice(i,i+4));block.append(grid);this.pages.push(this.makePage(`tools-${i}`,`사용 도구 ${Math.floor(i/4)+1}`,block));}}
  const advanced=form.querySelector('.setup-advanced');if(advanced){const grid=advanced.querySelector('.form-grid');if(grid){for(const [i,field] of children(grid).entries()){const page=el('div','screen-advanced');page.append(field);this.pages.push(this.makePage(`load-${i}`,field.querySelector('label').textContent,page));}}
   const alerts=el('div','screen-advanced');alerts.append(el('h2','','소리와 화면'));for(const n of children(advanced))if(n.tagName!=='SUMMARY'&&!n.matches('.form-grid,.setup-question'))alerts.append(n);this.pages.push(this.makePage('alerts','소리와 화면',alerts));}
  const review=el('div','screen-review');review.append(el('h2','','이 설정으로 시작해요'));const p=this.context.profileValue;
  if(p){const summary=el('p','screen-setup-summary',`주 ${p.days.length}회 · 사용할 도구 ${p.equipment.length}개 · 약 ${p.minutes}분`);review.append(summary);}
  for(const n of children(form))if(n.matches('.setup-glossary,.setup-footnote,.form-error')||n.tagName==='P'&&!n.matches('.setup-question'))review.append(n);
  const glossary=review.querySelector('.setup-glossary');if(glossary)glossary.open=false;
  this.pages.push(this.makePage('review','확인하고 저장',review));this.tail=form.querySelector('button[type="submit"]');
 }
 routine(){
  const articles=[...this.root.querySelectorAll('.routine-exercise')];
  const tools=this.root.querySelector('.routine-tools'),dayTabs=this.root.querySelector('.training-day-tabs');if(dayTabs)this.toolbar.append(dayTabs);
  const actions=tools?.querySelector('.card-title>div:last-child');if(actions)this.toolbar.append(actions);
  const overview=children(this.root).filter(n=>n.matches('.routine-summary,.warmup-preview,.review-note')||n.matches('.training-card')&&n!==tools&&!articles.includes(n));
  const info=button('구성과 안내','overview');info.onclick=()=>showScreenInfo('루틴 구성과 안내',[...overview,tools?.querySelector('.training-hint')].filter(Boolean));this.toolbar.append(info);
  const start=this.root.querySelector('[data-train="start"]');if(start){this.tail=start;start.textContent=this.context.session?'운동 이어하기':'운동 시작';}
  for(const [i,article]of articles.entries()){article.classList.add('screen-exercise');const art=article.querySelector('.training-thumb');if(art)art.classList.add('screen-art');this.pages.push(this.makePage(`lift-${article.querySelector('[data-train=detail]').dataset.id}`,article.querySelector('h3').textContent,article));}
 }
 today(){
  const s=this.context.session,tools=this.root.querySelector('.routine-tools'),actions=tools?.querySelector('.card-title>div:last-child');if(actions)this.toolbar.append(actions);
  const sound=this.root.querySelector('[data-train="sound-test"]');if(sound){sound.textContent='알림 소리';this.toolbar.append(sound);}
  for(const [i,warmup]of [...this.root.querySelectorAll('.warmup-item')].entries()){
   const card=el('article','training-card screen-warmup'),hero=el('div','warmup-hero',i===0?'5':'3');hero.append(el('small','','MIN'));card.append(el('span','screen-kicker',`${i+1} / 2 · 몸 풀기`),hero,warmup);this.pages.push(this.makePage(`warm-${i}`,s.warmup[i].name,card));
  }
  for(const [ei,article]of [...this.root.querySelectorAll('.session-exercise')].entries()){
   const e=s.exercises[ei];article.classList.add('screen-exercise','screen-session');const heading=article.querySelector('.session-exercise-heading'),art=heading.querySelector('.training-thumb');if(art){art.classList.add('screen-art');article.prepend(art);}
   const order=heading.querySelector('.exercise-order');if(order){const more=button('순서','lift-order');more.classList.add('screen-lift-order');more.onclick=()=>showScreenInfo('운동 순서',[order]);heading.querySelector(':scope>div').append(more);}
   const note=heading.querySelector('.training-hint');if(note){const help=button('운동 안내','lift-note');help.classList.add('screen-lift-note');help.onclick=()=>showScreenInfo(e.name+' 안내',[note]);heading.querySelector(':scope>div').append(help);}
   const controls=el('div','screen-lift-content');controls.append(heading);article.querySelector('.set-head')?.remove();const forms=[...article.querySelectorAll('.set-form')],sets=el('div','screen-sets');
   for(const [si,form]of forms.entries()){
    form.querySelector(':scope>span')?.classList.add('screen-set-number');
    for(const input of [...form.querySelectorAll('input')]){const draft=this.drafts.get(`${s.id}:${e.exerciseId}:${si}:${input.name}`);if(draft!==undefined&&!e.sets[si].done)input.value=draft;const label=el('label','screen-set-field');const title=input.name==='weight'?(e.basis==='seconds'?'유지 시간 · 초':e.basis==='bodyweight'?'맨몸':'중량 · kg'):input.name==='reps'?'반복 수':'남은 반복 · RIR';label.append(el('span','',title));input.before(label);label.append(input);if(e.basis==='seconds'&&input.name==='reps')label.hidden=true;if(e.basis==='bodyweight'&&input.name==='weight'){input.value=0;input.readOnly=true;}}
    const error=el('div','form-error');error.setAttribute('role','alert');form.append(error);sets.append(form);
   }
   const chooser=el('div','screen-set-picker'),previous=button('← 세트','set-prev'),next=button('세트 →','set-next'),select=el('select');previous.dataset.ei=next.dataset.ei=select.dataset.ei=String(ei);select.dataset.screen='set-select';select.setAttribute('aria-label',`${e.name} 세트 선택`);
   for(const [si,set]of e.sets.entries()){const label=set.kind==='warmup'?`준비 ${e.sets.slice(0,si+1).filter(x=>x.kind==='warmup').length}`:`본 세트 ${e.sets.slice(0,si+1).filter(x=>x.kind==='work').length}`;const option=el('option','',label+(set.done?' · 완료':''));option.value=si;select.append(option);}
   chooser.append(previous,select,next);controls.append(chooser,sets);const estimate=article.querySelector('[data-train="estimate-set"]');if(estimate)controls.append(estimate);article.append(controls);
   article._sets={forms,previous,next,select};article.dataset.ei=ei;article.dataset.exerciseId=e.exerciseId;this.setPositions.set(`${s.id}:${e.exerciseId}`,clampPage(this.setPositions.get(`${s.id}:${e.exerciseId}`)??resumeSet(e),e.sets.length));this.paintSet(article,ei);
   this.pages.push(this.makePage(`lift-${e.exerciseId}`,e.name,article));
  }
  const finish=this.root.querySelector('#finish-form');if(finish){finish.prepend(el('h2','','오늘 운동 마무리'),el('p','',`${s.exercises.reduce((n,e)=>n+e.sets.filter(t=>t.done&&t.kind==='work').length,0)}개 본 세트를 기록했어요.`));this.pages.push(this.makePage('finish','마무리와 저장',finish));}
  const timer=this.root.querySelector('.timer-card');if(timer){timer.classList.add('screen-timer');const counter=el('div','timer-counter');counter.append(el('small','',s.timer?.warmupId?'워밍업':s.timer?.paused?'휴식 · 일시정지':'휴식 타이머'),timer.querySelector('#timer-display'));timer.prepend(counter);const more=button('휴식 설정','timer-settings'),settings=el('dialog','screen-dialog timer-settings');settings.setAttribute('aria-label','휴식 타이머 설정');const top=el('div','screen-dialog-top'),close=button('닫기','timer-settings-close');top.append(el('h2','','휴식 타이머 설정'),close);close.onclick=()=>settings.close();const body=el('div','screen-dialog-content');
   for(const node of children(timer))if(node.matches('.card-title,.manual-rest,p'))body.append(node);settings.append(top,body);timer.append(more,settings);more.onclick=()=>settings.showModal();this.dock=timer;
  }
 }
 paintSet(article,ei){const item=article._sets;if(!item)return;const index=this.setPositions.get(`${this.sessionId}:${article.dataset.exerciseId}`)||0;item.forms.forEach((form,i)=>form.hidden=i!==index);item.select.value=index;item.previous.disabled=index===0;item.next.disabled=index===item.forms.length-1;}
 setGo(ei,delta,selected){const article=this.root.querySelector(`.screen-session[data-ei="${ei}"]`);if(!article)return;const index=clampPage(selected??(this.setPositions.get(`${this.sessionId}:${article.dataset.exerciseId}`)||0)+delta,article._sets.forms.length);this.setPositions.set(`${this.sessionId}:${article.dataset.exerciseId}`,index);this.paintSet(article,ei);}
 max(){
  const search=this.root.querySelector('.training-search');if(search)this.toolbar.append(search);
  const form=this.root.querySelector('#max-form');
  if(form){this.form=form;this.key=`max:${form.querySelector('[name=exerciseId]').value}`;const top=form.querySelector('.card-title');this.toolbar.append(top);const picker=form.querySelector('#max-equipment-picker');if(picker)this.toolbar.append(picker);const hidden=form.querySelector('[name=exerciseId]');const fields=children(form.querySelector('.form-grid'));
   for(let i=0;i<fields.length;i+=4){const grid=el('div','form-grid screen-max-fields');grid.append(...fields.slice(i,i+4));if(i===0)grid.prepend(hidden);this.pages.push(this.makePage(`fields-${i}`,i===0?'중량과 반복':'장비와 측정일',grid));}
   const note=form.querySelector('.training-hint'),error=form.querySelector('.form-error');if(note)this.pages.at(-1).append(note);if(error)this.pages.at(-1).append(error);this.tail=form.querySelector('[type=submit]');
  }else{
   const intro=this.root.querySelector('.training-card'),help=button('중량 기록 안내','max-help');if(intro){help.onclick=()=>showScreenInfo('최대 중량과 가벼운 테스트',children(intro));this.toolbar.append(help);}
   for(const [i,row]of [...this.root.querySelectorAll('.max-row')].entries()){const id=row.querySelector('[data-id]').dataset.id,card=el('article','training-card screen-max-card'),art=el('div','screen-art');art.append(this.image(id));card.append(art,row);this.pages.push(this.makePage(`max-${id}`,row.querySelector('strong')?.textContent||'운동 중량',card));}
   if(!this.pages.length){const empty=el('div','training-card screen-message');empty.append(el('h2','','운동 중량을 입력해 보세요.'),el('p','','위에서 운동을 검색하거나 먼저 내 루틴을 만들어요.'));this.pages.push(this.makePage('empty','중량 찾기',empty));}
  }
 }
 history(){
  const stats=this.root.querySelector('.training-stats');if(stats){stats.classList.add('screen-history-stats');this.toolbar.append(stats);}
  for(const [si,record]of [...this.root.querySelectorAll('.history-item')].entries()){
   const summary=record.querySelector('summary'),note=children(record).filter(n=>n.tagName==='P'&&!n.matches('.training-hint'));
   for(const [ei,exercise]of [...record.querySelectorAll('.history-exercise')].entries()){
    const values=exercise.querySelector('span').textContent.split(' / '),id=exercise.dataset.exerciseId;
    for(let offset=0;offset<values.length;offset+=6){const card=el('article','training-card screen-history-card'),art=el('div','screen-art');art.append(this.image(id));const text=el('div','screen-history-copy');text.append(summary.cloneNode(true),el('h2','',exercise.querySelector('strong').textContent));if(exercise.dataset.basisLabel)text.append(el('p','training-hint',exercise.dataset.basisLabel));
     const list=el('div','history-set-list');for(const [n,value]of values.slice(offset,offset+6).entries())list.append(el('p','',`${offset+n+1}. ${value}`));text.append(list);
     if(note.length){const more=button('운동 메모','history-note');more.onclick=()=>showScreenInfo('이날의 운동 메모',note);text.append(more);}card.append(art,text);this.pages.push(this.makePage(`history-${si}-${ei}-${offset}`,`${summary.querySelector('small')?.textContent.split(' · ')[0]} · ${exercise.querySelector('strong').textContent}`,card));
    }
   }
  }
  if(!this.pages.length)this.generic();
 }
}

let filterPosition='filter-0';
export function mountFilterCards(root){
 const title=root.querySelector('.sidebar-title'),sections=children(root).filter(n=>n.matches('.filter-section')),pages=[];
 for(const [i,section]of sections.entries()){
  const list=section.querySelector('.tool-list');if(list&&list.children.length>12){const labels=children(list);for(let offset=0;offset<labels.length;offset+=12){const copy=section.cloneNode(true);copy.querySelector('.tool-list').replaceChildren(...labels.slice(offset,offset+12));pages.push({id:`filter-${i}-${offset}`,title:`전체 도구 ${Math.floor(offset/12)+1}`,node:copy});}}
  else pages.push({id:`filter-${i}`,title:section.querySelector('.filter-heading')?.textContent.trim()||'이미지',node:section});
 }
 const stage=el('div','filter-stage'),footer=el('div','screen-pager'),previous=button('이전','filter-prev'),next=button('다음','filter-next'),select=el('select','screen-page-select');select.setAttribute('aria-label','필터 항목');
 pages.forEach((p,i)=>{p.node.dataset.filterPage=p.id;stage.append(p.node);const option=el('option','',p.title);option.value=i;select.append(option);});footer.append(previous,select,next);let match=pages.findIndex(p=>p.id===filterPosition);if(match<0)match=pages.findIndex(p=>p.id.startsWith(filterPosition+'-')||filterPosition.startsWith(p.id+'-'));let index=Math.max(0,match);
 const go=n=>{index=clampPage(n,pages.length);filterPosition=pages[index].id;pages.forEach((p,i)=>p.node.hidden=i!==index);previous.disabled=index===0;next.disabled=index===pages.length-1;select.value=index;};previous.onclick=()=>go(index-1);next.onclick=()=>go(index+1);select.onchange=()=>go(Number(select.value));
 const apply=el('button','screen-button primary','운동 보기');apply.type='button';apply.dataset.action='mobile-close';footer.append(apply);root.replaceChildren(title,stage,footer);go(index);
}

// Instruction and attribution panels use the same explicit card navigation.
export function mountReadingCards(dialog,selector){
 const content=dialog.querySelector(selector),top=dialog.querySelector('.detail-top');if(!content||!top)return;
 const pages=[];const add=node=>{if(node)pages.push(node);};
 const paragraph=node=>{if(node.textContent.length>500&&!node.querySelector('a'))for(const part of textPages(node.textContent,450)){const copy=el(node.tagName.toLowerCase(),node.className,part);add(copy);}else add(node);};
 let intro=el('div','reading-intro');
 for(const node of children(content)){
  if(node.matches('.detail-eyebrow,h2,.detail-english,.detail-favorite,.eyebrow')){intro.append(node);continue;}
  if(intro.children.length){add(intro);intro=el('div','reading-intro');}
  if(node.matches('.method-section')){
   const image=el('section','method-section reading-image');image.append(node.querySelector('.method-heading'),node.querySelector('.method-image-button'));add(image);
   for(const caption of children(node.querySelector('.method-captions'))){const card=el('section','method-captions reading-caption');card.append(caption);add(card);}for(const example of node.querySelectorAll('.illustration-example'))paragraph(example);
  }else if(node.matches('.detail-section,.about-content>section')){
   const heading=node.querySelector('h3,summary');
   const sources=node.querySelector('.source-records'),aliases=node.querySelector('.alias-list');
   if(sources){for(const source of children(sources)){const card=el('section','detail-section');card.append(heading.cloneNode(true),source);add(card);}}
   else if(aliases){const values=children(aliases);for(let i=0;i<values.length;i+=12){const card=el('section','detail-section'),list=el('div','alias-list');list.append(...values.slice(i,i+12));card.append(heading.cloneNode(true),list);add(card);}}
   else for(const child of children(node).filter(n=>n!==heading)){if(child.tagName==='P')paragraph(child);else add(child);}
  }else if(node.matches('.about-source-list')){for(const source of children(node)){const card=el('div','about-source-list');card.append(source);add(card);}}
  else if(node.tagName==='P')paragraph(node);else add(node);
 }
 if(intro.children.length)add(intro);if(!pages.length)return;
 let index=0;const stage=el('div','reading-stage'),footer=el('div','screen-pager'),previous=button('← 이전','reading-prev'),next=button('다음 →','reading-next'),select=el('select','screen-page-select');select.setAttribute('aria-label','설명 카드');
 for(const [i,page]of pages.entries()){page.classList.add('reading-page');stage.append(page);const title=page.querySelector('h2,h3,strong,dt')?.textContent||page.textContent;const option=el('option','',`${i+1}. ${title.trim().slice(0,35)}`);option.value=i;select.append(option);}
 const label=el('span','screen-page-count');footer.append(previous,select,label,next);const go=n=>{index=clampPage(n,pages.length);pages.forEach((p,i)=>p.hidden=i!==index);previous.disabled=index===0;next.disabled=index===pages.length-1;select.value=index;label.textContent=`${index+1} / ${pages.length}`;};previous.onclick=()=>go(index-1);next.onclick=()=>go(index+1);select.onchange=()=>go(Number(select.value));dialog.classList.add('reading-dialog');dialog.replaceChildren(top,stage,footer);go(0);
}
