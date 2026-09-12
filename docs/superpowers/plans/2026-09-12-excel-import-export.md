# Excel Import / Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CalendarForwork에 안전한 사업/일정 Excel Import Wizard와 `.xlsx` Export 기능을 추가한다.

**Architecture:** React는 native file dialog와 wizard 상태만 관리하고, workbook parsing/normalization/validation/duplicate detection/import transaction/export writing은 Rust/Tauri backend가 담당한다. 기존 Project/Event 저장 semantics를 재사용해 Timeline과 snapshot 규칙을 우회하지 않는다.

**Tech Stack:** React 19, TypeScript 7, Tauri 2.11, SQLite/rusqlite 0.40, calamine, rust_xlsxwriter, Tauri dialog plugin, Vitest, Rust tests.

**Spec:** `docs/superpowers/specs/2026-09-12-excel-import-export-design.md`

## Global Constraints

- Import 파일: `.xlsx`, `.xls`, `.xlsm`, `.xlsb`, `.ods`; Export는 `.xlsx`만.
- 원본 workbook을 수정하지 않는다.
- 기존 Project/Event를 자동 overwrite/update하지 않는다.
- Import row 상태는 `ready | duplicate | invalid | skipped` 네 종류만 사용한다.
- 사업 Import는 기존 Project 생성 semantics와 `project-create` Timeline 이력을 보존한다.
- Event Import는 기존 project snapshot 저장 의미를 보존한다.
- Domain 변경은 하나의 SQLite transaction으로 commit/rollback한다.
- Audit에는 원본 전체 path와 raw row 전체 JSON을 저장하지 않는다.
- Preview는 최대 50행만 UI로 전달한다.

---

### Task 1: Excel runtime dependencies and dialog wiring

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `package.json`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Test: `src-tauri/src/commands_contract_tests.rs`

**Produces:** Tauri dialog plugin registration and Excel crates available to later tasks.

- [ ] Add a failing command/plugin contract test that requires dialog plugin initialization and future `commands::excel` module registration.
- [ ] Run Windows Rust tests and confirm RED is caused by missing Excel/dialog wiring.
- [ ] Add `calamine`, `rust_xlsxwriter`, `tauri-plugin-dialog`, and JS `@tauri-apps/plugin-dialog`; register `.plugin(tauri_plugin_dialog::init())`.
- [ ] Add dialog capability permission required by Tauri v2.
- [ ] Run frontend build, Rust tests, and `cargo check` until GREEN.
- [ ] Commit as `build: add Excel transfer dependencies`.

### Task 2: SQLite migration v4 import audit

**Files:**
- Modify: `src-tauri/src/persistence/schema.rs`
- Create: `src-tauri/src/persistence/import_audit.rs`
- Modify: `src-tauri/src/persistence/mod.rs`

**Produces:** `import_batches`, `import_rows`, and persistence helpers for start/complete/fail audit lifecycle.

- [ ] Write RED tests for schema version 4, both audit tables, status constraints, FK cascade, and idempotent migration.
- [ ] Implement `MIGRATION_4` with indexes on batch/status and row/batch.
- [ ] Add audit record DTOs and helpers `start_import_batch`, `complete_import_batch`, `fail_import_batch`.
- [ ] Test that failed batch records can be written after a domain transaction rollback.
- [ ] Run Rust tests and `cargo check` GREEN.
- [ ] Commit as `feat: add import audit persistence`.

### Task 3: Workbook inspection and preview reader

**Files:**
- Create: `src-tauri/src/excel/mod.rs`
- Create: `src-tauri/src/excel/types.rs`
- Create: `src-tauri/src/excel/workbook.rs`
- Create: `src-tauri/src/excel/workbook_tests.rs`

**Produces:** `inspect_workbook(path) -> WorkbookSummary` and `read_sheet_rows(path, sheet, limit)` pure backend APIs.

- [ ] Create deterministic test workbooks in temp directories.
- [ ] RED-test sheet names, row/column counts, first meaningful header row, 50-row preview cap, unsupported extension, missing sheet, and corrupt workbook error classification.
- [ ] Implement reader via `calamine::open_workbook_auto` and convert cells to non-executing scalar display values.
- [ ] Verify formulas are never executed and source file metadata is read without modification.
- [ ] Run Rust tests GREEN.
- [ ] Commit as `feat: inspect Excel workbooks`.

### Task 4: Header mapping and scalar normalization

**Files:**
- Create: `src-tauri/src/excel/mapping.rs`
- Create: `src-tauri/src/excel/normalize.rs`
- Create: `src-tauri/src/excel/mapping_tests.rs`
- Create: `src-tauri/src/excel/normalize_tests.rs`

**Produces:** alias mapping, date/amount/bool/stage/priority/status/category normalization.

- [ ] RED-test Korean header aliases and one-column-to-one-field constraint.
- [ ] RED-test Excel serial dates, `YYYY-MM-DD`, dots/slashes, explicit datetime, and rejection of ambiguous `03/04/26`.
- [ ] RED-test amount parsing for raw numbers, comma-separated won, `억원`, and `조원`.
- [ ] RED-test boolean aliases and 17 project stage key/name mapping.
- [ ] Implement pure normalization functions with structured issue codes.
- [ ] Run Rust unit tests GREEN.
- [ ] Commit as `feat: normalize Excel import values`.

### Task 5: Project import validation, duplicates, clients, transaction

**Files:**
- Create: `src-tauri/src/excel/projects.rs`
- Create: `src-tauri/src/excel/projects_tests.rs`
- Modify: `src-tauri/src/persistence/projects.rs`
- Modify: `src-tauri/src/persistence/clients.rs`

**Produces:** project preview/validation and atomic project import using existing project semantics.

- [ ] RED-test required project name, defaults, invalid stage/amount/date, project-code duplicate, `(name + client)` duplicate, possible duplicate without client, ambiguous client names, and same-batch client reuse.
- [ ] Add transaction-aware internal Project/Client create helpers so Import does not duplicate business rules or create nested transactions.
- [ ] RED-test that imported Project creates exactly one `project-create` stage-history record.
- [ ] Implement project validation and commit path inside one transaction.
- [ ] RED-test forced persistence failure rolls back Projects, Clients, Timeline history, and imported row audit while batch becomes failed afterward.
- [ ] Run Rust tests GREEN.
- [ ] Commit as `feat: import projects from Excel`.

### Task 6: Event import validation, project link, duplicates

**Files:**
- Create: `src-tauri/src/excel/events.rs`
- Create: `src-tauri/src/excel/events_tests.rs`
- Modify: `src-tauri/src/persistence/events.rs`

**Produces:** event preview/validation and atomic Event import preserving project snapshot behavior.

- [ ] RED-test title/start required fields, defaults, category/status/priority normalization, exact project-code link, unique project-name link, ambiguous name fallback, and unlinked import.
- [ ] RED-test duplicate fingerprint with project identity/title/start/deadline.
- [ ] Add transaction-aware internal Event creation helper matching existing Event persistence fields.
- [ ] RED-test linked Event stores `project_id`, `project_name`, and `client_name` snapshot.
- [ ] Implement event import and rollback behavior.
- [ ] Run Rust tests GREEN.
- [ ] Commit as `feat: import events from Excel`.

### Task 7: XLSX project/event export

**Files:**
- Create: `src-tauri/src/excel/export.rs`
- Create: `src-tauri/src/excel/export_tests.rs`

**Produces:** `export_projects_xlsx(path, rows)` and `export_events_xlsx(path, rows)`.

- [ ] RED-test workbook creation, sheet names `사업`/`일정`, exact header order, numeric amount cells, date values, freeze row, autofilter, and source DB unchanged.
- [ ] Implement writer with `rust_xlsxwriter` using modest header formatting and practical column widths.
- [ ] Re-open produced workbook with `calamine` in tests and assert exported values round-trip.
- [ ] RED-test invalid/unwritable output path classification.
- [ ] Run Rust tests GREEN.
- [ ] Commit as `feat: export CalendarForwork data to xlsx`.

### Task 8: Tauri commands and TypeScript repository adapter

**Files:**
- Create: `src-tauri/src/commands/excel.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands_contract_tests.rs`
- Create: `src/features/excel/excelTypes.ts`
- Create: `src/repositories/ExcelTransferRepository.ts`
- Create: `src/repositories/tauriExcelTransferRepository.ts`
- Create: `src/repositories/tauriExcelTransferRepository.test.ts`
- Create: `src/repositories/memoryExcelTransferRepository.ts`
- Create: `src/repositories/runtimeExcelTransferRepository.ts`

**Produces:** stable frontend interface for inspect/preview/validate/commit/export operations.

- [ ] RED-test Tauri command names and camelCase DTO mapping.
- [ ] Register commands: inspect, preview, validate, commit, export projects, export events.
- [ ] Implement Tauri adapter using `invoke()` only; file dialog remains a separate UI concern.
- [ ] Implement small deterministic Memory adapter for browser/Vitest demo.
- [ ] Run focused Vitest, all Vitest, build, Rust tests/check GREEN.
- [ ] Commit as `feat: expose Excel transfer commands`.

### Task 9: React Excel Import Wizard and Export UI

**Files:**
- Create: `src/features/excel/ExcelImportWizard.tsx`
- Create: `src/features/excel/ExcelImportWizard.test.tsx`
- Create: `src/features/excel/ExcelExportDialog.tsx`
- Create: `src/features/excel/ExcelExportDialog.test.tsx`
- Create: `src/styles/excel.css`
- Modify: `src/main.tsx`
- Modify: `src/features/projects/ProjectsPage.tsx`
- Modify: `src/features/projects/ProjectsPage.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Produces:** user-facing import wizard and export actions.

- [ ] RED-test file cancel, sheet/dataset selection, mapping guard, preview, validation summary, duplicate/invalid exclusion, confirm/result, backward navigation, and new-file reset.
- [ ] Implement native `open()` file picker with import extension filter and no error on cancel.
- [ ] Implement wizard states `select-file → select-sheet-and-dataset → map-columns → preview → validate → confirm → result`.
- [ ] Render max 50 preview rows with row-level issue labels; do not load workbook binary into React.
- [ ] Add `Excel 가져오기` and `Excel 내보내기` to Project toolbar; Global path permits events dataset until Events list screen exists.
- [ ] RED-test `save()` cancel and project/event export choice; implement `.xlsx` save dialog.
- [ ] Run all frontend tests/build GREEN.
- [ ] Commit as `feat: add Excel import export UI`.

### Task 10: Documentation and final verification

**Files:**
- Modify: `README.md`
- Review: all files changed against `feat/project-client-master`

**Produces:** release-ready Excel V1 branch.

- [ ] Update README with supported import formats, `.xlsx` export, safety rules, audit, and limitations.
- [ ] Run `npm test -- --run`; require all tests pass.
- [ ] Run `npm run build`; require success.
- [ ] Run Windows `cargo test --manifest-path src-tauri/Cargo.toml`; require success.
- [ ] Run Windows `cargo check --manifest-path src-tauri/Cargo.toml`; require success.
- [ ] Compare branch against `feat/project-client-master`; verify no unrelated refactors.
- [ ] Confirm original source workbook hashes are unchanged in import integration tests.
- [ ] Commit as `docs: finalize Excel import export`.
