# Electron → Firebase Web Migration Design

**Date:** 2026-02-23
**Status:** Approved

## Summary

Electron 데스크톱 앱을 Firebase Hosting 기반 웹 앱으로 전환한다.
Electron 코드를 제거하고 순수 Vite + React SPA로 변환하며,
Firebase Auth (Google 로그인)를 추가하고, Firebase config를 환경변수로 고정한다.

## Requirements

- 웹 전용 전환 (Electron 완전 제거)
- Firebase Auth (Google 로그인)
- 환경변수 기반 Firebase config (런타임 설정 변경 없음)
- 기존 Firebase 프로젝트 및 Firestore 데이터 유지

## Section 1: Project Structure

### Before

```
src/main/index.ts            ← Electron main process
src/preload/index.ts         ← Electron preload bridge
src/renderer/src/            ← React app
electron.vite.config.ts      ← electron-vite config
electron-builder.yml         ← electron-builder config
```

### After

```
src/                          ← 기존 renderer/src 내용
├── App.tsx
├── main.tsx                  ← entry (BrowserRouter)
├── components/
│   ├── LoginPage.tsx         ← NEW: Google 로그인 UI
│   └── AuthGuard.tsx         ← NEW: 인증 가드
├── pages/
├── services/
│   ├── firebase/
│   │   ├── config.ts         ← 환경변수 전용으로 단순화
│   │   └── auth.ts           ← NEW: Auth 서비스
│   └── auditLog.ts           ← 변경 없음 (이미 Firestore 기반)
├── hooks/
├── stores/
│   ├── authStore.ts          ← NEW: Auth 상태 atom
│   └── ...
├── types/
├── utils/
└── i18n/
index.html                    ← Vite entry HTML
vite.config.ts                ← 순수 Vite config
firebase.json                 ← Firebase Hosting 설정
firestore.rules               ← Firestore Security Rules
.env                          ← Firebase config 환경변수
```

### Delete

- `src/main/` (Electron main process)
- `src/preload/` (Electron bridge)
- `electron.vite.config.ts`
- `electron-builder.yml`

## Section 2: Electron API Replacement

`window.electronAPI` 호출 7곳 대체:

### 2.1 Firebase Config (`services/firebase/config.ts`)

- `window.electronAPI.loadConfig()` 제거
- 환경변수(`VITE_FIREBASE_*`)에서 직접 읽기
- `initializeFirebaseApp()`를 동기 초기화로 변경
- `reinitializeFirebase()` 삭제

### 2.2 CSV File Dialog (`ImportPage.tsx`, `GroupsPage.tsx`, `RoomsPage.tsx`)

- `window.electronAPI.openFileDialog()` → `<input type="file" accept=".csv">` + FileReader API
- hidden input + ref 패턴 또는 기존 UI에 통합

### 2.3 Settings Page (`SettingsPage.tsx`)

- Firebase config 관련 UI 제거 (loadConfig, importAndSaveConfig, clearConfig)
- 언어 설정 등 다른 설정은 유지
- 설정 페이지 단순화

### 2.4 Audit Log

- 변경 없음 — `auditLog.ts`는 이미 Firestore 기반
- Electron IPC의 감사 로그 핸들러는 레거시 (사용되지 않음)

## Section 3: Firebase Auth + Security Rules

### Authentication Flow

```
앱 시작 → onAuthStateChanged 확인
  ├── 미로그인 → LoginPage (Google 로그인 버튼)
  └── 로그인됨 → 앱 진입 (App.tsx)
```

### New Files

**`services/firebase/auth.ts`**
- `GoogleAuthProvider` + `signInWithPopup`
- `signOut` 함수
- `onAuthStateChanged` 리스너

**`stores/authStore.ts`**
- `authUserAtom` — Firebase User | null
- `authLoadingAtom` — 초기 로딩 상태

**`components/LoginPage.tsx`**
- Google 로그인 버튼
- 앱 로고/브랜딩

**`components/AuthGuard.tsx`**
- 인증 상태에 따른 조건부 렌더링
- 로딩 중 스피너

### Changes to Existing Code

- `UserNameModal` 제거 → Google 계정의 `displayName` 사용
- `userNameAtom` → Firebase Auth user에서 이름 가져오도록 변경
- `App.tsx`에서 `AuthGuard`로 감싸기

### Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Section 4: Build & Deploy

### Vite Config

- `electron.vite.config.ts` → `vite.config.ts`
- `@vitejs/plugin-react` + `@tailwindcss/vite` 유지
- Electron 플러그인 제거

### Firebase Hosting

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

### Package Scripts

```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "deploy": "pnpm build && firebase deploy",
  "lint": "eslint .",
  "format": "prettier --write ."
}
```

### Remove Packages

- `electron`
- `electron-vite`
- `@electron-toolkit/preload`
- `@electron-toolkit/utils`
- `@electron-toolkit/eslint-config-ts`
- `electron-builder`
- `sharp`

### Add Packages

- `firebase-tools` (글로벌 CLI: `npm i -g firebase-tools`)

### Router Change

- `HashRouter` → `BrowserRouter` (Firebase Hosting SPA rewrite가 처리)

## Electron-Specific Code References

| File | Usage | Replacement |
|------|-------|-------------|
| `services/firebase/config.ts:29` | `electronAPI.loadConfig()` | 환경변수 직접 사용 |
| `pages/ImportPage.tsx:24` | `electronAPI.openFileDialog()` | `<input type="file">` |
| `pages/GroupsPage.tsx:188` | `electronAPI.openFileDialog()` | `<input type="file">` |
| `pages/RoomsPage.tsx:200` | `electronAPI.openFileDialog()` | `<input type="file">` |
| `pages/SettingsPage.tsx:95` | `electronAPI.loadConfig()` | 제거 |
| `pages/SettingsPage.tsx:110` | `electronAPI.importAndSaveConfig()` | 제거 |
| `pages/SettingsPage.tsx:132` | `electronAPI.clearConfig()` | 제거 |

## Environment Variables

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```
