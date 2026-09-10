# CalendarForwork V1 설계명세

- 작성일: 2026-09-10
- 대상: Windows 개인 PC용 토목영업 일정관리 프로그램
- 확장 목표: 향후 토목영업팀 다중 사용자 협업 시스템
- 상태: Design Approved for Spec Review

## 1. 제품 목표

CalendarForwork는 일반 개인 일정표가 아니라 **토목영업 사업·입찰 일정 중심의 업무 캘린더**다.

핵심 목표는 다음과 같다.

1. 입찰공고, PQ, SOQ, 현장설명, 설계, 설계심의, 가격입찰, 개찰, 발주예정 등 주요 일정을 달력에서 즉시 파악한다.
2. 하나의 사업에 여러 일정을 연결하여 전체 입찰 진행 흐름을 Timeline으로 관리한다.
3. D-Day, 마감 임박, 지연, 완료 여부를 자동 계산하여 놓치는 일정을 줄인다.
4. 기존 Excel 사업·일정 자료를 Import하여 기존 업무자료를 재사용한다.
5. 사업명, 발주처, 담당자, 지역, 단계, 메모 등을 통합검색하고 조합 필터링한다.
6. V1은 SQLite 기반 개인용으로 시작하되, 향후 API/PostgreSQL 기반 팀용으로 확장한다.
7. 기능 수보다 **정보 가독성, 입력 속도, 일상적 사용성, UI 일관성**을 우선한다.

---

## 2. V1 범위

### 포함

- 월간 캘린더
- 주간 캘린더
- 목록형 일정 보기
- 오늘 업무 Dashboard
- 일정 등록 / 수정 / 삭제
- Calendar Drag & Drop 일정 이동
- 사업관리
- 사업 상세 Timeline
- 발주처 관리
- 일정 카테고리
- 진행상태 / 중요도
- D-Day / 지연 상태
- 중요 일정 Pin
- 통합검색
- 복합 필터
- 메모 / URL / 첨부파일 경로
- Windows 로컬 알림
- Excel Import Wizard
- Excel Export
- SQLite 자동백업 / 복원
- Light / Dark Mode
- 키보드 단축키
- 기본 환경설정

### V1에서 제외

- 사용자 로그인
- 사용자 권한
- 실시간 동시편집
- 사내 서버
- 모바일 앱
- 전자결재
- 메신저
- CRM 전체 기능
- 나라장터 자동수집
- 외부 캘린더 양방향 동기화

이 기능들은 V2 이후 독립 기능으로 확장한다.

---

## 3. 기술 아키텍처

### 권장 기술

- Frontend: React
- Language: TypeScript
- Desktop Runtime: Tauri
- Local Database: SQLite
- Styling: Design Token + Component 기반 CSS 구조

### V1 데이터 흐름

```text
React UI
  ↓
Application Service
  ↓
Repository Interface
  ↓
SQLite Repository
  ↓
SQLite
```

UI Component가 SQLite query를 직접 수행하지 않는다.

### V2 확장 구조

```text
React UI
  ↓
Application Service
  ↓
Repository Interface
  ↓
API Repository
  ↓
REST API
  ↓
PostgreSQL
```

이 구조로 V1을 만들면 향후 팀용 전환 시 화면과 업무 규칙을 대부분 재사용할 수 있다.

---

## 4. 정보구조 및 Navigation

좌측 Sidebar 기본 메뉴:

1. 오늘
2. 캘린더
3. 일정
4. 사업관리
5. 발주처
6. 중요일정
7. 보관함
8. 설정

Sidebar는 접기/펼치기를 지원한다.

상단 Global 영역:

- 통합검색
- 빠른 일정등록
- 현재 View Context
- 필요 시 Filter Button

---

## 5. UI/UX 설계 원칙

CalendarForwork의 핵심 품질은 UI/UX다. ERP처럼 정보가 많더라도 화면이 무겁거나 복잡해 보이지 않아야 한다.

### 5.1 기본 방향

- Google Calendar 수준의 일정 조작 직관성
- Linear 계열의 밀도 높은 업무 UI
- Notion 계열의 정돈된 Typography와 여백
- 업무용 ERP의 정보량은 유지하되 불필요한 Box/Border는 최소화

### 5.2 시각적 우선순위

1. 사업명 또는 핵심 일정명
2. 마감일 / D-Day
3. 일정 유형
4. 현재상태
5. 발주처
6. 담당자 및 부가정보

### 5.3 화면 밀도

- 지나친 Card UI 사용 금지
- 한 화면에서 충분한 일정을 확인할 수 있는 Compact Density 적용
- 사용자가 설정에서 기본/Compact 밀도를 선택할 수 있도록 확장 가능하게 설계

### 5.4 색상 원칙

색상만으로 의미를 전달하지 않는다. 색상 + 텍스트 또는 아이콘을 함께 사용한다.

초기 Category Color Direction:

- 입찰공고: Blue
- PQ / SOQ: Violet
- 현장설명: Cyan
- 설계: Indigo
- 설계심의: Orange
- 가격입찰 / 개찰: Red
- 발주예정: Green
- 회의: Gray
- 보고 / 제출: Amber
- 기타: Neutral

실제 색상값은 Design Token으로 관리하고 Light/Dark Theme에서 각각 접근성 대비를 검증한다.

### 5.5 Feedback

일정 변경, 삭제, Drag 이동 등 사용자 Action에는 즉시 Feedback을 준다.

예:

```text
지제차량기지 PQ 제출일을 9월 15일 → 9월 17일로 변경했습니다. [실행취소]
```

---

## 6. 메인 Calendar 화면

### 6.1 Top Bar

- 이전 기간
- 오늘
- 다음 기간
- 현재 연/월
- 월간 / 주간 / 목록 View Switch
- 검색
- 필터
- + 일정등록

### 6.2 월간 Calendar Cell

각 날짜 Cell은 다음을 표현한다.

- 날짜
- 일정 최대 3건 우선 노출
- Category Accent
- 중요 일정 표시
- D-Day
- 추가 일정 개수

예:

```text
10일

[PQ] 지제차량기지 D-3
[발주] 제주 제2공항
[회의] ○○사업 실무회의

+5개 더보기
```

한 날짜에 일정이 많아도 Cell 높이를 계속 늘리지 않는다.

### 6.3 일정 선택

일정 클릭 시 기본적으로 새로운 Page로 이동하지 않고 우측 Detail Side Panel을 연다.

사용자는 Calendar Context를 유지한 채 내용을 확인하고 수정할 수 있다.

---

## 7. 일정 상세 Side Panel

표시 항목:

- 일정명
- 사업명
- 발주처
- 일정분류
- 시작일
- 종료일
- 마감시간
- D-Day
- 진행상태
- 중요도
- 공사비
- 입찰방식
- 담당자
- 위치
- 메모
- URL
- 첨부파일
- 관련일정
- 생성/수정 정보

주요 Action:

- 수정
- 완료
- 복제
- Pin
- 삭제

삭제는 실수 방지를 위해 확인 절차를 둔다.

---

## 8. 오늘 업무 Dashboard

프로그램을 실행했을 때 실제 업무 우선순위를 즉시 판단할 수 있는 화면이다.

### 긴급

- D-Day
- D-1
- D-2

### 이번 주

- 향후 7일 이내 일정

### 마감 초과

- deadline이 지났으나 완료되지 않은 일정

### 발주예정

- 가까운 발주예정 사업

### 주요사업

- 사용자가 Pin한 사업

각 목록에서 일정 또는 사업 상세 화면으로 즉시 이동한다.

---

## 9. 사업관리

Calendar Event와 Project는 별도 Entity로 관리한다.

### Project 주요 필드

- id
- project_code
- name
- client_id
- project_type
- region
- contract_type
- estimated_cost
- current_stage
- priority
- assignee
- expected_bid_date
- description
- memo
- url
- archived
- created_at
- updated_at

### 기본 사업단계

- 관심사업
- 계획
- 발주예정
- 입찰공고
- PQ
- SOQ
- 기본설계
- 실시설계
- 설계심의
- 가격입찰
- 개찰
- 우선협상
- 수주
- 탈락
- 보류
- 종료

단계 목록은 설정 가능한 Master Data로 설계한다.

---

## 10. 사업 Timeline

사업 상세 화면에서 관련 Event를 날짜순 및 업무단계 순으로 연결한다.

예:

```text
발주예정
   ↓
입찰공고
   ↓
PQ
   ↓
현장설명
   ↓
기본설계
   ↓
설계심의
   ↓
가격입찰
   ↓
개찰
   ↓
수주 / 탈락
```

상태:

- 완료
- 진행중
- 예정
- 지연

Timeline Node를 클릭하면 해당 일정 상세 Side Panel을 연다.

---

## 11. 일정 데이터 모델

### events

```text
id
project_id
category_id
title
description
start_at
end_at
deadline_at
all_day
status
priority
assignee
location
url
memo
is_pinned
completed_at
created_at
updated_at
```

`deadline_at`과 일반 `start_at/end_at`을 구분하여 실제 제출 마감시간을 정확히 표현한다.

---

## 12. 발주처 데이터 모델

### clients

```text
id
name
category
department
contact_name
phone
email
memo
created_at
updated_at
```

V1에서는 조직도/담당자 CRM 기능까지 확장하지 않는다.

---

## 13. 일정분류 데이터 모델

### categories

```text
id
name
color_token
icon
sort_order
is_active
```

초기값:

- 입찰공고
- PQ
- SOQ
- 현장설명
- 설계
- 설계심의
- 가격입찰
- 개찰
- 발주예정
- 회의
- 보고
- 제출
- 기타

---

## 14. 첨부파일

V1에서는 대용량 파일 자체를 SQLite BLOB으로 저장하지 않는다.

Attachment Record에는 다음 정보를 저장한다.

- id
- entity_type
- entity_id
- file_name
- file_path
- created_at

향후 팀용에서는 Attachment Service 구현을 서버 Storage 기반으로 교체한다.

로컬 파일 이동/삭제로 경로가 깨질 수 있으므로 열기 실패 시 명확한 Missing File 상태를 표시한다.

---

## 15. 검색

Global Search 대상:

- 사업명
- 사업코드
- 일정명
- 발주처
- 담당자
- 지역
- 메모

검색 결과는 Entity별로 Grouping한다.

예:

```text
사업
제주 제2공항 1공구

일정
제주 제2공항 PQ 제출

발주처
제주지방항공청
```

---

## 16. 필터

지원조건:

- 일정분류
- 발주처
- 사업
- 담당자
- 진행상태
- 중요도
- 기간
- 완료 / 미완료
- Pin 여부

복수 조건을 조합할 수 있어야 한다.

---

## 17. D-Day 규칙

기준은 `deadline_at`이다.

표기:

- D-30
- D-7
- D-3
- D-1
- D-Day
- D+1

완료 일정에는 필요 이상으로 경고색을 유지하지 않는다.

마감일이 지났으나 완료되지 않은 일정은 `Overdue` 상태로 표시한다.

---

## 18. 일정 입력 UX

일정 등록에 시간이 오래 걸리지 않도록 Quick Form과 Full Form을 분리한다.

### Quick Form

- 일정명
- 사업
- 분류
- 날짜
- 시간
- 중요도

### Full Form

Quick Form 항목 +

- 상세설명
- 발주처
- 담당자
- 마감시간
- 위치
- 진행상태
- 메모
- URL
- 첨부파일
- 알림

### 진입 방법

- `Ctrl + N`
- Calendar 빈 날짜 Double Click
- 날짜 Context Menu
- 상단 `+ 일정등록`

---

## 19. Drag & Drop

Calendar Event를 Drag하여 날짜를 변경할 수 있다.

기본 Flow:

1. Drag
2. Drop
3. DB Update
4. Toast Feedback
5. Undo 제공

중요도가 높은 일정은 향후 설정으로 이동 확인 Prompt를 활성화할 수 있게 설계한다.

---

## 20. 알림

V1은 Windows Desktop Notification을 사용한다.

Preset:

- 당일
- 1일 전
- 3일 전
- 7일 전
- 사용자 지정

Event 하나에 여러 알림을 연결할 수 있는 구조를 사용한다.

### reminders

```text
id
event_id
remind_at
is_sent
created_at
```

---

## 21. Excel Import

기존 토목영업 자료를 활용하기 위해 Wizard 방식으로 구현한다.

Flow:

1. Excel 파일 선택
2. Sheet 선택
3. Header 감지
4. Column Mapping
5. Preview
6. Validation
7. 중복 확인
8. Import
9. 결과 Summary

예시 Mapping:

```text
사업명      → projects.name
발주처      → clients.name
공사비      → projects.estimated_cost
발주예정일  → projects.expected_bid_date + 필요 시 Event 생성
진행상황    → projects.current_stage 또는 memo
```

Import는 Preview 없이 즉시 DB에 쓰지 않는다.

Validation Error가 있는 Row는 전체 실패보다 오류 Row를 분리하여 사용자에게 보여주는 방식을 우선한다.

---

## 22. Excel Export

내보내기 대상:

- 전체 사업
- 현재 필터 결과
- 기간별 일정
- 발주처별 사업
- 중요일정
- D-Day 일정

현재 화면에서 적용 중인 Filter 조건을 그대로 Export할 수 있어야 한다.

---

## 23. 단축키

초기 단축키:

- Ctrl + N: 일정 등록
- Ctrl + K: 통합검색
- T: 오늘
- M: 월간
- W: 주간
- L: 목록
- Esc: Modal/Panel 닫기

Text Input에 Focus가 있을 때 문자 단축키가 입력과 충돌하지 않게 한다.

---

## 24. 백업 / 복원

개인 PC 버전에서 데이터 유실 방지는 필수 기능이다.

### 자동백업

- 앱 시작 또는 종료 시 안전한 시점에 Backup 생성
- 날짜별 SQLite Backup
- 최근 일정 개수만 유지하는 Retention 정책
- Backup 실패가 원본 DB 동작을 막지 않도록 분리

예:

```text
backups/
  calendar-2026-09-10.db
  calendar-2026-09-09.db
```

### 수동백업

설정에서 즉시 Backup 생성 가능.

### 복원

복원 전 현재 DB를 별도 Safety Backup으로 보존한 뒤 선택한 Backup을 적용한다.

---

## 25. 오류처리

사용자에게 DB Exception 또는 기술 Stack Trace를 그대로 표시하지 않는다.

### 기본 원칙

- 사용자 메시지: 이해 가능한 업무 언어
- 내부 로그: 기술 상세정보
- 데이터 변경 실패: 변경 전 상태 유지
- Import 실패: 어느 Row/Column에서 실패했는지 표시
- 첨부파일 누락: 파일 경로 오류로 표시하고 DB Record는 보존
- Backup 실패: 경고하되 가능한 경우 앱 사용은 계속

---

## 26. 데이터 무결성

- 모든 주요 Table은 Primary Key 사용
- Project 삭제 시 연결된 Event를 무조건 Cascade 삭제하지 않는다.
- 삭제보다 Archive를 우선하는 Entity를 구분한다.
- 일정 삭제는 사용자 확인이 필요하다.
- Import 전에 Transaction Boundary를 둔다.
- Database Migration Version을 관리한다.

---

## 27. 성능 목표

V1 개인용 기준:

- 일반 Calendar 이동은 체감 지연 없이 동작
- 수천~수만 건 Event가 있어도 월간 View에서 필요한 기간만 query
- 검색 Input은 Debounce 적용
- 대량 Excel Import는 UI Freeze를 방지
- Calendar Rendering 시 모든 데이터를 한 번에 DOM에 표시하지 않는다.

---

## 28. 접근성 및 표시 품질

- 색상 외 텍스트/아이콘 병행
- 충분한 명도 대비
- Keyboard Navigation 고려
- 최소 Click Target 크기 확보
- 날짜와 숫자 Format 일관성 유지
- 고해상도 Windows Display Scaling 대응

---

## 29. 테스트 전략

### Unit Test

- D-Day 계산
- 상태 계산
- Filter Logic
- Validation
- Excel Column Mapping
- Repository Logic

### Integration Test

- Event CRUD
- Project/Event 연결
- SQLite Migration
- Import Transaction
- Backup / Restore

### UI Test

- Calendar Navigation
- Quick Add
- Side Panel
- Drag & Drop
- Filter
- Search
- Light/Dark Theme

### 핵심 사용자 시나리오

1. 사업 생성
2. 해당 사업에 PQ/설계심의/입찰 일정을 등록
3. Calendar에서 확인
4. Drag로 일정 변경
5. D-Day 자동 변경 확인
6. Excel에서 신규 사업 Import
7. Filter 후 Excel Export
8. 앱 재시작 후 데이터 유지 확인
9. Backup 생성 후 Restore 검증

---

## 30. UI Component 경계

초기 Component 후보:

```text
AppShell
Sidebar
TopBar
CalendarView
MonthGrid
WeekGrid
EventChip
EventQuickAdd
EventForm
EventDetailPanel
TodayDashboard
ProjectList
ProjectDetail
ProjectTimeline
ClientList
GlobalSearch
FilterPanel
ImportWizard
ExportDialog
SettingsView
Toast
ConfirmDialog
```

큰 Page 하나에 모든 로직을 넣지 않는다.

---

## 31. 권장 Source 구조

```text
src/
  app/
  components/
  features/
    calendar/
    events/
    projects/
    clients/
    search/
    import-export/
    settings/
  services/
  repositories/
  domain/
  hooks/
  utils/
  styles/

src-tauri/
  src/
  migrations/

docs/
  superpowers/
    specs/
```

구체적인 파일 단위 구조는 구현계획에서 확정한다.

---

## 32. V2 팀용 확장 원칙

V2에서 예상되는 변경:

- SQLite → PostgreSQL
- Local Repository → API Repository
- 로그인
- 사용자/팀
- Role/Permission
- 담당자 계정 연결
- 변경이력
- 서버 Attachment Storage
- 일정 공유
- 동시 사용자

V1부터 Entity에 불필요하게 user_id를 억지로 넣지 않는다. 대신 Repository/Service 경계를 유지하여 팀 기능 추가 시 Domain Migration이 가능하도록 한다.

---

## 33. V1 성공 기준

V1은 다음을 만족하면 개인용 Release Candidate로 본다.

1. 사업을 등록하고 여러 일정을 연결할 수 있다.
2. 월간/주간/목록 View가 정상 작동한다.
3. 중요 일정과 D-Day를 한눈에 확인할 수 있다.
4. 일정 등록/수정이 빠르고 복잡하지 않다.
5. Calendar 화면에 일정이 많아도 가독성이 유지된다.
6. Excel Import/Export가 실제 업무자료 흐름에서 사용 가능하다.
7. 앱 종료/재실행 후 데이터가 정상 유지된다.
8. Backup/Restore를 검증한다.
9. 일반적인 오류가 데이터 손상으로 이어지지 않는다.
10. 개인용 구조를 폐기하지 않고 V2 팀용으로 확장할 수 있다.

---

## 34. 구현 우선순위

구현계획 단계에서는 다음 순서를 기본으로 한다.

1. Project Scaffold / Design Token / App Shell
2. SQLite / Migration / Repository Layer
3. Project & Client CRUD
4. Event CRUD
5. Month Calendar
6. Event Detail Side Panel / Quick Add
7. D-Day / Status
8. Today Dashboard
9. Project Timeline
10. Search / Filter
11. Drag & Drop
12. Excel Import / Export
13. Notification
14. Backup / Restore
15. Dark Mode / UI Polish
16. 통합 테스트 / Release Packaging

이 우선순위는 UI 골격을 초기에 확정하고 기능을 그 위에 누적하는 방식이다.

---

## 35. 결정사항

- 개인 Windows PC용부터 시작한다.
- 향후 팀용 시스템으로 확장한다.
- UI/UX를 핵심 품질로 본다.
- React + TypeScript + Tauri + SQLite를 기본 기술구성으로 사용한다.
- Calendar Event와 Project를 분리한다.
- SQLite 접근은 Repository Layer 뒤로 숨긴다.
- Excel Import/Export를 V1에 포함한다.
- Calendar Context를 유지하기 위해 일정 상세는 Side Panel을 기본으로 한다.
- 월간 Cell의 과도한 확장을 막기 위해 일정 노출 개수를 제한한다.
- 중요한 변경에는 Undo 또는 확인 Feedback을 제공한다.
