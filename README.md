# CalendarForwork

토목영업 업무에 특화된 달력형 일정관리 프로그램입니다.

개인 Windows PC에서 먼저 사용하는 로컬 데스크톱 앱으로 시작하고, 이후 토목영업팀이 함께 사용하는 서버 기반 협업형 시스템으로 확장하는 것을 목표로 합니다.

## 현재 개발 단계

**UI MVP + SQLite 영구저장 단계**

현재 UI vertical slice와 Tauri/SQLite 영구저장 계층이 구현되어 있습니다.

### 구현 완료

- React + TypeScript + Vite 기반 UI
- Tauri v2 Windows 데스크톱 shell
- Light / Dark 환경을 고려한 디자인 토큰
- 좌측 업무 네비게이션과 상단 작업바
- 42칸(6주) 고정 월간 캘린더
- 이전 달 / 오늘 / 다음 달 이동
- 일정 카테고리별 시각 구분
- 중요도 및 고정 일정 우선 정렬
- D-Day / D-N / D+N 마감 표시
- 날짜당 일정 3건 우선 표시 + `+N개 더보기`
- 일정 클릭 시 우측 상세 Side Panel
- 상세 패널에서 완료 처리 / 삭제 / Esc 닫기
- 빠른 일정 등록
  - 상단 `+ 일정 등록`
  - 날짜 셀 더블클릭
  - 일정명 / 날짜 / 시간 / 구분 / 중요도 / 마감시간 / 사업명 / 발주처 입력
- 등록 후 월간 캘린더 즉시 갱신
- `오늘의 업무` 대시보드
  - 마감 초과
  - 긴급
  - 이번 주
  - 발주예정
- `EventRepository` 추상화
- Tauri runtime용 SQLite `EventRepository` adapter
- 브라우저/Vitest용 Memory Repository
- SQLite schema migration version 관리
- 일정 생성 / 조회 / 기간조회 / 예정조회 / 수정 / 삭제 영구저장
- 실제 SQLite 파일을 닫고 다시 열어도 일정이 유지되는 durability 자동 테스트
- GitHub Actions 프론트엔드 + Windows Tauri/Rust 자동검증

## 데이터 저장 방식

### 실제 Tauri 데스크톱 앱

실제 Windows Tauri 앱에서는 SQLite를 사용합니다.

데이터베이스 파일은 Tauri의 앱 데이터 디렉터리 아래에 다음 이름으로 생성됩니다.

```text
app_data_dir()/calendarforwork.sqlite3
```

앱 identifier는 `com.calendarforwork.desktop`입니다.

SQLite는 `rusqlite`의 `bundled` 기능을 사용하므로 별도의 SQLite DLL 설치를 전제로 하지 않습니다. DB open 시 foreign key를 활성화하고 파일 DB는 WAL journal mode와 `synchronous = NORMAL`을 사용합니다.

실제 Tauri 앱의 빈 DB에는 UI 확인용 데모 일정을 자동 삽입하지 않습니다.

### 브라우저 개발 / Vitest

`npm run dev`로 브라우저에서 확인하거나 Vitest를 실행할 때는 기존 Memory Repository와 가상 데모 데이터를 사용합니다.

이 모드의 데이터는 브라우저 새 실행 시 유지되지 않으며, SQLite 영구저장 동작을 의미하지 않습니다. 예시 사업명과 발주처는 UI 확인용 가상 데이터입니다.

## 저장 계층 구조

```text
React UI
   ↓
Domain / Application Logic
   ↓
EventRepository Interface
   ├─ Browser / Vitest → Memory Repository
   └─ Tauri Desktop   → TauriEventRepository
                           ↓ invoke()
                       Rust Tauri Commands
                           ↓
                       SQLite Persistence
                           ↓
                       calendarforwork.sqlite3

향후 팀 버전
EventRepository → API Repository → Server → PostgreSQL
```

UI와 업무 규칙이 SQLite 구현에 직접 종속되지 않도록 구성하여 향후 팀 버전에서도 화면과 핵심 로직을 최대한 재사용합니다.

## 현재 SQLite 일정 데이터

현재 SQLite `events` 테이블은 다음 정보를 영구 저장합니다.

- 사업 ID / 사업명 / 발주처명
- 일정 분류 ID / key / 이름
- 일정명 / 설명
- 시작일시 / 종료일시 / 마감일시
- 종일 일정 여부
- 진행상태 / 중요도
- 담당자 / 위치 / URL / 메모
- 중요일정 Pin 여부
- 완료시각
- 생성시각 / 수정시각

`deadline_at`과 일반 `start_at` / `end_at`은 별도 필드로 관리합니다.

## 아직 구현하지 않은 주요 기능

- 사업관리 Master / 사업별 Timeline
- 발주처 Master
- 주간 캘린더 / 목록형 일정 화면
- 일정 Full Form 편집 UX 고도화
- Drag & Drop 일정 이동 및 Undo
- 통합검색 / 상세 필터
- Excel Import Wizard / Excel Export
- 첨부파일 관리
- Windows 로컬 알림
- 자동백업 / 복원
- 설치파일 및 Release 패키징
- 팀 계정 / 권한 / 서버 API / PostgreSQL / 동시사용
- Google Calendar 등 외부 캘린더 연동

## 로컬 실행

### Frontend 개발

```bash
npm install
npm run dev
```

개발 서버 기본 포트는 `1420`입니다.

### Windows Desktop

Tauri v2를 실행할 수 있는 Windows 개발환경에서:

```bash
npm install
npm run tauri dev
```

### Frontend test

```bash
npm test -- --run
```

### Production frontend build

```bash
npm run build
```

### Rust / SQLite test

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

### Rust / Tauri check

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## CI 검증

GitHub Actions는 `main`, `feat/**`, `main` 대상 Pull Request에서 검증합니다.

Frontend job:

1. npm dependencies 설치
2. 전체 Vitest 실행
3. TypeScript + Vite production build

Windows Desktop job:

1. desktop tooling 설치
2. Tauri icon 생성
3. Rust/SQLite 전체 테스트
4. Tauri Rust `cargo check`

## 주요 문서

- [V1 설계명세](docs/superpowers/specs/2026-09-10-calendar-for-work-design.md)
- [UI MVP 구현계획](docs/superpowers/plans/2026-09-10-calendar-ui-mvp.md)
- [SQLite 영구저장 구현계획](docs/superpowers/plans/2026-09-10-sqlite-persistence.md)

## 다음 개발 우선순위

1. 사업 / 발주처 Master 관리
2. 사업별 단계 Timeline
3. Excel Import / Export
4. 검색 / 필터 / 중요일정 화면
5. Windows 알림 및 자동백업
6. 설치파일 패키징
7. 팀 공용 API / PostgreSQL 기반 협업형 구조 확장

## 제품 원칙

CalendarForwork는 일반적인 사내 ERP처럼 기능을 화면에 나열하는 방식보다 **매일 계속 켜두고 사용할 수 있는 높은 가독성과 빠른 입력 UX**를 우선합니다.

디자인 방향은 Google Calendar의 직관성, Linear 계열 업무도구의 정보밀도, Notion 계열의 여백과 정보계층을 참고하되 CalendarForwork의 토목영업 업무 흐름에 맞게 구성합니다.
