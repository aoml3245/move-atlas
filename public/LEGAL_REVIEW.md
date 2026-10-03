# 공개 배포 라이선스 점검 — 2026-10-03

현재 공개 배포물에서 확인할 수 있는 라이선스·고지 요건을 점검하고 아래와
같이 반영했습니다. 법률 자문이나 권리 분쟁이 전혀 없다는 보증은 아닙니다.

| 확인 사항 | 반영한 조치 | 근거 |
| --- | --- | --- |
| 앱 코드에 Liftosaur의 AGPL 자료 사용 | 앱 코드 AGPL-3.0-only, 전체 소스·추출 스크립트·원본 텍스트 스냅샷 공개, 사이트에 소스 코드 링크 | [Liftosaur 원문 라이선스](https://github.com/astashov/liftosaur/blob/master/LICENSE), 특히 5·13조 |
| MIT 저작권·허가 고지 유지 | Hasan Emir Yıldırım의 MIT 전문과 미디어 예외를 저장소와 사이트에 포함 | [Exercises Dataset LICENSE](https://github.com/hasaneyldrm/exercises-dataset/blob/main/LICENSE) |
| Gym visual 사진·GIF는 MIT에서 제외 | 원본 미디어를 배포하거나 앱에서 불러오지 않음; 자체 생성 그림 사용 | [Exercises Dataset README](https://github.com/hasaneyldrm/exercises-dataset#-license--use) |
| wger 데이터는 코드와 다른 라이선스 | 운동 기본 정보와 번역별 CC BY-SA 3.0·4.0 또는 CC0를 구분, 작성자 이력·제공된 원출처·라이선스 URL 보존 | [wger License](https://github.com/wger-project/wger#license), 수집한 API 항목 |
| 영문 설명 5개의 라이선스가 기본 정보와 다름 | 실제 사용하는 영문 번역의 라이선스로 수정 | `data/sources/wger-all.json`, `tests/publication.test.mjs` |
| CC BY-SA 출처 표시·변경 표시·동일조건 의무 | 통합 JSON과 사이트에 저자·라이선스·원본 URL, HTML/공백 정리 및 한국어 보완 표시; CC 자료의 원본 조건 유지 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Free Exercise DB의 배포 조건 | Unlicense 전문과 저장소 링크 포함 | [Free Exercise DB LICENSE.md](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md) |
| 자체 생성 그림·새 설명의 이용 조건 | CC BY-SA 4.0, 생성 사실·검수 범위·별도 해시 고지, 보유한 권리 범위 내 허가 | `NOTICE.md`, `public/illustrations/manifest.json` |
| 서로 다른 라이선스 통합 | 단일 라이선스 데이터셋으로 주장하지 않음; 제3자 원문을 출처별로 식별해 각 조건 유지 | `NOTICE.md`, 통합 목록 `sources`·`originalInstructions`·`credits` |
| 참고한 추가 웹사이트 | 사용한 링크를 그림별·전체 고지에 유지; 해당 사이트의 미디어나 로고는 복제하지 않음 | `public/credits.html`, `public/illustrations/manifest.json` |
| 공개할 필요 없는 작업 자료 | 개인 경로·생성 후보·프롬프트·비밀 설정·원본 대용량 이미지 제외 | `.gitignore`, 공개 파일 점검 |

2026-10-03에 공식 GitHub 라이선스 파일을 다시 가져와 기존 사본과 동일함을
확인했습니다. 검사 대상 원문의 Git blob ID와 SHA-256은
`data/upstream-license-check.json`에 보존합니다. wger의 항목별 권리는 수집한
스냅샷 기준이며 실시간 사이트와 이후에는 달라질 수 있습니다. 작성자를 제공하지 않은
API 항목·번역은 `not-supplied-by-upstream`으로 표시하며 이름을 추측하지 않습니다.

남는 한계는 제3자 업로더가 모든 기초 콘텐츠의 권리를 보유했는지 독립적으로
보증할 수 없다는 점, AI 생성물의 저작권 인정 범위와 기존 표현과의 우연한
유사성을 보증할 수 없다는 점입니다. 유료 판매·상표 사용·별도 원본 미디어
추가 시에는 그 변경 범위의 권리와 조건을 다시 확인해야 합니다. 현재 앱은
공개 운동 도감이며 로그인·결제·서버의 개인 운동 기록 수집 기능은 없습니다.
그림 검수는 에이전트 확인이며 전문 운동 지도자의 승인으로 표시하지 않습니다.
