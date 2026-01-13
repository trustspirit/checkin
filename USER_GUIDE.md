# CheckIn 앱 사용 설명서

참가자 체크인 관리를 위한 데스크톱 애플리케이션입니다.

---

## 목차

1. [설치 방법](#1-설치-방법)
2. [초기 설정](#2-초기-설정)
3. [주요 기능](#3-주요-기능)
   - [홈 (검색)](#31-홈-검색)
   - [참가자 관리](#32-참가자-관리)
   - [그룹 관리](#33-그룹-관리)
   - [객실 관리](#34-객실-관리)
   - [CSV 가져오기](#35-csv-가져오기)
   - [CSV 내보내기](#36-csv-내보내기)
   - [통계](#37-통계)
   - [감사 로그](#38-감사-로그)
   - [설정](#39-설정)
4. [개발자 가이드](#4-개발자-가이드)

---

## 1. 설치 방법

### 사전 요구사항

- **Node.js**: v18 이상
- **pnpm**: 패키지 매니저 (권장)
- **Firebase 프로젝트**: Firestore 데이터베이스가 활성화된 프로젝트

### 개발 환경 설치

```bash
# 저장소 클론
git clone <repository-url>
cd checkin

# 의존성 설치
pnpm install

# 개발 모드 실행
pnpm dev
```

### 프로덕션 빌드

```bash
# macOS용 빌드
pnpm build:mac

# Windows용 빌드
pnpm build:win

# Linux용 빌드
pnpm build:linux

# 모든 플랫폼 빌드
pnpm build:all
```

빌드된 설치 파일은 `dist/` 폴더에 생성됩니다:
- **macOS**: `CheckIn-1.0.0.dmg`
- **Windows**: `CheckIn Setup 1.0.0.exe`
- **Linux**: `CheckIn-1.0.0.AppImage`

---

## 2. 초기 설정

### 2.1 Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트 생성
2. **Firestore Database** 활성화
3. **프로젝트 설정 > 일반 > 내 앱**에서 웹 앱 추가
4. Firebase 설정 정보를 JSON 파일로 저장:

```json
{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_PROJECT.firebaseapp.com",
  "projectId": "YOUR_PROJECT_ID",
  "storageBucket": "YOUR_PROJECT.appspot.com",
  "messagingSenderId": "YOUR_SENDER_ID",
  "appId": "YOUR_APP_ID"
}
```

### 2.2 앱에서 Firebase 연결

1. 앱 실행 후 좌측 사이드바에서 **Settings** 클릭
2. **Import Config File** 버튼 클릭
3. 위에서 저장한 JSON 파일 선택
4. 연결 성공 시 초록색 "Connected" 상태 표시

### 2.3 사용자 이름 설정

1. 앱 첫 실행 시 사용자 이름 입력 모달 표시
2. 이름 입력 후 **Save** 클릭
3. 이 이름은 감사 로그에 기록됨
4. Settings에서 언제든 변경 가능

---

## 3. 주요 기능

### 3.1 홈 (검색)

메인 화면에서 참가자를 빠르게 검색하고 체크인/체크아웃할 수 있습니다.

#### 검색 기능
- **이름**, **이메일**, **전화번호**로 검색 가능
- 실시간 검색 결과 표시
- 검색 결과에서 바로 체크인/체크아웃 가능

#### 빠른 체크인/체크아웃
- 검색 결과에서 **Check In** 버튼 클릭
- 체크인된 참가자는 **Check Out** 버튼 표시
- 상태 배지로 현재 체크인 상태 확인

---

### 3.2 참가자 관리

#### 참가자 목록 (Participants)

좌측 사이드바의 **Participants**를 클릭하여 전체 참가자 목록을 확인합니다.

**기능:**
- **필터링**: 전체 / 체크인됨 / 체크인 안됨
- **검색**: 이름, 이메일, 전화번호, 와드, 스테이크로 검색
- **정렬**: 이름, 와드, 그룹, 객실, 상태, 결제 상태별 정렬
- **보기 모드**: 리스트 / 그리드 뷰 전환
- **일괄 작업**: 여러 참가자 선택 후 그룹/객실 일괄 배정

#### 참가자 상세 페이지

참가자를 클릭하면 상세 정보 페이지로 이동합니다.

**개인 정보 섹션:**
- 이름, 이메일, 전화번호
- 성별, 나이
- 와드, 스테이크
- 결제 상태 (클릭하여 바로 변경 가능)
- 메모 (인라인 편집 가능)

**결제 상태 변경:**
1. **Paid/Unpaid** 버튼 클릭
2. 확인 다이얼로그에서 **확인** 클릭
3. 변경 사항이 즉시 반영됨

**메모 편집:**
1. 메모 섹션의 **Edit** 또는 **Add memo** 클릭
2. 내용 입력 후 **Save** 클릭
3. Edit 모드 진입 없이 바로 수정 가능

**그룹/객실 배정:**
1. **Group** 또는 **Room** 섹션에서 **Assign/Change** 클릭
2. 기존 그룹/객실 선택 또는 새로 생성
3. 배정 완료 시 자동 저장

**체크인/체크아웃 히스토리:**
- 모든 체크인/체크아웃 기록을 타임라인 형태로 표시
- 각 세션별 체류 시간 표시
- 현재 활성 세션 표시

#### 참가자 추가

1. 참가자 목록에서 **Add Participant** 버튼 클릭
2. 필수 정보 입력: 이름, 이메일
3. 선택 정보 입력: 전화번호, 성별, 나이, 와드, 스테이크
4. 그룹/객실 선택 (선택사항)
5. **Add Participant** 클릭

---

### 3.3 그룹 관리

좌측 사이드바의 **Groups**를 클릭합니다.

#### 그룹 목록
- 모든 그룹과 참가자 수 표시
- 예상 인원 대비 현재 인원 표시
- 그룹 클릭 시 상세 페이지로 이동

#### 그룹 상세 페이지
- 그룹에 속한 참가자 목록
- 그룹 이름 및 예상 인원 수정
- 참가자 그룹에서 제거
- 그룹 삭제 (소속 참가자는 미배정 상태로 변경)

#### 그룹 생성
- 그룹 목록에서 **Create Group** 클릭
- 그룹 이름과 예상 인원 입력
- 참가자 배정 시 자동 생성도 가능

---

### 3.4 객실 관리

좌측 사이드바의 **Rooms**를 클릭합니다.

#### 객실 목록
- 모든 객실과 수용 현황 표시
- 상태별 색상 구분:
  - 🟢 **여유**: 빈 자리 있음
  - 🟡 **거의 참**: 1자리 남음
  - 🔴 **만실**: 수용 인원 초과 불가

#### 객실 상세 페이지
- 객실에 배정된 참가자 목록
- 객실 번호 및 최대 수용 인원 수정
- 참가자 객실에서 제거
- 객실 삭제 (배정된 참가자는 미배정 상태로 변경)

#### 객실 생성
- 객실 목록에서 **Create Room** 클릭
- 객실 번호와 최대 수용 인원 입력
- 참가자 배정 시 자동 생성도 가능

---

### 3.5 CSV 가져오기

대량의 참가자 데이터를 CSV 파일로 가져올 수 있습니다.

#### 지원 필드
| 필드명 | 설명 | 필수 |
|--------|------|------|
| `name` | 이름 | ✅ |
| `email` | 이메일 | ✅ |
| `gender` | 성별 (male/female) | |
| `age` | 나이 | |
| `stake` | 스테이크 | |
| `ward` | 와드 | |
| `phoneNumber` | 전화번호 | |
| `groupName` | 그룹명 (없으면 자동 생성) | |
| `roomNumber` | 객실 번호 (없으면 자동 생성) | |

#### 가져오기 방법
1. 좌측 사이드바에서 **Import** 클릭
2. **Select CSV File** 버튼 클릭
3. CSV 파일 선택
4. 미리보기에서 데이터 확인
5. 필드 매핑 확인 및 수정
6. **Import** 버튼 클릭
7. 결과 확인 (생성/업데이트 건수)

#### CSV 예시
```csv
name,email,gender,age,stake,ward,phoneNumber,groupName,roomNumber
홍길동,hong@example.com,male,25,서울 스테이크,강남 와드,010-1234-5678,1조,101
김철수,kim@example.com,male,30,서울 스테이크,서초 와드,010-2345-6789,1조,101
이영희,lee@example.com,female,28,부산 스테이크,해운대 와드,010-3456-7890,2조,102
```

---

### 3.6 CSV 내보내기

참가자 및 관련 데이터를 CSV 파일로 내보낼 수 있습니다.

#### 내보내기 방법
1. 좌측 사이드바에서 **Participants** 클릭
2. **Export** 버튼 클릭
3. 원하는 내보내기 옵션 선택

#### 내보내기 옵션
| 옵션 | 설명 |
|------|------|
| **Participants (Current View)** | 현재 필터링/검색된 참가자만 내보내기 |
| **All Participants** | 전체 참가자 데이터 내보내기 |
| **With Check-in History** | 모든 체크인/체크아웃 이력 포함 |
| **Check-in Summary** | 체크인 현황 요약 (세션 수, 총 체류시간 등) |
| **Groups** | 전체 그룹 데이터 내보내기 |
| **Rooms** | 전체 객실 데이터 내보내기 |

#### 내보내기 필드

**참가자 기본 필드:**
- name, email, gender, age, stake, ward, phoneNumber
- isPaid, memo, groupName, roomNumber, checkInStatus
- createdAt, updatedAt

**체크인 이력 포함 시 추가 필드:**
- sessionNumber, checkInTime, checkOutTime, durationMinutes

---

### 3.7 통계

통계 페이지에서 등록 및 체크인 현황을 시각화된 차트로 확인할 수 있습니다.

#### 통계 페이지 접근
- 상단 네비게이션 바에서 **Statistics** 클릭

#### 요약 카드
| 카드 | 설명 |
|------|------|
| **Total Registered** | 전체 등록 참가자 수 |
| **Currently Checked In** | 현재 체크인된 참가자 수 및 비율 |
| **Room Occupancy** | 객실 수용 현황 (현재/최대) |
| **Payment Status** | 결제/미결제 현황 |

#### 차트 종류

**도넛 차트:**
- **Check-in Status**: 체크인/미체크인 비율
- **Gender Distribution**: 성별 분포 (남/여/기타/미지정)
- **Payment Status**: 결제/미결제 비율

**막대 차트:**
- **Registration vs Check-in by Gender**: 성별 등록 대비 체크인 비교
- **Top 5 Groups**: 상위 5개 그룹 (참가자 수 기준)

**라인 차트:**
- **Daily Check-in/Check-out**: 최근 7일간 일일 체크인/체크아웃 추이

#### 상세 통계 테이블
- 전체/남성/여성별 등록 수, 체크인 수, 체크인율
- 그룹 및 객실 현황 요약

#### PDF 내보내기
통계 데이터를 PDF 파일로 내보낼 수 있습니다.

1. 통계 페이지 우측 상단의 **Export PDF** 버튼 클릭
2. PDF 생성 완료 후 자동 다운로드
3. 파일명: `CheckIn_Statistics_YYYY-MM-DD.pdf`

**PDF 내용:**
- 요약 카드 (등록 인원, 체크인 현황, 객실 현황, 결제 현황)
- 모든 차트 (도넛, 막대, 라인)
- 상세 통계 테이블

---

### 3.8 감사 로그

모든 데이터 변경 사항이 자동으로 기록됩니다.

#### 기록되는 항목
- **생성**: 참가자, 그룹, 객실 생성
- **수정**: 정보 변경 (변경 전/후 값 기록)
- **삭제**: 참가자, 그룹, 객실 삭제
- **체크인/체크아웃**: 체크인 및 체크아웃 시간
- **배정**: 그룹/객실 배정 변경
- **가져오기**: CSV 가져오기

#### 감사 로그 보기
1. 좌측 사이드바에서 **Audit Log** 클릭
2. 최근 변경 사항 확인
3. 타입별 필터링 (참가자/그룹/객실)
4. 실시간 업데이트 (다른 사용자 변경 사항도 반영)

#### 로그 정보
- **시간**: 변경 발생 시간
- **사용자**: 변경을 수행한 사용자
- **작업**: 수행된 작업 유형
- **대상**: 변경된 항목
- **상세**: 변경 전/후 값 (수정의 경우)

#### 로그 삭제
- **Clear All** 버튼으로 전체 로그 삭제 가능
- 삭제 전 확인 다이얼로그 표시

---

### 3.9 설정

좌측 사이드바에서 **Settings**를 클릭합니다.

#### 사용자 설정
- **사용자 이름**: 감사 로그에 기록될 이름 변경

#### 데이터베이스 설정
- **연결 상태**: 현재 Firebase 연결 상태 표시
- **Import Config File**: 새 Firebase 설정 파일 가져오기
- **Clear Config**: 현재 설정 삭제 (앱 재시작 필요)

#### 앱 정보
- 현재 앱 버전 정보

---

## 4. 개발자 가이드

### 4.1 기술 스택

- **프레임워크**: Electron + React 19
- **언어**: TypeScript
- **스타일링**: Tailwind CSS 4
- **상태 관리**: Jotai
- **데이터베이스**: Firebase Firestore
- **라우팅**: React Router DOM 7
- **차트**: Chart.js + react-chartjs-2
- **빌드 도구**: Vite + electron-vite

### 4.2 프로젝트 구조

```
checkin/
├── src/
│   ├── main/              # Electron 메인 프로세스
│   │   └── index.ts
│   ├── preload/           # Preload 스크립트
│   │   └── index.ts
│   └── renderer/          # React 앱
│       └── src/
│           ├── components/    # 재사용 컴포넌트
│           ├── pages/         # 페이지 컴포넌트
│           ├── services/      # API 서비스
│           │   ├── firebase/  # Firebase 서비스 (분리됨)
│           │   └── auditLog.ts
│           ├── stores/        # Jotai 스토어
│           ├── types/         # TypeScript 타입
│           └── styles/        # 전역 스타일
├── resources/             # 앱 아이콘
├── dist/                  # 빌드 출력
└── package.json
```

### 4.3 Firebase 서비스 구조

```
services/
├── firebase/
│   ├── config.ts          # Firebase 초기화 및 설정
│   ├── participants.ts    # 참가자 CRUD
│   ├── groups.ts          # 그룹 CRUD
│   ├── rooms.ts           # 객실 CRUD
│   ├── subscriptions.ts   # 실시간 구독
│   ├── csvImport.ts       # CSV 가져오기
│   └── index.ts           # 모듈 재export
├── auditLog.ts            # 감사 로그
└── csvExport.ts           # CSV 내보내기
```

### 4.4 Firestore 컬렉션 구조

```
participants/
├── {participantId}/
│   ├── name: string
│   ├── email: string
│   ├── gender: string
│   ├── age: number
│   ├── stake: string
│   ├── ward: string
│   ├── phoneNumber: string
│   ├── isPaid: boolean
│   ├── memo: string
│   ├── groupId: string | null
│   ├── groupName: string | null
│   ├── roomId: string | null
│   ├── roomNumber: string | null
│   ├── checkIns: Array<{id, checkInTime, checkOutTime?}>
│   ├── createdAt: Timestamp
│   └── updatedAt: Timestamp

groups/
├── {groupId}/
│   ├── name: string
│   ├── participantCount: number
│   ├── expectedCapacity: number
│   ├── createdAt: Timestamp
│   └── updatedAt: Timestamp

rooms/
├── {roomId}/
│   ├── roomNumber: string
│   ├── maxCapacity: number
│   ├── currentOccupancy: number
│   ├── createdAt: Timestamp
│   └── updatedAt: Timestamp

audit_logs/
├── {logId}/
│   ├── timestamp: Timestamp
│   ├── userName: string
│   ├── action: string
│   ├── targetType: string
│   ├── targetId: string
│   ├── targetName: string
│   └── changes: object | null
```

### 4.5 스크립트 명령어

```bash
# 개발 모드
pnpm dev

# 타입 체크
pnpm typecheck

# 린트
pnpm lint
pnpm lint:fix

# 포맷팅
pnpm format
pnpm format:check

# 빌드
pnpm build
pnpm build:mac
pnpm build:win
pnpm build:linux
```


