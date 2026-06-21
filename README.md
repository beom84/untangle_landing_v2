# Untangle Landing v2

Untangle의 ADHD 사용자 대상 사전 등록 랜딩 페이지입니다. 연락처를 수집한 뒤 짧은 설문을 이어서 받고, 등록 정보와 설문 진행 상태를 Google Sheets에 저장합니다.

## 기술 스택

- Next.js 16.2.7
- React 19.2.4
- TypeScript
- CSS Modules
- Amplitude Analytics
- Microsoft Clarity
- Google Apps Script + Google Sheets

## 로컬 실행

```bash
npm install
npm run dev
```

개발 서버가 실행되면 브라우저에서 `http://localhost:3000`을 엽니다.

## 빌드와 검사

```bash
npm run build
npm run lint
npm run start
```

- `npm run build`: 프로덕션 빌드를 생성합니다.
- `npm run lint`: ESLint 검사를 실행합니다.
- `npm run start`: 빌드된 앱을 실행합니다.

## 환경 변수

루트에 `.env.local` 파일을 만들고 필요한 값을 설정합니다.

```env
APPS_SCRIPT_URL=
NEXT_PUBLIC_AMPLITUDE_API_KEY=
NEXT_PUBLIC_LANDING_VARIANT=v3
```

- `APPS_SCRIPT_URL`: 등록 및 설문 데이터를 저장할 Google Apps Script 웹 앱 URL입니다.
- `NEXT_PUBLIC_AMPLITUDE_API_KEY`: Amplitude 브라우저 SDK API 키입니다. 값이 없으면 Amplitude 초기화가 생략됩니다.
- `NEXT_PUBLIC_LANDING_VARIANT`: 랜딩 페이지 버전 라벨입니다. 설정하지 않으면 `v3`가 사용됩니다.

Microsoft Clarity 프로젝트 ID는 `src/lib/clarity.ts`에 고정되어 있습니다. 로컬 호스트(`localhost`, `127.0.0.1`, `::1`)에서는 트래킹이 비활성화됩니다.

## 주요 기능

- 휴대폰 번호 또는 이메일 기반 사전 등록
- 연락처 정규화 및 기본 유효성 검사
- 5단계 설문 플로우
- 설문 진행 상태 자동 저장
- 같은 기기에서 이어서 작성할 수 있는 로컬 저장
- Google Sheets에 등록 및 설문 데이터 upsert
- Amplitude 이벤트에 랜딩 버전, UTM, referrer 정보 자동 포함

## 프로젝트 구조

```text
.
├─ docs/
│  └─ v3/
│     ├─ design.pen
│     └─ PROPOSAL.md
├─ public/
│  └─ source-assets/
├─ scripts/
│  └─ google-apps-script/
│     └─ Code.gs
├─ src/
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ register/route.ts
│  │  │  └─ survey/route.ts
│  │  ├─ privacy/
│  │  │  ├─ page.tsx
│  │  │  └─ privacy.module.css
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  ├─ page.module.css
│  │  └─ page.tsx
│  └─ lib/
│     ├─ amplitude.ts
│     ├─ clarity.ts
│     ├─ contact.ts
│     ├─ experiment.ts
│     └─ tracking.ts
├─ eslint.config.mjs
├─ next.config.ts
├─ package.json
├─ PRD.md
└─ tsconfig.json
```

### 디렉터리 설명

- `src/app`: Next.js App Router 기반 화면과 API 라우트를 담습니다.
- `src/app/page.tsx`: 메인 랜딩 페이지, 등록 폼, 설문 플로우, 자동 저장 로직을 포함합니다.
- `src/app/api/register/route.ts`: 등록 요청을 받아 Google Apps Script로 전달합니다.
- `src/app/api/survey/route.ts`: 설문 진행 상태와 완료 데이터를 Google Apps Script로 전달합니다.
- `src/app/privacy`: 개인정보 처리방침 페이지입니다.
- `src/lib`: 분석, 트래킹, 연락처 정규화, 랜딩 버전 설정 같은 공통 유틸리티입니다.
- `public/source-assets`: 랜딩 페이지에 사용하는 이미지와 앱스토어 배지 등의 정적 자산입니다.
- `scripts/google-apps-script/Code.gs`: Google Sheets와 연동되는 Apps Script 코드입니다.
- `docs/v3`: v3 랜딩 기획 및 디자인 원본 자료입니다.
- `.next`, `node_modules`: 빌드 결과와 설치된 의존성 폴더이므로 직접 수정 대상이 아닙니다.

## Google Sheets 연동

앱은 서버 라우트 두 개를 통해 Google Apps Script 웹 앱에 데이터를 전송합니다.

- `src/app/api/register/route.ts`
- `src/app/api/survey/route.ts`

두 라우트 모두 `APPS_SCRIPT_URL`로 POST 요청을 보냅니다.

### 1. 시트 만들기

Google Sheet를 만들고 첫 번째 탭 이름을 `registrations`로 설정합니다. Apps Script는 필요한 헤더를 자동으로 만들거나 마이그레이션합니다.

사용되는 헤더는 다음과 같습니다.

```text
createdAt
submissionKey
contactMode
contactValue
surveyStep
painMoment
currentMethods
currentMethodsOther
branchTarget
branchChoice
biggestGap
surveyCompleted
surveyCompletedAt
updatedAt
variant
thoughtCategory
thoughtCategoryOther
```

### 2. Apps Script 배포

1. Google Sheet를 엽니다.
2. `확장 프로그램` > `Apps Script`로 이동합니다.
3. `scripts/google-apps-script/Code.gs` 내용을 붙여 넣습니다.
4. `배포` > `새 배포`를 선택합니다.
5. 유형을 `웹 앱`으로 선택합니다.
6. `실행 권한`은 `나`, `액세스 권한`은 `모든 사용자`로 설정합니다.
7. 배포 후 생성된 `/exec` URL을 `.env.local`의 `APPS_SCRIPT_URL`에 넣습니다.

### 3. 동작 확인

1. 랜딩 페이지에서 휴대폰 번호 또는 이메일을 제출합니다.
2. Google Sheet에 `submissionKey`가 포함된 행이 생겼는지 확인합니다.
3. 설문을 진행하고 새로고침했을 때 같은 기기에서 작성 상태가 복원되는지 확인합니다.
4. 설문 완료 후 `surveyCompleted` 값이 `TRUE`로 저장되는지 확인합니다.

## 참고

- 휴대폰 번호와 이메일은 저장 전에 정규화됩니다.
- 설문은 입력 중과 단계 이동 시 자동 저장됩니다.
- Amplitude 이벤트에는 `landing_variant`, UTM 파라미터, referrer 정보가 함께 기록됩니다.
- 로컬 개발 환경에서는 분석 트래킹이 실행되지 않습니다.
