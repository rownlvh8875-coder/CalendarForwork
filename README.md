# CalendarForwork

토목영업 업무에 특화된 달력형 일정관리 프로그램입니다.

개인 Windows PC에서 먼저 사용할 수 있는 로컬 데스크톱 앱으로 시작하고, 이후 토목영업팀이 함께 사용하는 서버 기반 협업형 시스템으로 확장하는 것을 목표로 합니다.

## 현재 개발 단계

**UI MVP 구현 단계**

현재 `feat/calendar-ui-mvp` 브랜치에는 첫 번째 실행 가능한 UI vertical slice가 구현되어 있습니다.

### 구현 완료

- React + TypeScript + Vite 기반 UI
- Tauri v2 Windows 데스크톱 shell 구성
- Light / Dark 환경을 고려한 디자인 토큰
- 고정형 좌측 업무 네비게이션과 상단 작업바
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
- 저장소 구현을 교체할 수 있는 `EventRepository` 인터페이스
- 날짜 계산 / D-Day 계산을 UI와 분리한 domain 로직
- Vitest + React Testing Library 기반 자동 테스트
- GitHub Actions 프론트엔드 테스트 및 프로덕션 빌드 검증

### 현재 저장 방식

현재 UI MVP는 **메모리 저장소와 예시 데이터**를 사용합니다.

따라서 현재 등록한 일정은 프로그램을 다시 시작하면 초기화됩니다. 이 동작은 UI와 업무 흐름을 먼저 검증하기 위한 의도적인 MVP 단계이며, 실제 업무 데이터 영구 저장은 후속 단계에서 SQLite Repository로 교체합니다.

예시 사업명과 발주처는 UI 확인용 가상 데이터이며 실제 사업정보가 아닙니다.

## 아직 구현하지 않은 주요 기능

- SQLite 영구 저장
- 사업관리 Master / 사업별 Timeline
- 발주처 Master
- 주간 캘린더 / 목록형 일정 화면
- 일정 수정
- Drag & Drop 일정 이동 및 Undo
- 통합검색 / 상세 필터
- Excel Import Wizard / Excel Export
- 첨부파일 관리
- Windows 로컬 알림
- 자동백업 / 복원
- 설치파일 및 Release 패키징
- 팀 계정 / 권한 / 서버 API / PostgreSQL / 동시사용
- Google Calendar 등 외부 캘린더 연동

## 기술 구조

```text
React UI
   ↓
Domain / Application Logic
   ↓
EventRepository Interface
   ↓
현재: Memory Repository
향후: SQLite Repository
   ↓
팀 버전: API Repository → Server → PostgreSQL
```

UI와 업무 규칙이 SQLite 구현에 직접 종속되지 않도록 구성하여 향후 팀 버전에서도 화면과 핵심 로직을 최대한 재사용합니다.

## 로컬 실행

### Frontend

```bash
npm install
npm run dev
```

개발 서버 기본 포트는 `1420`입니다.

### Desktop

Tauri v2를 실행할 수 있는 Windows 개발환경에서:

```bash
npm install
npm run tauri dev
```

### Test

```bash
npm test -- --run
```

### Production frontend build

```bash
npm run build
```

### Rust / Tauri check

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## 주요 문서

- [V1 설계명세](docs/superpowers/specs/2026-09-10-calendar-for-work-design.md)
- [UI MVP 구현계획](docs/superpowers/plans/2026-09-10-calendar-ui-mvp.md)

## 다음 개발 우선순위

1. SQLite 영구 저장 및 마이그레이션 구조
2. 실제 사업 / 발주처 Master 관리
3. 사업별 단계 Timeline
4. Excel Import / Export
5. 검색 / 필터 / 중요일정 화면
6. Windows 알림 및 백업
7. 설치파일 패키징
8. 팀 공용 API / PostgreSQL 기반 협업형 구조 확장

## 제품 원칙

CalendarForwork는 일반적인 사내 ERP처럼 기능을 화면에 나열하는 방식보다 **매일 계속 켜두고 사용할 수 있는 높은 가독성과 빠른 입력 UX**를 우선합니다.

디자인 방향은 Google Calendar의 직관성, Linear 계열 업무도구의 정보밀도, Notion 계열의 여백과 정보계층을 참고하되 CalendarForwork의 토목영업 업무 흐름에 맞게 구성합니다.
