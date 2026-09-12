# CalendarForwork Excel Import / Export 설계명세

- 작성일: 2026-09-12
- 대상 브랜치: `feat/excel-import-export`
- 기준 브랜치: `feat/project-client-master`
- 상태: Design Approved → Written Spec Review

## 1. 목적

CalendarForwork V1에 기존 Excel 기반 토목영업 자료를 안전하게 가져오고, 현재 앱 데이터를 새 Excel 파일로 내보내는 기능을 추가한다.

핵심 목표는 다음과 같다.

1. 기존 사업/일정 Excel 자료를 재입력하지 않고 재사용한다.
2. Excel 컬럼명이 앱 내부 필드명과 달라도 자동 추론 후 사용자가 수정할 수 있다.
3. Import 전에 파일/시트 확인, 매핑, Preview, 전체 검증, 중복확인을 반드시 거친다.
4. 기존 데이터를 자동 덮어쓰지 않는다.
5. 정상 행만 선택적으로 Import할 수 있다.
6. Import 결과를 SQLite에 기록해 성공/중복/오류 건수를 추적한다.
7. Export는 원본 파일을 수정하지 않고 새 `.xlsx` 파일을 만든다.
8. Excel binary parsing과 writing은 React가 아니라 Rust/Tauri backend가 담당한다.

## 2. 범위

### 포함

- 사업(Project) Import / Export
- 일정(Event) Import / Export
- Native 파일 열기/저장 Dialog
- Workbook sheet 목록 조회
- Sheet 하나 선택
- 데이터셋 하나 선택: `projects` 또는 `events`
- 자동 header/column mapping
- 수동 mapping 수정
- Preview 최대 50행
- 전체 row validation
- 중복 탐지
- invalid/duplicate 제외 후 ready 행 Import
- SQLite transaction
- Import batch/row audit
- 결과 요약

### 제외

- 발주처(Client) 전용 Import Wizard
- 여러 파일 동시 Import
- 한 번의 session에서 사업/일정을 동시에 Import
- 기존 Project/Event 자동 update/overwrite
- Excel 원본 수정
- 매크로 실행
- 수식 계산 엔진
- 서식/차트/이미지 Import
- 양방향 Excel 동기화
- 자동 정기 Import

발주처는 사업 Import 과정에서 이름 기준으로 연결하거나 필요한 경우 생성하는 보조 Entity로 취급한다.

## 3. 기술 구조

```text
React Excel Wizard
  ↓
ExcelTransferRepository
  ↓ invoke()
Tauri Commands
  ↓
Rust Excel Service
  ├─ Workbook Reader
  ├─ Header Mapper
  ├─ Row Normalizer / Validator
  ├─ Duplicate Detector
  ├─ Import Transaction
  └─ XLSX Export Writer
       ↓
SQLite / File System
```

React는 workbook binary를 직접 읽거나 보관하지 않는다.

### 라이브러리 방향

- Import reader: `calamine`
- Export writer: `rust_xlsxwriter`
- Native open/save dialog: Tauri v2 dialog plugin
- Persistence: 기존 `rusqlite`

구체 dependency version은 구현 시 현재 Tauri/Rust toolchain과 호환되는 안정 버전으로 고정한다.

## 4. 파일 포맷

### Import

- `.xlsx`
- `.xls`
- `.xlsm`
- `.xlsb`
- `.ods`

매크로는 읽기 대상일 뿐 실행하지 않는다.

### Export

- `.xlsx`만 생성

## 5. Import Wizard

### Step 1. 파일 선택

Native open dialog에서 한 파일만 선택한다. 취소는 오류가 아니다.

### Step 2. Workbook 확인

Backend가 다음을 반환한다.

- fileName
- sheet 목록
- 각 sheet의 사용 행/열 수

사용자가 sheet 하나를 고른다.

### Step 3. 데이터 유형 선택

- 사업 가져오기
- 일정 가져오기

한 session은 한 유형만 처리한다.

### Step 4. Header 탐지 / Mapping

첫 번째 의미 있는 행을 기본 header 후보로 사용한다.

자동 mapping은 정규화된 alias dictionary로 수행한다.

사용자가 mapping을 직접 바꿀 수 있다.

하나의 Excel column은 앱 field 하나에만 매핑한다.

필수 field가 없으면 다음 단계로 진행할 수 없다.

### Step 5. Preview

최대 50행을 표시한다.

- 원본 행번호
- 주요 source value
- normalized value
- validation 상태
- duplicate 사유

Preview는 UX 확인용 표본이며 전체 validation 결과를 대신하지 않는다.

### Step 6. 전체 검증 / 중복확인

모든 대상 행은 정확히 아래 네 상태 중 하나가 된다.

- `ready`
- `duplicate`
- `invalid`
- `skipped`

사업명이 기존 사업명과 같지만 발주처가 없어 확정하기 어려운 경우도 별도 fifth status를 만들지 않고 `duplicate`에 포함하되 `message`에 `possible duplicate` 사유를 기록한다.

중복 행은 자동 update하지 않는다.

사용자 선택은 V1에서 다음 두 가지다.

- 중복/오류 행을 제외하고 ready 행만 Import
- 전체 Import 취소

### Step 7. Import 확정

Backend는 workbook을 다시 열고 mapping/validation을 재적용한다.

validate 시점과 파일 내용이 달라졌으면 `validation-stale`로 중단한다.

ready 행의 domain 변경은 하나의 SQLite transaction에서 처리한다.

예상치 못한 persistence 오류가 발생하면 domain 변경 전체를 rollback한다.

### Step 8. 결과

예:

```text
사업 Import 완료
전체 128건
성공 113건
중복 제외 9건
오류 제외 6건
```

행번호와 사유를 함께 표시한다.

## 6. 사업 Import 필드

### 필수

- `name` / 사업명

### 선택

- `project_code`
- `client_name`
- `project_type`
- `region`
- `contract_type`
- `estimated_cost`
- `current_stage`
- `priority`
- `assignee`
- `expected_bid_date`
- `description`
- `memo`
- `url`

### 기본값

- current_stage 없음 → `interest`
- priority 없음 → `normal`
- archived → 항상 `false`

Import된 사업은 기존 `create_project`와 동일한 domain 의미를 사용해야 하며 최초 단계 Timeline 이력도 `project-create` source로 1건 생성한다. Import 구현이 이 규칙을 우회하는 direct SQL path를 만들면 안 된다.

## 7. 일정 Import 필드

### 필수

- `title`
- `start_at` 또는 날짜 field

### 선택

- `project_code`
- `project_name`
- `client_name`
- `category`
- `description`
- `end_at`
- `deadline_at`
- `all_day`
- `status`
- `priority`
- `assignee`
- `location`
- `url`
- `memo`
- `is_pinned`

### 기본값

- category 없음 → `other` / 기타
- status 없음 → `planned`
- priority 없음 → `normal`
- all_day 없음 → `false`
- is_pinned 없음 → `false`

## 8. Header alias

Header는 trim, lower-case, 공백/특수문자 정규화 후 alias dictionary와 비교한다.

### 사업 예시

- 사업명, 공사명, 프로젝트명 → `name`
- 사업코드, 공사코드, 프로젝트코드 → `project_code`
- 발주처, 발주기관, 기관명 → `client_name`
- 공사비, 사업비, 예정금액, 추정공사비 → `estimated_cost`
- 발주예정일, 입찰예정일, 예정일 → `expected_bid_date`
- 진행상황, 진행단계, 현재단계, 단계 → `current_stage`
- 담당자, 담당 → `assignee`

### 일정 예시

- 일정명, 업무명, 일정, 제목 → `title`
- 일자, 날짜, 시작일, 일정일 → `start_at`
- 마감일, 제출일, deadline → `deadline_at`
- 사업명, 공사명 → `project_name`
- 사업코드, 공사코드 → `project_code`
- 일정분류, 카테고리, 구분 → `category`
- 담당자, 담당 → `assignee`

Alias는 Rust constant로 관리하고 UI에는 추천 mapping만 전달한다.

## 9. 값 정규화

### 문자열

- 앞뒤 공백 제거
- nullable field의 빈 문자열 → `NULL`
- 사업명/일정명 빈 값 → invalid

### 날짜

우선 지원:

- Excel serial date
- `YYYY-MM-DD`
- `YYYY.MM.DD`
- `YYYY/MM/DD`
- 명시적 날짜+시간 문자열

`03/04/26`처럼 의미가 모호한 날짜는 추정하지 않고 invalid 처리한다.

### 금액

다음 형태를 원 단위 integer로 정규화한다.

- 숫자 cell
- `320000000000`
- `320,000,000,000`
- `3,200억원`
- `3.2조원`

해석 불가 → invalid.

### Boolean

허용:

- true / false
- Y / N
- 예 / 아니오
- 1 / 0

### 사업단계

기존 17개 Project Stage의 key 또는 한국어 name만 허용한다.

알 수 없는 값은 새 단계로 생성하지 않고 invalid 처리한다.

## 10. 발주처 연결

사업 Import의 `client_name` 처리:

1. trim된 이름 exact match 검색
2. 동일 이름 Client 1건 → 연결
3. 0건 → 새 Client 생성 후보
4. 2건 이상 → ambiguous invalid

현재 Client name은 unique가 아니므로 fuzzy match로 임의 연결하지 않는다.

새 Client는 name만 채우고 나머지는 NULL로 둔다.

같은 Import batch 안에서 동일한 새 발주처명이 반복되면 Client를 한 번만 생성하고 이후 행은 그 Client를 재사용한다.

## 11. 사업 중복 탐지

우선순위:

1. project_code 존재 + 동일 code 존재 → `duplicate`
2. project_code 없음 + `(사업명 + 발주처명)` exact match → `duplicate`
3. 발주처 없음 + 사업명 exact match → `duplicate`로 분류하되 message에 `possible duplicate: 발주처 정보 없음` 기록

V1에서는 세 경우 모두 기본 skip 대상이다.

기존 사업을 자동 update하지 않는다.

## 12. 일정 중복 탐지

기본 fingerprint:

- project_id 또는 project snapshot
- title
- start_at
- deadline_at

동일 fingerprint → duplicate.

사업 미연결 일정은 title + start_at + deadline_at 기준으로 비교한다.

## 13. 일정-사업 연결

우선순위:

1. project_code exact match
2. project_name exact match가 정확히 1건
3. 연결 실패 시 미연결 일정으로 Import 가능

project_name exact match가 여러 건이면 자동 연결하지 않고 warning을 남긴다.

연결 성공 시 기존 Quick Event와 동일하게 projectId와 사업명/발주처 snapshot을 저장한다.

## 14. SQLite migration v4

### `import_batches`

- id TEXT PRIMARY KEY
- dataset TEXT NOT NULL (`projects` / `events`)
- source_file_name TEXT NOT NULL
- sheet_name TEXT NOT NULL
- status TEXT NOT NULL (`started` / `completed` / `failed`)
- total_rows INTEGER NOT NULL DEFAULT 0
- imported_rows INTEGER NOT NULL DEFAULT 0
- duplicate_rows INTEGER NOT NULL DEFAULT 0
- invalid_rows INTEGER NOT NULL DEFAULT 0
- skipped_rows INTEGER NOT NULL DEFAULT 0
- error_message TEXT NULL
- started_at TEXT NOT NULL
- completed_at TEXT NULL

원본 전체 path는 영구 저장하지 않는다.

### `import_rows`

- id TEXT PRIMARY KEY
- batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE
- source_row_number INTEGER NOT NULL
- status TEXT NOT NULL (`imported` / `duplicate` / `invalid` / `skipped`)
- target_id TEXT NULL
- source_key TEXT NULL
- message TEXT NULL
- created_at TEXT NOT NULL

Raw Excel row 전체 JSON은 저장하지 않는다.

## 15. Transaction / Audit

1. Import commit 직전에 `import_batches`에 `started` batch를 기록한다.
2. domain transaction을 시작한다.
3. ready Project/Event/필요 Client를 저장한다.
4. 성공한 경우 같은 transaction에서 `import_rows` 결과와 batch `completed` summary를 기록한다.
5. transaction commit한다.
6. 예상치 못한 오류면 domain/audit row 변경을 rollback하고, transaction 밖에서 해당 batch만 `failed` + error_message로 업데이트한다.

따라서 domain 데이터가 부분적으로 남지 않는다.

Project Import는 기존 Project 생성 semantics를 재사용해 최초 stage history를 함께 생성한다.

Event Import는 기존 Event 저장 semantics를 재사용한다.

## 16. Preview / Validation DTO

### WorkbookSummary

- fileName
- sheets[]: name, rowCount, columnCount

### ImportMapping

- dataset
- headerRow
- fieldToColumn map

### PreviewRow

- rowNumber
- sourceValues
- normalizedValues
- status
- issues[]

### ValidationSummary

- totalRows
- readyRows
- duplicateRows
- invalidRows
- skippedRows
- rows[]
- validationToken

`validationToken`은 최소한 다음 canonical 값으로 만든 digest다.

- file size
- file modified time
- selected sheet
- dataset
- header row
- canonical mapping
- validated row digest

Import commit은 파일을 재검증하고 token이 달라지면 `validation-stale`로 중단한다.

## 17. Tauri command

- `excel_workbook_inspect(path)`
- `excel_import_preview(path, sheet, dataset, mapping?)`
- `excel_import_validate(path, sheet, dataset, mapping)`
- `excel_import_commit(path, sheet, dataset, mapping, validation_token, options)`
- `excel_export_projects(path, filter?)`
- `excel_export_events(path, filter?)`

React는 path/mapping/options만 전달하며 SQL을 직접 알지 않는다.

## 18. Frontend 구조

```text
src/features/excel/
  ExcelImportWizard.tsx
  ExcelImportWizard.test.tsx
  ExcelExportDialog.tsx
  ExcelExportDialog.test.tsx
  excelMapping.ts
  excelMapping.test.ts
  excelTypes.ts

src/repositories/
  ExcelTransferRepository.ts
  tauriExcelTransferRepository.ts
  memoryExcelTransferRepository.ts
```

Wizard state:

- select-file
- select-sheet-and-dataset
- map-columns
- preview
- validate
- confirm
- result

파일을 다시 선택하면 downstream state는 초기화한다.

## 19. UI 진입점

최소 진입점:

- 사업관리 toolbar: `Excel 가져오기`, `Excel 내보내기`
- 일정 목록 화면이 아직 완성되지 않았으므로 공통 Excel Import Wizard에서 `사업/일정` dataset을 선택할 수 있게 한다.
- 일정 전용 목록 화면이 생기면 동일 Wizard/Export dialog를 재사용한다.

## 20. Export

### 사업 sheet `사업`

- 사업코드
- 사업명
- 발주처
- 공사유형
- 지역
- 계약방식
- 공사비(원)
- 현재단계
- 중요도
- 담당자
- 입찰예정일
- 사업개요
- 메모
- URL
- 보관여부
- 생성일
- 수정일

### 일정 sheet `일정`

- 일정명
- 사업코드
- 사업명
- 발주처
- 분류
- 시작일시
- 종료일시
- 마감일시
- 종일
- 상태
- 중요도
- 담당자
- 위치
- 메모
- URL
- 중요일정
- 완료일시
- 생성일
- 수정일

### formatting

- bold header
- autofilter
- top row freeze
- 적절한 column width
- 날짜/금액 cell format

과도한 스타일은 넣지 않는다.

## 21. Error handling

내부 Rust/SQL error를 사용자에게 그대로 노출하지 않는다.

에러 code:

- unsupported-file
- cannot-open-file
- workbook-corrupt
- sheet-not-found
- header-not-found
- mapping-invalid
- row-validation-error
- validation-stale
- database-error
- cannot-write-file

UI는 한국어 사용자 메시지를 기본으로 하고 필요 시 기술 detail을 접어서 보여준다.

## 22. Security / Safety

- macro 실행 금지
- formula 실행/재계산 금지
- 원본 파일 수정 금지
- Export는 save dialog에서 사용자가 선택한 새 path에만 작성
- audit DB에 원본 전체 path/raw row 전체 저장 금지
- dialog cancel은 정상 취소 처리

## 23. 성능

V1 목표:

- Preview UI 전달 최대 50행
- 전체 validation backend 처리
- 5,000행 수준 파일에서 React UI가 workbook binary 때문에 freeze되지 않음
- React state에 전체 workbook binary 저장 금지

초대형 streaming 최적화는 V1 범위 밖이다.

## 24. 테스트

### Rust

- migration v4 idempotency
- workbook sheet inspection
- header detection / alias mapping
- Excel date normalization
- amount parsing (`원`, `억원`, `조원`)
- stage/priority/status/category normalization
- project/event duplicate detection
- client exact-link/create/ambiguous rules
- Project Import 최초 stage history 생성
- Event Import project snapshot 연결
- transaction rollback
- audit completed/failed 처리
- export workbook 생성 후 재-read 검증
- import 원본 hash/mtime 미변경 검증

### TypeScript/Vitest

- Wizard step transition
- dialog cancel
- sheet/dataset selection
- required mapping guard
- preview
- duplicate/invalid summary
- confirm/result
- export cancel
- repository command contract

### Regression

- 기존 frontend 전체 test
- production build
- Windows `cargo test --manifest-path src-tauri/Cargo.toml`
- Windows `cargo check --manifest-path src-tauri/Cargo.toml`

## 25. 완료 기준

1. 사업 `.xlsx`를 preview → mapping → validate → import 가능
2. 일정 `.xlsx`를 같은 Wizard로 import 가능
3. 필수값/날짜/금액/단계 오류를 행번호와 함께 표시
4. duplicate 자동 overwrite 없음
5. ready 행만 Import 가능
6. DB 오류 시 domain 전체 rollback
7. batch/row audit 기록
8. Import 사업의 최초 Timeline stage history 생성
9. 사업/일정 `.xlsx` Export 후 재-read 값 보존 자동테스트
10. 원본 Excel 변경 없음
11. 기존 Calendar/Today/Project/Client/Timeline 회귀 없음
12. Frontend test/build 및 Windows Rust test/check 모두 GREEN

## 26. 구현 순서

1. Dependencies + dialog plugin wiring
2. Migration v4 import audit schema
3. Workbook inspection/read service
4. Header mapping + normalization pure logic
5. Project validation/duplicate/client rules
6. Event validation/duplicate/project-link rules
7. Import transaction + audit
8. Project/Event export writer
9. Tauri commands + TypeScript repository adapters
10. React Import Wizard
11. Export UI
12. README + final regression
