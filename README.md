# CalendarForwork

토목영업 업무에 특화된 달력형 일정관리 프로그램입니다.

개인 Windows PC에서 먼저 사용하는 로컬 데스크톱 앱으로 시작하고, 이후 토목영업팀이 함께 사용하는 서버 기반 협업형 시스템으로 확장하는 것을 목표로 합니다.

## 현재 개발 단계

**UI MVP + SQLite 일정/사업/발주처 Master 단계**

현재 월간 일정관리, SQLite 영구저장, 사업 Master, 발주처 Master, 일정-사업 연결까지 하나의 동작 가능한 흐름으로 구현되어 있습니다.

## 구현 완료

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
- 일정 상세 우측 Side Panel
- 빠른 일정 등록과 등록 후 월간 캘린더 즉시 갱신
- `오늘의 업무` 대시보드
- SQLite 일정 생성 / 조회 / 기간조회 / 예정조회 / 수정 / 삭제
- 실제 SQLite 파일 재오픈 durability 자동 테스트
- 사업 Master
  - 사업코드 / 사업명 / 발주처 / 공사유형 / 지역 / 계약방식 / 공사비
  - 현재단계 / 중요도 / 담당자 / 입찰예정일 / 설명 / 메모 / URL
  - 검색 / 단계필터 / 요약지표 / 우측 상세패널
  - 물리 삭제 대신 보관(archive)
- 발주처 Master
  - 발주처명 / 구분 / 부서 / 담당자 / 연락처 / 이메일 / 메모
  - 검색 / 구분필터 / 연결사업 수 표시
  - 발주처 삭제 시 연결 사업은 유지하고 발주처 연결만 해제
- 일정 등록 시 등록된 사업 선택
  - `projectId` 저장
  - 사업명 및 발주처명 snapshot 저장
  - 사업을 선택하지 않은 일정도 등록 가능
- SQLite schema migration version 2
  - `events`
  - `clients`
  - `project_stages`
  - `projects`
- 사업 진행단계 17종
  - 관심사업 / 계획 / 발주예정 / 입찰공고 / PQ / SOQ
  - 기본설계 / 실시설계 / 설계심의 / 가격입찰 / 개찰 / 우선협상
  - 수주 / 탈락 / 보류 / 종료 / 취소
- `EventRepository`, `ClientRepository`, `ProjectRepository` 추상화
- Tauri IPC + Rust + rusqlite 영구저장 adapter
- 브라우저/Vitest용 공유 Memory Repository
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

실제 Tauri 앱의 빈 DB에는 UI 확인용 가상 사업·발주처·일정을 자동 삽입하지 않습니다.

### 브라우저 개발 / Vitest

`npm run dev`로 브라우저에서 확인하거나 Vitest를 실행할 때는 Memory Repository와 명시적으로 **가상**이라고 표시한 데모 데이터를 사용합니다.

이 데이터는 브라우저 새 실행 시 유지되지 않으며 실제 SQLite 영구저장 데이터가 아닙니다.

## 저장 계층 구조

```text
React UI
   ↓
Domain / Application Logic
   ↓
Repository Interfaces
   ├─ EventRepository
   ├─ ClientRepository
   └─ ProjectRepository
          │
          ├─ Browser / Vitest → shared Memory Repositories
          │
          └─ Tauri Desktop   → Tauri Repository Adapters
                                  ↓ invoke()
                              Rust Tauri Commands
                                  ↓
                              SQLite Persistence
                                  ↓
                              calendarforwork.sqlite3

향후 팀 버전
Repository Interface → API Repository → Server → PostgreSQL
```

UI와 업무 규칙이 SQLite 구현에 직접 종속되지 않도록 구성하여 향후 팀 버전에서도 화면과 핵심 로직을 최대한 재사용합니다.

## 관계 규칙

- Project와 Event는 별도 Entity입니다.
- Project는 `client_id`로 Client를 참조합니다.
- Client 삭제 시 연결된 Project의 `client_id`는 `NULL`이 됩니다.
- Client 삭제가 Project나 Event를 삭제하지는 않습니다.
- Project는 기본적으로 삭제 대신 `archived` 상태로 보관합니다.
- Event에 연결된 사업명·발주처명은 일정 생성 시 snapshot으로 함께 저장합니다.

## 아직 구현하지 않은 주요 기능

- 사업별 단계 Timeline
- 주간 캘린더 / 목록형 일정 화면
- 일정 Full Form 편집 UX 고도화
- Drag & Drop 일정 이동 및 Undo
- 통합검색 / 상세 필터 / 중요일정 전용 화면
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
- [사업·발주처 Master 구현계획](docs/superpowers/plans/2026-09-11-project-client-master.md)

## 다음 개발 우선순위

1. 사업별 단계 Timeline
2. Excel Import / Export
3. 통합검색 / 상세 필터 / 중요일정 화면
4. Windows 알림 및 자동백업
5. 설치파일 패키징
6. 팀 공용 API / PostgreSQL 기반 협업형 구조 확장

## 제품 원칙

CalendarForwork는 일반적인 사내 ERP처럼 기능을 화면에 나열하는 방식보다 **매일 계속 켜두고 사용할 수 있는 높은 가독성과 빠른 입력 UX**를 우선합니다.

디자인 방향은 Google Calendar의 직관성, Linear 계열 업무도구의 정보밀도, Notion 계열의 여백과 정보계층을 참고하되 CalendarForwork의 토목영업 업무 흐름에 맞게 구성합니다.
