# Move Atlas · 운동 도감

공개 운동 도감과 개인별 루틴·운동 기록을 관리하는 웹앱입니다.
**2,844개 운동 모두에 직접 제작한 동작 일러스트를 연결했습니다.**

- [웹에서 사용하기](https://aoml3245.github.io/move-atlas/)
- [출처·작성자·라이선스](https://aoml3245.github.io/move-atlas/credits.html)
- [라이선스 점검 내역](LEGAL_REVIEW.md) · [저작권 및 이용 조건 전문](NOTICE.md)

## 실행

Node.js 22 이상과 Python 3을 사용합니다. Firebase Web SDK와 빌드 도구는 잠금 파일에 고정합니다.

```sh
git clone https://github.com/aoml3245/move-atlas.git
cd move-atlas
npm ci
npm run dev
```

브라우저에서 http://127.0.0.1:5174/ 를 엽니다. 포트 충돌 시 다른 앱을
중단하지 않습니다. `MOVE_ATLAS_PORT=5175 npm run dev`로 포트를 바꿀 수 있습니다.

```sh
npm test
npm run build
npm run preview
```

`dist/`가 정적 배포물입니다. GitHub Actions가 테스트·출처 고지·전체 이미지
검증·빌드를 수행한 후 GitHub Pages에 게시합니다. 프로젝트 하위 경로와
로컬 루트 경로를 모두 지원합니다. 클라우드 연결 전에는 개인 기록을 브라우저에 저장합니다.

## 기능

- 처음 사용할 때 분할·요일·경험·목표·사용 도구 선택
- 1RM 비율, RIR, 이중 점진, 5×5·5/3/1 참고 템플릿 선택
- 운동별 실측·추정 1RM, 가벼운 테스트에서 추정값 저장
- 걷기 5분과 동적 스트레칭 3분을 매번 포함
- 세트별 실제 중량·반복·RIR, 날짜별 완료·중단 기록
- 세트 완료 후 휴식 타이머·소리, 화면 켜두기, 새로고침 복원
- 장비에 맞는 대표 운동 교체, 중량 내림·최소 바 중량 적용
- 루틴에 운동 계속 추가 / 오늘만 추가, 이름·범위·주요 부위로 찾기
- 첫 루틴 설정에서 선택 항목별 적용 설명·선택지 비교·도구별 안내·세트와 중량 용어 설명
- 주요·복합 운동 우선 순서, 직접 순서 변경과 권장 순서 복구
- 빠진 장비 동작을 건너뛰어 가능한 다음 운동으로 추천 수 채우기
- JSON 기록 백업·기존 기록과 병합
- 상체·하체·코어·전신 범위, 주요 근육, 운동 유형 필터
- 여러 부위 선택은 OR, 서로 다른 필터 종류는 AND
- 내 도구는 필요한 도구를 모두 보유할 때 일치하며 맨몸 운동은 항상 포함
- 벤치·철봉·평행봉 등 실제 준비 도구를 함께 표시
- 한국어 표기·영어 원명·다국어 별칭 검색, 즐겨찾기
- 운동별 2컷 그림·한국어 동작 설명·자세별 확대
- 원본 설명·라이선스·작성자·출처와 통합 목록 JSON
- 모바일 필터 패널

루틴 근거, 원저자 링크 및 앱에서 조정한 부분은 [루틴 안내](https://aoml3245.github.io/move-atlas/training-guide.html)에 공개합니다. 참고 템플릿은 공식 프로그램의 완전한 복제나 공식 제휴 서비스가 아닙니다.

## 로그인·동기화 연결 상태

`public/cloud-config.json`은 현재 `enabled: false`입니다. 별도 Firebase 프로젝트 생성 승인을 기다리며, 실제 Google 로그인과 기기 간 동기화는 활성화되지 않았습니다. UI에도 기기 저장 모드를 표시합니다. 기존 영어 공부 프로젝트의 데이터·보안 규칙은 변경하지 않습니다.

연결을 승인한 뒤 전용 프로젝트에 Google 로그인, Firestore 및 `firestore.rules`를 설정하고 다음 형태의 공개 Web 설정을 넣습니다. SDK Web API 키는 공개 클라이언트 설정이며 서비스 계정 키·개인 토큰을 넣으면 안 됩니다.

```json
{"enabled": true, "firebase": {"apiKey":"PUBLIC_WEB_KEY", "authDomain":"PROJECT.firebaseapp.com", "projectId":"PROJECT", "appId":"WEB_APP_ID"}}
```

기록 경로는 `users/{uid}/items/{entityId}`입니다. 계정별 프로필·최대 중량·운동 세션·도감 설정을 보관하며 다른 계정의 읽기·쓰기를 차단합니다. 기기에 먼저 저장하고 연결 복구 시 문서별로 합칩니다. 동시에 같은 세션을 수정하면 각 세트의 최신 수정 시각으로 병합합니다. 같은 필드를 두 기기에서 동시에 수정하면 최신 기록을 사용합니다. 로그인 전 기록은 사용자가 설정에서 명시적으로 합칩니다.

타이머는 브라우저의 화면 잠금·백그라운드 제한 때문에 잠금 상태에서 정확한 알림을 보장하지 않습니다. 사용 동작으로 소리를 활성화하고, 지원하는 기기에서 화면 켜두기를 요청합니다. 준비 세트는 통계에서 제외하고 덤벨은 한 손당 기록합니다. 한팔 동작의 세트 완료는 양쪽 수행을 마친 기준입니다.

보안 규칙 검증에는 Java 21 이상과 Firebase CLI가 필요합니다. 실제 클라우드를 사용하지 않는 `demo-move-atlas` 로컬 에뮬레이터로 검사하며 GitHub Actions에서 배포 전에 실행합니다.

```sh
npx --yes firebase-tools@15.28.2 emulators:exec --only firestore --project demo-move-atlas "npm run test:rules"
```

## 데이터와 출처

2026-10-02에 수집한 원본 3,506개를 2,844개로 정리했습니다. 장비·그립·각도·
한팔·한발·보조·중량·번호 변형은 보존하며 유사도만으로 병합하지 않습니다.
모든 원본 ID는 `public/catalog.json`의 `sources`에 유지합니다.

| 출처 | 입력 수 | 라이선스 |
| --- | ---: | --- |
| [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) | 876 | Unlicense |
| [Exercises Dataset](https://github.com/hasaneyldrm/exercises-dataset) | 1,324 | 설명·구조 MIT; Gym visual 사진·GIF 제외 |
| [wger](https://wger.de) / [GitHub](https://github.com/wger-project/wger) | 914 | 항목·번역별 CC BY-SA 3.0, 4.0 또는 CC0 |
| [Liftosaur](https://github.com/astashov/liftosaur) | 392 장비 변형 | AGPL-3.0 |

웹앱 코드는 **AGPL-3.0-only**입니다. 제3자 데이터는 원래 조건을 유지하는
별도 출처의 모음이며, 전체 JSON에 하나의 라이선스를 덮어쓰지 않습니다.
자체 생성 그림과 새 한국어 동작 안내는 보유한 권리 범위 내 **CC BY-SA 4.0**입니다.
재사용 시 [NOTICE.md](NOTICE.md)의 코드·자료·그림별 조건을 따르세요.
원본 사진·GIF·영상·근육도 파일은 배포하거나 앱에서 불러오지 않습니다.
공식 라이선스 재확인일은 2026-10-03이며 원문·저작권 고지는 `public/licenses/`에 있습니다.

원본 권리 보유 여부와 AI 생성물의 독점 저작권을 보증할 수 없습니다.
일부 wger 작성자 이름이 API에서 제공되지 않았다는 사실도 표시합니다.
모호한 메타데이터 28개는 `needsReview`로 남습니다. 그림 확인은 에이전트
검수이며 전문 운동 지도자의 검수나 개인별 운동 처방을 뜻하지 않습니다.

## 재생성과 검증

텍스트 스냅샷은 `data/sources/`, 장비 보완 근거는
`data/catalog-corrections.json`에 보관했습니다. 원격 코드를 실행하지 않습니다.
원본 및 정리한 스냅샷 해시는 `data/source-snapshots.json`, 라이선스 대조
기록은 `data/upstream-license-check.json`에 있습니다.

```sh
npm run data
npm run illustrations:sync
npm test
npm run build
```

공개 그림과 운동별 설명은 `public/illustrations/manifest.json`, 확인 기록과
웹 변환 해시는 `data/illustration-reviews.json`, 재동기화 입력은
`data/illustration-assets.json`입니다. 생성된 고지는 `npm run licenses`로 갱신합니다.
같은 그림의 중복 사용, 그림 변경, 누락, 이전 목록과의 불일치를 빌드 시 막습니다.

PNG 원본 약 4.38GB는 로컬에 보존하고, 웹에서는 해상도·구도를 유지한
WebP 파일 약 293MB를 사용합니다. 생성 프롬프트·반려 후보·개인 작업 기록은
공개하지 않습니다. `scripts/encode-web-images.py`와 제작 보조 스크립트는
로컬 원본·비공개 제작 작업공간이 있을 때 사용하며 공개 앱 빌드에는 필요 없습니다.
WebP 재인코딩 작업에만 Pillow가 필요합니다. 그림은 이미지 생성 도구로
제작하고 작은 모델의 확인과 주 에이전트의 개별 확인을 거쳤으며, 필요한
동작은 더 큰 모델에 재검수·수정을 맡겼습니다.
