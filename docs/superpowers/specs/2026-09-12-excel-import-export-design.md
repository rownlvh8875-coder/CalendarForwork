# CalendarForwork Excel Import / Export 설계명세

- 작성일: 2026-09-12
- 대상 브랜치: `feat/excel-import-export`
- 기준 브랜치: `feat/project-client-master`
- 상태: Design Approved → Written Spec Review

## 1. 목적

CalendarForwork V1에 기존 Excel 기반 토목영업 자료를 안전하게 가져오고, 현재 앱 데이터를 다시 Excel로 내보내는 기능을 추가한다.

핵심 목표는 다음과 같다.

1. 기존 사업/일정 Excel을 재입력하지 않고 재사용한다.
2. Excel 컬럼명이 앱 내부 필드명과 달라도 자동 추론 + 사용자 수정이 가능해야 한다.
3. Import 전에 반드시 미리보기, 검증, 중복확인을 거친다.
4. 중복 후보를 자동 덮어쓰지 않는다.
5. 정상 행만 선택적으로 Import할 수 있다.
6. Import 실행 결과를 SQLite에 기록해 성공/실패/중복 건수를 추적할 수 있게 한다.
7. Export는 원본 파일을 수정하지 않고 새 `.xlsx` 파일을 생성한다.
8. Excel 처리 책임은 React UI가 아니라 Rust/Tauri backend에 둔다.

## 2. 범위

### 포함

- 사업(Project) Excel Import
- 일정(Event) Excel Import
- 사업 Excel Export
- 일정 Excel Export
- Native 파일 열기/저장 Dialog
- Workbook sheet 목록 조회
- Sheet 선택
- 데이터셋 유형 선택: `projects` 또는 `events`
- 자동 헤더/컬럼 매핑
- 사용자 수동 매핑 수정
- Preview 최대 50행
- 전체 행 validation
- 중복 후보 탐지
- 오류 행 제외 후 정상 행만 Import
- Import transaction
- Import batch/row 결과 기록
- 결과 요약

### 제외

- 발주처(Client) 전용 Excel Import Wizard
- 여러 파일 동시 Import
- 하나의 파일에서 사업/일정을 동시에 Import
- Excel 원본 수정/덮어쓰기
- 외부 링크/매크로 실행
- 서식/차트/이미지 Import
- 셀 수식의 재계산 엔진 구현
- 양방향 Excel 동기화
- 자동 정기 Import

발주처는 사업 Import 과정에서 이름 기준으로 연결하거나 필요 시 생성하는 보조 Entity로 취급한다.

## 3. 기술 구조

### 3.1 책임 분리

```text
React Excel Wizard
  ↓
Excel Application Service / Repository
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

React는 Excel binary parsing을 직접 하지 않는다.

### 3.2 라이브러리 방향

- Import reader: `calamine`
- Export writer: `rust_xlsxwriter`
- Native open/save dialog: `@tauri-apps/plugin-dialog` / `tauri-plugin-dialog`
- Persistence: 기존 `rusqlite` 유지

구체 버전은 구현 시 현재 Tauri/Rust toolchain과 호환되는 최신 안정 버전으로 고정한다.

Tauri v2 dialog plugin은 desktop에서 open/save system dialog를 제공하므로 파일 선택 UI에 사용한다.

## 4. 지원 파일 포맷

### Import

V1에서 reader가 안정적으로 해석할 수 있는 Excel/OpenDocument 계열 파일을 허용한다.

- `.xlsx`
- `.xls`
- `.xlsm`
- `.xlsb`
- `.ods`

파일 선택 Dialog에는 위 확장자만 노출한다.

### Export

- `.xlsx`만 생성

Export에서 `.xls`, `.xlsm`, `.xlsb`, `.ods`는 생성하지 않는다.

## 5. Import Wizard 흐름

### Step 1. 파일 선택

사용자가 `Excel 가져오기`를 누른다.

Native open dialog에서 한 개 파일만 선택한다.

선택 취소 시 아무 변경도 하지 않는다.

### Step 2. Workbook 확인

Rust backend가 workbook을 열고 다음 메타데이터를 반환한다.

- 파일명
- sheet 목록
- 각 sheet의 대략적인 사용 행/열 수

사용자는 대상 sheet를 하나 선택한다.

### Step 3. 데이터 유형 선택

- 사업 가져오기
- 일정 가져오기

한 Import session은 한 유형만 처리한다.

### Step 4. 헤더 탐지 및 컬럼 매핑

기본적으로 첫 번째 의미 있는 행을 header 후보로 사용한다.

자동 매핑은 정규화된 header alias dictionary로 수행한다.

사용자는 자동 매핑 결과를 직접 변경할 수 있다.

하나의 Excel 컬럼은 한 개의 앱 필드에만 매핑할 수 있다.

필수 필드가 매핑되지 않으면 다음 단계로 진행할 수 없다.

### Step 5. Preview

최대 50행을 테이블로 표시한다.

표시 항목:

- 원본 행번호
- 주요 값
- 정규화 결과
- validation 상태
- 중복 후보 여부

Preview는 전체 파일 Import 결과가 아니라 UX 확인용 표본이다.

전체 validation은 별도 backend command에서 수행한다.

### Step 6. 전체 검증 및 중복확인

모든 대상 행을 읽어 아래 상태 중 하나로 분류한다.

- `ready`
- `duplicate`
- `invalid`
- `skipped`

중복 후보를 자동 update/overwrite하지 않는다.

사용자는 V1에서 다음 중 하나만 선택한다.

- 중복 행 건너뛰기
- 해당 Import 취소

V1에서는 기존 레코드 overwrite/update Import를 구현하지 않는다.

### Step 7. Import 확정

사용자가 최종 확인을 누르면 Rust backend가 파일을 다시 읽고 mapping/validation을 다시 적용한다.

검증 결과가 preview/validate 시점과 달라진 경우 Import를 중단하고 재검증을 요구한다.

정상 행은 하나의 SQLite transaction 안에서 저장한다.

중간 오류가 발생하면 domain data 변경을 rollback한다.

Import audit 기록은 실패 사실을 남길 수 있도록 domain transaction 결과와 명확히 분리한다.

### Step 8. 결과 보고

예:

```text
사업 Import 완료
전체 128건
성공 113건
중복 제외 9건
오류 제외 6건
```

오류/중복 행은 행번호와 이유를 표시한다.

## 6. 사업 Import 필드

### 필수

- `name` / 사업명

### 선택

- `project_code` / 사업코드
- `client_name` / 발주처
- `project_type` / 공사유형
- `region` / 지역
- `contract_type` / 계약방식
- `estimated_cost` / 공사비
- `current_stage` / 현재단계
- `priority` / 중요도
- `assignee` / 담당자
- `expected_bid_date` / 입찰예정일
- `description` / 사업개요
- `memo` / 메모
- `url` / URL

### 기본값

- current_stage 미지정 → `interest`
- priority 미지정 → `normal`
- archived → 항상 `false`

## 7. 일정 Import 필드

### 필수

- `title` / 일정명
- `start_at` 또는 날짜 필드

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

- category 미지정 → `other` / 기타
- status 미지정 → `planned`
- priority 미지정 → `normal`
- all_day 미지정 → `false`
- is_pinned 미지정 → `false`

## 8. Header alias 규칙

자동 매핑을 위해 header를 trim, lower-case, 공백/특수문자 정규화 후 alias dictionary와 비교한다.

예시:

### 사업

- 사업명, 공사명, 프로젝트명 → `name`
- 사업코드, 공사코드, 프로젝트코드 → `project_code`
- 발주처, 발주기관, 기관명 → `client_name`
- 공사비, 사업비, 예정금액, 추정공사비 → `estimated_cost`
- 발주예정일, 입찰예정일, 예정일 → `expected_bid_date`
- 진행상황, 진행단계, 현재단계, 단계 → `current_stage`
- 담당자, 담당 → `assignee`

### 일정

- 일정명, 업무명, 일정, 제목 → `title`
- 일자, 날짜, 시작일, 일정일 → `start_at`
- 마감일, 제출일, deadline → `deadline_at`
- 사업명, 공사명 → `project_name`
- 사업코드, 공사코드 → `project_code`
- 일정분류, 카테고리, 구분 → `category`
- 담당자, 담당 → `assignee`

Alias는 Rust domain constant로 관리하고 UI에 추천 mapping 결과만 전달한다.

## 9. 값 정규화 규칙

### 문자열

- leading/trailing whitespace 제거
- 빈 문자열은 nullable field에서 `NULL`
- 사업명/일정명은 빈 값 허용 안 함

### 날짜

다음 형태를 우선 지원한다.

- Excel serial date
- `YYYY-MM-DD`
- `YYYY.MM.DD`
- `YYYY/MM/DD`
- 날짜+시간 문자열

모호한 `03/04/26` 같은 형식은 자동 추정하지 않고 invalid 처리한다.

날짜만 있는 일정은 all-day 여부와 별개로 로컬 기준 날짜를 유지한다.

### 금액

다음 입력을 정수 원 단위로 정규화한다.

- 숫자 cell
- `320000000000`
- `320,000,000,000`
- `3,200억원`
- `3.2조원`

통화/단위를 해석할 수 없으면 invalid 처리한다.

### Boolean

허용 예:

- true/false
- Y/N
- 예/아니오
- 1/0

### 단계

17개 Project Stage key/name을 허용한다.

한국어 단계명과 내부 key 모두 인식한다.

알 수 없는 값은 자동 생성하지 않고 invalid 처리한다.

## 10. 발주처 연결 규칙

사업 Import에서 `client_name`이 있을 경우:

1. trim된 발주처명 exact match를 먼저 찾는다.
2. 동일 이름 Client가 1건이면 연결한다.
3. 없으면 새 Client 생성 후보로 처리한다.
4. 중복 이름 Client가 여러 건이면 ambiguous invalid 처리한다.

현재 schema에서 client name은 unique가 아니므로 fuzzy match로 임의 연결하지 않는다.

새 Client 생성 시 이름만 필수로 넣고 나머지 필드는 NULL로 둔다.

## 11. 사업 중복 탐지

우선순위:

1. `project_code`가 있고 기존 동일 project_code 존재 → duplicate
2. project_code가 없으면 정규화된 `(사업명 + 발주처명)` exact match → duplicate
3. 발주처가 없으면 사업명 exact match만으로 자동 duplicate 확정하지 않고 `possible_duplicate` 경고로 분류할 수 있다.

V1 Import 실행에서는 duplicate/possible_duplicate 행 모두 기본적으로 skip한다.

자동 update는 하지 않는다.

## 12. 일정 중복 탐지

기본 fingerprint:

- project_id 또는 project snapshot
- title
- start_at
- deadline_at

동일 fingerprint가 있으면 duplicate 처리한다.

project가 연결되지 않은 일정은 title + start_at + deadline_at 기준으로 비교한다.

## 13. 사업/일정 연결 규칙

일정 Import에서 사업 연결 우선순위:

1. project_code exact match
2. project_name exact match가 정확히 1건
3. 아니면 미연결 일정으로 Import 가능

project_name exact match가 여러 건이면 ambiguous warning을 표시하고 자동 연결하지 않는다.

연결 성공 시 기존 Quick Event와 동일하게 projectId 및 사업명/발주처 snapshot을 저장한다.

## 14. Import audit schema

SQLite migration v4에서 아래 테이블을 추가한다.

### `import_batches`

- `id TEXT PRIMARY KEY`
- `dataset TEXT NOT NULL` (`projects` / `events`)
- `source_file_name TEXT NOT NULL`
- `sheet_name TEXT NOT NULL`
- `status TEXT NOT NULL` (`started` / `completed` / `failed`)
- `total_rows INTEGER NOT NULL DEFAULT 0`
- `imported_rows INTEGER NOT NULL DEFAULT 0`
- `duplicate_rows INTEGER NOT NULL DEFAULT 0`
- `invalid_rows INTEGER NOT NULL DEFAULT 0`
- `skipped_rows INTEGER NOT NULL DEFAULT 0`
- `error_message TEXT NULL`
- `started_at TEXT NOT NULL`
- `completed_at TEXT NULL`

원본 전체 경로는 audit table에 영구 저장하지 않는다. 파일명만 기록한다.

### `import_rows`

- `id TEXT PRIMARY KEY`
- `batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE`
- `source_row_number INTEGER NOT NULL`
- `status TEXT NOT NULL` (`imported` / `duplicate` / `invalid` / `skipped`)
- `target_id TEXT NULL`
- `source_key TEXT NULL`
- `message TEXT NULL`
- `created_at TEXT NOT NULL`

raw Excel row 전체 JSON은 저장하지 않는다.

## 15. Transaction 규칙

### Domain import transaction

Import confirm 시 정상 행에 대한 Project/Event/필요 Client 생성을 하나의 transaction으로 처리한다.

어느 정상 행에서라도 예상치 못한 persistence 오류가 발생하면 domain 변경 전체를 rollback한다.

### Audit 기록

- batch `started` 기록
- domain transaction 시도
- 성공 시 batch/result rows 기록 후 `completed`
- 실패 시 rollback 후 batch를 `failed`로 업데이트

Audit 때문에 실패한 domain 데이터가 부분적으로 남으면 안 된다.

## 16. Preview / Validate DTO

### WorkbookSummary

- fileName
- sheets[]
  - name
  - rowCount
  - columnCount

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

`validationToken`은 file metadata + sheet + mapping + validation 결과를 식별한다.

Import confirm command는 token과 동일 조건을 재검증하고 불일치하면 실행하지 않는다.

## 17. Tauri command 경계

예상 command:

- `excel_workbook_inspect(path)`
- `excel_import_preview(path, sheet, dataset, mapping?)`
- `excel_import_validate(path, sheet, dataset, mapping)`
- `excel_import_commit(path, sheet, dataset, mapping, validation_token, options)`
- `excel_export_projects(path, filter?)`
- `excel_export_events(path, filter?)`

React는 path와 mapping/options만 전달하고 row persistence SQL을 직접 알지 않는다.

## 18. Frontend 구조

예상 구성:

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
  memoryExcelTransferRepository.ts (Vitest/UI demo only)
```

### Wizard state

- select-file
- select-sheet-and-dataset
- map-columns
- preview
- validate
- confirm
- result

뒤로 이동 시 이전 state를 유지한다.

파일을 다시 고르면 downstream state를 초기화한다.

## 19. UI 진입점

V1에서는 사업관리와 일정 화면의 toolbar에 Excel action을 배치할 수 있도록 공통 action을 만든다.

최소 진입점:

- 사업관리: `Excel 가져오기`, `Excel 내보내기`
- 일정: 일정 목록 화면이 아직 완성되지 않았으므로 우선 Global/사업관리 쪽 Excel 메뉴에서 데이터셋을 선택할 수 있게 한다.

일정 목록 화면이 생기면 동일 Wizard를 재사용한다.

## 20. Export 설계

### 사업 Export sheet

Sheet name: `사업`

기본 컬럼:

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

### 일정 Export sheet

Sheet name: `일정`

기본 컬럼:

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

### XLSX formatting

- 첫 행 bold header
- autofilter
- freeze top row
- 합리적인 기본 column width
- 날짜/금액 cell format 적용

과도한 디자인 서식은 넣지 않는다.

## 21. Error handling

사용자에게 raw Rust/SQL error를 그대로 노출하지 않는다.

에러 분류:

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

UI는 한국어 사용자 메시지 + 필요 시 기술 detail 접기 영역으로 표현한다.

## 22. Security / Safety

- Excel macro를 실행하지 않는다.
- Formula cell은 reader가 제공하는 cached/result 값을 사용할 수 있지만 앱에서 formula 계산이나 실행을 하지 않는다.
- 원본 파일을 수정하지 않는다.
- Export는 사용자가 save dialog에서 선택한 새 경로에만 작성한다.
- Audit DB에는 원본 전체 경로와 raw row 전체를 저장하지 않는다.
- 파일 cancel은 정상 취소로 처리하며 error toast를 띄우지 않는다.

## 23. 성능 기준

V1 목표:

- Preview는 최대 50행만 UI로 전달
- 전체 validation은 backend에서 수행
- 5,000행 수준의 사업/일정 파일을 UI freeze 없이 처리
- React state에 전체 workbook binary를 보관하지 않음

초대형 Excel streaming 최적화는 V1 범위 밖이다.

## 24. 테스트 전략

### Rust unit/integration

- migration v4 idempotency
- workbook sheet inspection
- header detection
- alias mapping
- Excel date normalization
- amount parsing (`원`, `억원`, `조원`)
- stage/priority/status/category normalization
- duplicate detection
- client link/create rules
- project/event import transaction rollback
- audit success/failure rows
- export workbook 생성 및 재-read 검증
- import 원본 미변경 검증

### TypeScript/Vitest

- Wizard step transition
- file cancel
- sheet/dataset selection
- mapping required field guard
- preview state
- duplicate/invalid summary
- confirm/result
- export save cancel
- repository command contract

### Regression

- 기존 frontend 전체 test
- production build
- Windows `cargo test --manifest-path src-tauri/Cargo.toml`
- Windows `cargo check --manifest-path src-tauri/Cargo.toml`

## 25. 합격 기준

다음을 모두 만족해야 Excel V1을 완료로 본다.

1. 사업 `.xlsx` 샘플을 preview → mapping → validate → import할 수 있다.
2. 일정 `.xlsx` 샘플을 동일 Wizard로 import할 수 있다.
3. 필수값 누락/날짜/금액/단계 오류가 행번호와 함께 표시된다.
4. duplicate는 자동 overwrite되지 않는다.
5. 정상 행만 Import할 수 있다.
6. Import 중 DB 오류 시 domain 변경이 rollback된다.
7. 결과 batch/row audit가 남는다.
8. 사업/일정 Export `.xlsx`를 생성하고 다시 열어 값이 보존됨을 자동테스트한다.
9. 원본 Excel 파일은 변경되지 않는다.
10. 기존 Calendar/Today/Project/Client/Timeline 기능 회귀가 없다.
11. Frontend test/build와 Windows Rust test/check가 모두 GREEN이다.

## 26. 구현 순서

1. Dependencies + dialog plugin wiring
2. Migration v4 import audit schema
3. Excel workbook inspection/read service
4. Header mapping + value normalization pure logic
5. Project import validation/duplicate rules
6. Event import validation/duplicate rules
7. Import transaction + audit
8. Project/Event export writer
9. Tauri commands + TypeScript repository adapters
10. React Import Wizard
11. Export UI
12. README + final regression
