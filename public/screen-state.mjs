// SPDX-License-Identifier: AGPL-3.0-only
export function clampPage(index,count){return Math.max(0,Math.min(Number.isFinite(index)?Math.trunc(index):0,Math.max(0,count-1)));}
export function pageSlice(items,index,size){
 if(!Number.isInteger(size)||size<1)throw Error('Invalid page size');
 const count=Math.max(1,Math.ceil(items.length/size)),page=clampPage(index,count);
 return {page,count,start:page*size,items:items.slice(page*size,(page+1)*size)};
}
export function catalogCapacity(width,height){
 const columns=width>=1500?4:width>=1000?3:width>=700?2:1;
 const rows=columns===1?1:height>=670?2:1;
 return {columns,rows,size:columns*rows};
}
export function inputViewportLayout({width,layoutHeight,visualHeight=layoutHeight,baselineHeight=layoutHeight,offsetTop=0,scale=1,editing=false,wasCompact=false}){
 // The keyboard can shrink the visual viewport while CSS height queries still
 // see the original layout viewport. Pinch zoom should retain normal panning.
 const zoomed=scale>1.05,height=Math.max(1,zoomed?layoutHeight:visualHeight);
 const reduced=Math.max(layoutHeight,baselineHeight)-height>120;
 const compact=!zoomed&&width<1050&&((editing&&(reduced||height<520))||wasCompact&&reduced);
 return {height,compact,top:compact?Math.max(0,offsetTop):0};
}
export function sessionPosition(session){
 const warmup=session.warmup.findIndex(w=>!w.done);if(warmup>=0)return {page:`warm-${warmup}`,set:0};
 const exercise=session.exercises.findIndex(e=>e.sets.some(s=>!s.done));
 if(exercise<0)return {page:'finish',set:0};
 return {page:`lift-${exercise}`,set:session.exercises[exercise].sets.findIndex(s=>!s.done)};
}
export function resumeSet(exercise){const next=exercise.sets.findIndex(s=>!s.done);return next<0?Math.max(0,exercise.sets.length-1):next;}
// Keep every character (including spaces) when long notes need more than one card.
export function textPages(text,size=500){
 if(!Number.isInteger(size)||size<1)throw Error('Invalid text page size');
 const value=String(text??''),pages=[];let start=0;
 while(start<value.length){let end=Math.min(start+size,value.length);if(end<value.length){const space=value.lastIndexOf(' ',end);if(space>start+size*.6)end=space+1;}pages.push(value.slice(start,end));start=end;}
 return pages.length?pages:[''];
}
