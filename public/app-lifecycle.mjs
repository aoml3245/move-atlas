// SPDX-License-Identifier: AGPL-3.0-only
// The production build embeds the release that this running code belongs to.
export const CURRENT_RELEASE = typeof __MOVE_ATLAS_RELEASE__ === 'undefined'
 ? {schema:1,version:'0.3.0',build:'development',releasedAt:null,revision:null,assets:{}}
 : __MOVE_ATLAS_RELEASE__;

export function validateRelease(value){
 if(!value||value.schema!==1||typeof value.version!=='string'||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(value.version)||! /^[a-f0-9]{16}$/.test(value.build)||!Number.isFinite(Date.parse(value.releasedAt))||! /^[a-f0-9]{40}$/.test(value.revision))throw Error('최신 버전 정보를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.');
 for(const key of ['app','styles','training','cloud'])if(typeof value.assets?.[key]!=='string'||!/^assets\/[a-z-]+-[a-f0-9]{16}\.(?:js|css)$/.test(value.assets[key]))throw Error('업데이트 파일 정보를 확인하지 못했어요.');
 return value;
}
export async function checkForUpdate(current=CURRENT_RELEASE,{base=globalThis.document?.baseURI,fetcher=globalThis.fetch,now=Date.now()}={}){
 const url=new URL('version.json',base);url.searchParams.set('check',String(now));
 const response=await fetcher(url.href,{cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('최신 버전을 확인하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
 const latest=validateRelease(await response.json());
 return {latest,available:latest.build!==current.build};
}
export function updateUrl(latest,href,now=Date.now()){
 validateRelease(latest);const url=new URL(href);
 url.searchParams.set('move-atlas-update',latest.build);url.searchParams.set('reload',String(now));url.hash='settings';return url.href;
}
