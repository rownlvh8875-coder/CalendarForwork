# Project & Client Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CalendarForwork에 토목영업 사업 Master와 발주처 Master를 추가하고, 사업·발주처 정보를 SQLite에 영구 저장하며 일정 등록 시 실제 사업을 선택해 연결할 수 있게 한다.

**Architecture:** `ProjectRepository`와 `ClientRepository`를 `EventRepository`와 같은 방식으로 추상화한다. Tauri에서는 TypeScript adapter → invoke → Rust commands → rusqlite로 영구저장하고, 브라우저/Vitest에서는 Memory Repository와 가상 데이터를 사용한다. UI는 카드 남발을 피하고 compact table/list + 우측 detail panel + 빠른 편집 dialog를 기본 패턴으로 한다.

**Tech Stack:** React 19, TypeScript 7, Tauri 2.11, Rust, rusqlite 0.40.2, SQLite, Vitest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-09-10-calendar-for-work-design.md`

## Global Constraints

- 개인 Windows PC 로컬 모드가 현재 기준이다.
- 기존 `EventRepository`와 SQLite event 저장 기능을 깨뜨리지 않는다.
- 실제 Tauri 앱은 SQLite, 브라우저/Vitest는 Memory Repository를 사용한다.
- 실제 Tauri 빈 DB에는 데모 사업/발주처를 자동 삽입하지 않는다.
- DB table/column은 snake_case, TypeScript/IPC JSON은 camelCase를 사용한다.
- Project와 Event는 별도 Entity다.
- Project는 `client_id`로 Client를 참조한다.
- Client 삭제 시 Project의 `client_id`는 `NULL`로 만든다.
- Project는 기본적으로 물리 삭제보다 `archived` 상태를 사용한다.
- 공사비는 원화 정수 금액으로 저장하되 nullable을 허용한다.
- 입찰예정일은 `YYYY-MM-DD` date key로 저장한다.
- UI는 Google Calendar/Linear/Notion 계열의 정돈된 정보계층을 유지한다.
- 지나친 Card UI와 과도한 Border 사용을 피한다.
- 색상만으로 상태를 구분하지 않고 텍스트 badge를 함께 사용한다.
- 이번 계획에는 Excel Import/Export, 서버 동기화, 계정/권한, 알림, 첨부파일을 포함하지 않는다.

---

## File Structure

```text
src/
├─ domain/
│  ├─ clients.ts
│  └─ projects.ts
├─ data/
│  └─ masterSampleData.ts
├─ repositories/
│  ├─ ClientRepository.ts
│  ├─ ProjectRepository.ts
│  ├─ memoryClientRepository.ts
│  ├─ memoryProjectRepository.ts
│  ├─ tauriClientRepository.ts
│  ├─ tauriProjectRepository.ts
│  └─ runtimeMasterRepositories.ts
├─ features/
│  ├─ clients/
│  │  ├─ ClientsPage.tsx
│  │  ├─ ClientEditorDialog.tsx
│  │  └─ ClientsPage.test.tsx
│  └─ projects/
│     ├─ ProjectsPage.tsx
│     ├─ ProjectDetailPanel.tsx
│     ├─ ProjectEditorDialog.tsx
│     └─ ProjectsPage.test.tsx
├─ app/App.tsx
└─ styles/masters.css

src-tauri/src/
├─ persistence/
│  ├─ schema.rs
│  ├─ clients.rs
│  ├─ projects.rs
│  └─ master_types.rs
├─ commands/
│  ├─ clients.rs
│  ├─ projects.rs
│  └─ mod.rs
└─ lib.rs
```

---

### Task 1: SQLite migration v2 — clients, project stages, projects

**Files:**
- Modify: `src-tauri/src/persistence/schema.rs`

**Interfaces:**
- Schema migration version becomes `2`.
- Adds `project_stages`, `clients`, `projects`.
- Seeds the approved default project stages.

- [ ] **Step 1: Write failing migration-v2 test**

Add a Rust test that runs `migrate()` against an in-memory DB and asserts:

```rust
let version: i64 = connection.query_row(
    "SELECT MAX(version) FROM schema_migrations",
    [],
    |row| row.get(0),
).unwrap();
assert_eq!(version, 2);

for table in ["clients", "project_stages", "projects"] {
    let count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
        [table],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(count, 1, "missing table {table}");
}

let stage_count: i64 = connection.query_row(
    "SELECT COUNT(*) FROM project_stages",
    [],
    |row| row.get(0),
).unwrap();
assert_eq!(stage_count, 17);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml persistence::schema::tests
```

Expected: FAIL because schema version remains 1 and master tables do not exist.

- [ ] **Step 3: Implement migration 2**

Create tables in one migration transaction:

```sql
CREATE TABLE IF NOT EXISTS project_stages (
  key TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT NULL,
  department TEXT NULL,
  contact_name TEXT NULL,
  phone TEXT NULL,
  email TEXT NULL,
  memo TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  project_code TEXT NULL,
  name TEXT NOT NULL,
  client_id TEXT NULL REFERENCES clients(id) ON DELETE SET NULL,
  project_type TEXT NULL,
  region TEXT NULL,
  contract_type TEXT NULL,
  estimated_cost INTEGER NULL,
  current_stage TEXT NOT NULL DEFAULT 'interest' REFERENCES project_stages(key),
  priority TEXT NOT NULL DEFAULT 'normal',
  assignee TEXT NULL,
  expected_bid_date TEXT NULL,
  description TEXT NULL,
  memo TEXT NULL,
  url TEXT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_code
ON projects(project_code) WHERE project_code IS NOT NULL AND project_code <> '';
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(current_stage);
CREATE INDEX IF NOT EXISTS idx_projects_expected_bid_date ON projects(expected_bid_date);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
```

Seed exactly these stage keys/names/order:

```text
interest/관심사업
planning/계획
planned-order/발주예정
notice/입찰공고
pq/PQ
soq/SOQ
basic-design/기본설계
detailed-design/실시설계
design-review/설계심의
price-bid/가격입찰
opening/개찰
preferred-bidder/우선협상
won/수주
lost/탈락
hold/보류
closed/종료
cancelled/취소
```

Insert migration version 2 only after all DDL/seed work succeeds.

- [ ] **Step 4: Verify GREEN and migration idempotency**

Call `migrate()` twice in the test and assert version remains 2 and stage rows are not duplicated.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/persistence/schema.rs
git commit -m "feat: add project and client schema migration"
```

---

### Task 2: Rust Client persistence

**Files:**
- Create: `src-tauri/src/persistence/master_types.rs`
- Create: `src-tauri/src/persistence/clients.rs`
- Modify: `src-tauri/src/persistence/mod.rs`

**Interfaces:**

```rust
ClientRecord
NewClientRecord
Database::list_clients()
Database::get_client(id)
Database::create_client(input)
Database::replace_client(id, input)
Database::remove_client(id)
```

- [ ] **Step 1: Write failing Client CRUD tests**

Use in-memory DB and assert create → get → replace → list → remove. Include nullable department/contact/phone/email/memo fields and Korean text.

- [ ] **Step 2: Add Client DTOs**

Use `#[serde(rename_all = "camelCase")]` and keep `id`, `createdAt`, `updatedAt` as server-generated metadata.

- [ ] **Step 3: Implement parameterized Client SQL**

Order `list_clients()` by `name COLLATE NOCASE ASC, created_at ASC, id ASC`.

`replace_client()` preserves `created_at` and refreshes `updated_at`.

`remove_client()` physically deletes the client; `projects.client_id` must become NULL through FK `ON DELETE SET NULL`.

- [ ] **Step 4: Add FK behavior test**

Create client + project, delete client, assert project still exists and its `client_id` is NULL.

- [ ] **Step 5: Verify GREEN**

```bash
cargo test --manifest-path src-tauri/Cargo.toml persistence::clients
```

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/persistence/master_types.rs src-tauri/src/persistence/clients.rs src-tauri/src/persistence/mod.rs
git commit -m "feat: add client persistence"
```

---

### Task 3: Rust Project persistence

**Files:**
- Create: `src-tauri/src/persistence/projects.rs`
- Modify: `src-tauri/src/persistence/master_types.rs`
- Modify: `src-tauri/src/persistence/mod.rs`

**Interfaces:**

```rust
ProjectRecord
NewProjectRecord
ProjectStageRecord
Database::list_project_stages()
Database::list_projects(include_archived)
Database::get_project(id)
Database::create_project(input)
Database::replace_project(id, input)
Database::set_project_archived(id, archived)
```

`ProjectRecord` includes `client_name: Option<String>` from a LEFT JOIN so the UI does not need N+1 client lookups.

- [ ] **Step 1: Write failing Project persistence tests**

Test all nullable fields, cost, priority, stage, client join name and expected bid date.

- [ ] **Step 2: Verify RED**

Expected: Project DTOs and DB methods are missing.

- [ ] **Step 3: Implement Project queries**

Use a stable SELECT with LEFT JOIN `clients c ON c.id = p.client_id`.

Default list excludes archived records and sorts:

```text
archived ASC
expected_bid_date NULLS LAST equivalent
priority critical/high/normal/low
name
```

Implement SQLite ordering with `CASE` expressions; do not depend on unsupported `NULLS LAST` syntax.

- [ ] **Step 4: Validate stage FK and unique project code**

Tests must reject an unknown stage key and duplicate non-empty `project_code`.

- [ ] **Step 5: Verify archive behavior**

`set_project_archived(id, true)` removes it from default list but `list_projects(true)` still returns it.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/persistence/projects.rs src-tauri/src/persistence/master_types.rs src-tauri/src/persistence/mod.rs
git commit -m "feat: add project persistence"
```

---

### Task 4: Tauri Client/Project commands

**Files:**
- Create: `src-tauri/src/commands/clients.rs`
- Create: `src-tauri/src/commands/projects.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**

Client commands:

```text
clients_list
clients_get
clients_create
clients_replace
clients_remove
```

Project commands:

```text
project_stages_list
projects_list
projects_get
projects_create
projects_replace
projects_set_archived
```

- [ ] **Step 1: Write command-contract RED test**

Extend command contract tests so all entrypoints must exist.

- [ ] **Step 2: Implement thin command adapters**

Each Tauri command delegates exactly once to the Database API and converts the typed persistence error to String only at IPC boundary.

- [ ] **Step 3: Register commands**

Add all commands to the existing single `tauri::generate_handler![...]` call.

- [ ] **Step 4: Verify Rust suite**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands src-tauri/src/lib.rs src-tauri/src/commands_contract_tests.rs
git commit -m "feat: expose project and client commands"
```

---

### Task 5: TypeScript domain and repository adapters

**Files:**
- Create: `src/domain/clients.ts`
- Create: `src/domain/projects.ts`
- Create: `src/repositories/ClientRepository.ts`
- Create: `src/repositories/ProjectRepository.ts`
- Create: `src/repositories/tauriClientRepository.ts`
- Create: `src/repositories/tauriProjectRepository.ts`
- Create tests for both adapters

**Interfaces:**

```ts
export interface Client {
  id: string;
  name: string;
  category?: string | null;
  department?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  memo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewClient = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;
```

Project shape uses camelCase equivalents of all fields from the approved spec plus `clientName?: string | null` as a read model field.

- [ ] **Step 1: Write IPC adapter RED tests**

Assert exact command names and camelCase argument shapes.

- [ ] **Step 2: Implement Tauri adapters**

Follow the existing event adapter pattern. Partial update performs get → merge → strip metadata/read-only `clientName` → replace.

- [ ] **Step 3: Test missing-record errors**

Use `Client not found: <id>` and `Project not found: <id>` consistently.

- [ ] **Step 4: Verify frontend tests/build**

```bash
npm test -- --run
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/domain src/repositories
git commit -m "feat: add project and client repository adapters"
```

---

### Task 6: Browser Memory repositories and runtime selection

**Files:**
- Create: `src/data/masterSampleData.ts`
- Create: `src/repositories/memoryClientRepository.ts`
- Create: `src/repositories/memoryProjectRepository.ts`
- Create: `src/repositories/runtimeMasterRepositories.ts`
- Add tests

**Interfaces:**

```ts
createRuntimeMasterRepositories(now: Date, tauriRuntime?: boolean): {
  clients: ClientRepository;
  projects: ProjectRepository;
}
```

- [ ] **Step 1: Write runtime selector RED tests**

Browser override `false` returns deterministic demo data. Tauri override `true` constructs adapters without invoking commands during construction.

- [ ] **Step 2: Add realistic but explicitly fictional demo data**

Use generic labels such as `A철도 차량기지 건설공사`, `B항만 개발사업`, `공공 발주처 A`. Do not present demo rows as real projects.

- [ ] **Step 3: Implement Memory CRUD with defensive copies**

Client removal nulls matching project `clientId` in the shared demo state or, if repositories are separate closures, runtime factory owns the shared backing state and exposes both repositories over it.

- [ ] **Step 4: Verify tests**

```bash
npm test -- --run src/repositories
```

- [ ] **Step 5: Commit**

```bash
git add src/data/masterSampleData.ts src/repositories
git commit -m "feat: add runtime master repositories"
```

---

### Task 7: ProjectsPage — compact business-sales UI

**Files:**
- Create: `src/features/projects/ProjectsPage.tsx`
- Create: `src/features/projects/ProjectDetailPanel.tsx`
- Create: `src/features/projects/ProjectEditorDialog.tsx`
- Create: `src/features/projects/ProjectsPage.test.tsx`
- Create/Modify: `src/styles/masters.css`

**UI requirements:**
- Header summary: active project count, near bid count, high/critical priority count, total estimated cost where known.
- Compact toolbar: text search, stage filter, `+ 사업 등록`.
- Table columns: 상태, 사업명, 발주처, 공사유형/지역, 계약방식, 공사비, 담당자, 입찰예정일.
- Row height stays compact; avoid individual card per project.
- Priority/status use text badges and subtle accents, not color alone.
- Clicking a row opens right detail panel without leaving the list context.
- Empty state clearly distinguishes “no projects yet” from “filter result 0”.

- [ ] **Step 1: Write ProjectsPage RED tests**

Test that rows display project, client, formatted KRW cost and stage. Test local search and stage filter. Test row click opens detail panel. Test add dialog creates a new project and refreshes list.

- [ ] **Step 2: Implement read-only compact table first**

Use semantic table markup with sticky header inside page scroll area.

- [ ] **Step 3: Implement detail panel**

Show: project code, stage, client, project type, region, contract type, cost, priority, assignee, expected bid date, description, memo, URL, timestamps.

- [ ] **Step 4: Implement editor dialog**

Required: 사업명, 현재단계, 중요도.
Optional: 사업코드, 발주처, 공사유형, 지역, 계약방식, 공사비, 담당자, 입찰예정일, 설명, 메모, URL.

Numeric cost input is normalized to an integer or null before repository call.

- [ ] **Step 5: Implement archive action**

Detail panel offers `보관` instead of destructive delete. Archived rows are hidden from default view.

- [ ] **Step 6: Verify responsive density**

At width near the app minimum `1100px`, lower-priority columns may wrap or hide according to CSS, but project name, stage, client and expected bid date remain visible.

- [ ] **Step 7: Commit**

```bash
git add src/features/projects src/styles/masters.css
git commit -m "feat: add project master workspace"
```

---

### Task 8: ClientsPage — compact 발주처 Master UI

**Files:**
- Create: `src/features/clients/ClientsPage.tsx`
- Create: `src/features/clients/ClientEditorDialog.tsx`
- Create: `src/features/clients/ClientsPage.test.tsx`
- Modify: `src/styles/masters.css`

**UI requirements:**
- Search field + category filter + `+ 발주처 등록`.
- Compact list/table columns: 발주처명, 구분, 부서, 담당자, 연락처, 이메일.
- Selecting a row opens edit/details without losing list context.
- Client removal requires confirmation because linked Projects will retain but lose the client relation.

- [ ] **Step 1: Write RED tests**

Test list, filtering, add/edit and delete confirmation behavior.

- [ ] **Step 2: Implement list and editor dialog**

Keep category as free text/select-friendly string in V1; do not hard-code an exhaustive public-agency taxonomy yet.

- [ ] **Step 3: Implement delete warning copy**

Use factual wording: `이 발주처를 삭제하면 연결된 사업의 발주처 연결이 해제됩니다. 사업과 일정 자체는 삭제되지 않습니다.`

- [ ] **Step 4: Verify tests**

```bash
npm test -- --run src/features/clients
```

- [ ] **Step 5: Commit**

```bash
git add src/features/clients src/styles/masters.css
git commit -m "feat: add client master workspace"
```

---

### Task 9: App integration and project-linked quick event creation

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/features/events/QuickEventDialog.tsx`
- Modify/Add tests
- Modify: `src/main.tsx` to import `masters.css` if needed

**Behavior:**
- Sidebar `사업관리` renders `ProjectsPage`.
- Sidebar `발주처` renders `ClientsPage`.
- App constructs master repositories once with the same runtime mode as EventRepository.
- Quick event form loads active projects.
- Selecting a project writes `projectId`, `projectName`, and its `clientName` snapshot into the event.
- User can still create an event without a project.

- [ ] **Step 1: Write App integration RED tests**

Navigate to 사업관리 and 발주처 and assert actual pages replace placeholders.

- [ ] **Step 2: Write QuickEventDialog project-link RED test**

Select a project and assert created event payload includes the exact project ID/name/clientName.

- [ ] **Step 3: Implement App wiring**

Do not instantiate repositories on every render; use `useMemo`.

- [ ] **Step 4: Implement project selector**

Use a compact searchable/select control compatible with keyboard navigation. If the project list is empty, show `등록된 사업 없음` and keep project optional.

- [ ] **Step 5: Run full frontend suite/build**

```bash
npm test -- --run
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app src/features/events src/main.tsx
git commit -m "feat: connect project and client masters to the app"
```

---

### Task 10: Final CI, documentation, and regression verification

**Files:**
- Modify: `README.md`
- Modify CI only if a missing project/client test gate is discovered; do not add redundant jobs.

- [ ] **Step 1: Update README**

Document Project/Client Master, schema migration version 2, project archive semantics and event-project linking.

- [ ] **Step 2: Run full frontend verification**

```bash
npm test -- --run
npm run build
```

Expected: all tests PASS and production build PASS.

- [ ] **Step 3: Run full Windows Rust verification through CI**

Required steps remain:

```text
Generate Tauri icons
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 4: Regression checklist**

Verify automatically or manually where applicable:

```text
Calendar month navigation still works
Quick event without project still works
Quick event with project persists project link
Today dashboard still loads
Project CRUD persists after DB reopen
Client CRUD persists after DB reopen
Deleting client does not delete project
Archiving project hides it from active list
Browser demo mode remains non-persistent
Tauri runtime remains SQLite-backed
```

- [ ] **Step 5: Self-review main diff**

Confirm changes are limited to Project/Client Master and necessary integration; no Excel/notification/server features are mixed in.

- [ ] **Step 6: Commit documentation**

```bash
git add README.md
git commit -m "docs: document project and client masters"
```

## Completion Criteria

This feature is complete only when:

1. Schema migration 2 passes and is idempotent.
2. Client/Project Rust persistence tests pass.
3. Tauri command contract compiles and passes.
4. TypeScript repository adapter tests pass.
5. ProjectsPage and ClientsPage UI tests pass.
6. Existing calendar/today/event tests remain green.
7. `npm run build` passes.
8. Windows `cargo test` and `cargo check` pass.
9. `main...feat/project-client-master` review shows no unrelated subsystem changes.
