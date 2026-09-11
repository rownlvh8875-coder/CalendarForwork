# Project Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사업 단계 변경 이력과 해당 사업에 연결된 일정을 하나의 사업별 Timeline으로 보여준다.

**Architecture:** SQLite schema v3에 `project_stage_history`를 추가하고, Project create/replace가 단계 이력을 같은 transaction에서 기록하도록 한다. Timeline read model은 단계이력과 `project_id`로 조회한 CalendarEvent를 TypeScript에서 합성하며, 실제 Tauri는 SQLite/IPC를 사용하고 Browser/Vitest는 동일 의미의 Memory 구현을 사용한다.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Tauri v2, Rust, rusqlite(SQLite bundled), GitHub Actions Windows CI

**Spec:** `docs/superpowers/specs/2026-09-11-project-timeline-design.md`

## Global Constraints

- 기준 브랜치는 `feat/project-client-master`, 구현 브랜치는 `feat/project-timeline`이다.
- 기존 사업의 과거 단계 이력을 추정하지 않는다. migration v3는 현재 단계 baseline 1건만 생성한다.
- `projects.current_stage` 변경과 history insert는 반드시 동일 SQLite transaction 안에서 수행한다.
- 같은 단계로 project를 다시 저장하면 history를 추가하지 않는다.
- 사업 보관/발주처 삭제는 stage history를 삭제하지 않는다.
- Timeline V1은 세로형 compact feed이며 Gantt, 전체 17단계 progress bar, drag/drop은 포함하지 않는다.
- 실제 Tauri와 Browser Memory의 단계이력 의미가 같아야 한다.
- 기존 Calendar/Today/Project/Client 동작과 테스트를 깨뜨리지 않는다.

---

### Task 1: SQLite migration v3와 baseline history

**Files:**
- Modify: `src-tauri/src/persistence/schema.rs`
- Create: `src-tauri/src/persistence/timeline_types.rs`
- Create: `src-tauri/src/persistence/timeline.rs`
- Modify: `src-tauri/src/persistence/mod.rs`

**Interfaces:**
- Produces Rust type:

```rust
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStageHistoryRecord {
    pub id: String,
    pub project_id: String,
    pub from_stage: Option<String>,
    pub to_stage: String,
    pub changed_at: String,
    pub source: String,
    pub note: Option<String>,
    pub created_at: String,
}
```

- Produces DB method:

```rust
pub fn list_project_stage_history(
    &self,
    project_id: &str,
) -> PersistenceResult<Vec<ProjectStageHistoryRecord>>
```

- [ ] **Step 1: Write migration RED tests**

Extend `schema.rs` tests so a migrated database must report schema version 3, table `project_stage_history`, the project/changed_at index, and one baseline row for each pre-v3 project. Build a pre-v3 fixture explicitly: run migrations 1/2 equivalent, insert a project with `current_stage = 'pq'`, then run `migrate()` and assert:

```rust
assert_eq!(version, 3);
assert_eq!(history_count, 1);
assert_eq!(history_id, format!("baseline:{project_id}"));
assert_eq!(from_stage, None);
assert_eq!(to_stage, "pq");
assert_eq!(source, "migration-baseline");
```

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml persistence::schema::tests::migration_v3
```

Expected: FAIL because migration v3/table do not exist.

- [ ] **Step 2: Add migration v3**

Add SQL equivalent to:

```sql
CREATE TABLE IF NOT EXISTS project_stage_history (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_stage TEXT NULL REFERENCES project_stages(key),
  to_stage TEXT NOT NULL REFERENCES project_stages(key),
  changed_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('project-create','project-edit','migration-baseline')),
  note TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_stage_history_project
ON project_stage_history(project_id, changed_at DESC);

INSERT OR IGNORE INTO project_stage_history(
  id, project_id, from_stage, to_stage, changed_at, source, note, created_at
)
SELECT
  'baseline:' || id,
  id,
  NULL,
  current_stage,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  'migration-baseline',
  NULL,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM projects;
```

Record schema version 3 only after this SQL succeeds.

- [ ] **Step 3: Add history query and mapping**

Create `timeline.rs` with a stable SELECT sorted newest first:

```sql
SELECT id, project_id, from_stage, to_stage, changed_at, source, note, created_at
FROM project_stage_history
WHERE project_id = ?1
ORDER BY changed_at DESC, created_at DESC, id DESC
```

- [ ] **Step 4: Verify migration idempotency and query**

Run migration twice and assert baseline stays 1 row. Call `list_project_stage_history(project_id)` and assert camelCase-serializable record values match the baseline.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml persistence::schema persistence::timeline
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/persistence
 git commit -m "feat: add project timeline migration"
```

---

### Task 2: Transactional project stage history writes

**Files:**
- Modify: `src-tauri/src/persistence/projects.rs`
- Modify tests in the same file

**Interfaces:**
- `Database::create_project(input)` still returns `ProjectRecord`.
- `Database::replace_project(id, input)` still returns `ProjectRecord`.
- Side effect: stage history is written transactionally.

- [ ] **Step 1: Write create/history RED test**

After `create_project()` assert one history row:

```rust
let history = db.list_project_stage_history(&created.id).unwrap();
assert_eq!(history.len(), 1);
assert_eq!(history[0].from_stage, None);
assert_eq!(history[0].to_stage, "planned-order");
assert_eq!(history[0].source, "project-create");
```

Expected: FAIL because create does not write history.

- [ ] **Step 2: Implement transactional create**

Inside the existing database lock, open a transaction. Insert project and one `project-create` row using the same timestamp string for `projects.created_at`, `projects.updated_at`, `history.changed_at`, and `history.created_at`. Commit only after both inserts succeed.

Use a UUID for normal history IDs; deterministic `baseline:<id>` remains migration-only.

- [ ] **Step 3: Write stage-change RED tests**

Test both cases:

```rust
// same stage
replace_project(id, same_stage_input);
assert_eq!(history.len(), 1);

// changed stage
replace_project(id, changed_to_pq);
assert_eq!(history.len(), 2);
assert_eq!(history[0].from_stage, Some("planned-order".into()));
assert_eq!(history[0].to_stage, "pq");
assert_eq!(history[0].source, "project-edit");
```

Expected: FAIL because replace does not write history.

- [ ] **Step 4: Implement transactional replace**

Read the current project within the same transaction before UPDATE. If missing, return `QueryReturnedNoRows`. Compare old `current_stage` to the incoming stage. Always update the project; insert history only when they differ. Use one timestamp for project `updated_at` and history `changed_at/created_at`.

- [ ] **Step 5: Verify rollback behavior**

Use an invalid `to_stage` input and assert project `current_stage` remains unchanged and no additional history row appears.

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml persistence::projects
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/persistence/projects.rs
 git commit -m "feat: record project stage changes"
```

---

### Task 3: Project event query and Tauri Timeline commands

**Files:**
- Modify: `src-tauri/src/persistence/events.rs`
- Modify: `src-tauri/src/commands/events.rs`
- Create: `src-tauri/src/commands/timeline.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands_contract_tests.rs`

**Interfaces:**

```rust
pub fn list_events_by_project(
    &self,
    project_id: &str,
) -> PersistenceResult<Vec<EventRecord>>
```

Tauri commands:

```text
events_list_by_project
project_stage_history_list
```

- [ ] **Step 1: Write event-query RED test**

Create two events linked to `project-a`, one to `project-b`, plus one unlinked event. Assert `list_events_by_project("project-a")` returns exactly two rows sorted by `start_at ASC, created_at ASC, id ASC`.

Expected: FAIL because method is missing.

- [ ] **Step 2: Implement project event query**

Add parameterized SQL:

```sql
... FROM events
WHERE project_id = ?1
ORDER BY start_at ASC, created_at ASC, id ASC
```

- [ ] **Step 3: Extend command-contract RED test**

Require references to both new command entrypoints in the single `tauri::generate_handler![...]` list.

Expected: FAIL until commands are registered.

- [ ] **Step 4: Implement thin command adapters**

`events_list_by_project` delegates once to `Database::list_events_by_project`; `project_stage_history_list` delegates once to `Database::list_project_stage_history`. Convert persistence errors to String only at IPC boundary.

- [ ] **Step 5: Register commands and verify Rust suite**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands src-tauri/src/lib.rs src-tauri/src/persistence/events.rs src-tauri/src/commands_contract_tests.rs
 git commit -m "feat: expose project timeline commands"
```

---

### Task 4: TypeScript repositories and Browser Memory parity

**Files:**
- Create: `src/domain/timeline.ts`
- Create: `src/repositories/ProjectTimelineRepository.ts`
- Create: `src/repositories/tauriProjectTimelineRepository.ts`
- Create: `src/repositories/tauriProjectTimelineRepository.test.ts`
- Modify: `src/repositories/EventRepository.ts`
- Modify: `src/repositories/tauriEventRepository.ts`
- Modify: `src/repositories/tauriEventRepository.test.ts`
- Modify: `src/repositories/memoryEventRepository.ts`
- Modify: `src/repositories/memoryMasterState.ts`
- Modify: `src/repositories/memoryProjectRepository.ts`
- Create: `src/repositories/memoryProjectTimelineRepository.ts`
- Modify: `src/repositories/runtimeMasterRepositories.ts`
- Modify tests for runtime repositories
- Modify: `src/data/masterSampleData.ts`

**Interfaces:**

```ts
export type StageHistorySource = 'project-create' | 'project-edit' | 'migration-baseline';

export interface ProjectStageHistory {
  id: string;
  projectId: string;
  fromStage?: string | null;
  toStage: string;
  changedAt: string;
  source: StageHistorySource;
  note?: string | null;
  createdAt: string;
}

export interface ProjectTimelineRepository {
  listStageHistory(projectId: string): Promise<ProjectStageHistory[]>;
}
```

Extend:

```ts
interface EventRepository {
  listByProject(projectId: string): Promise<CalendarEvent[]>;
}
```

Extend runtime master factory return:

```ts
{
  clients: ClientRepository;
  projects: ProjectRepository;
  timeline: ProjectTimelineRepository;
}
```

- [ ] **Step 1: Write Tauri adapter RED tests**

Assert exact IPC calls:

```ts
await timeline.listStageHistory('project-a');
expect(invokeFn).toHaveBeenCalledWith('project_stage_history_list', { projectId: 'project-a' });

await events.listByProject('project-a');
expect(invokeFn).toHaveBeenCalledWith('events_list_by_project', { projectId: 'project-a' });
```

Expected: FAIL because methods/adapters are missing.

- [ ] **Step 2: Implement Tauri adapters and interfaces**

Add only the new methods; preserve existing command names and update semantics.

- [ ] **Step 3: Write Memory history RED tests**

Browser mode must assert:
- demo project has at least one `project-create` history;
- project create adds exactly one history;
- same-stage update adds none;
- stage-changing update adds exactly one `project-edit` history;
- archive does not remove history;
- `events.listByProject` returns only matching project IDs.

Expected: FAIL until Memory parity is implemented.

- [ ] **Step 4: Extend shared Memory state**

Add `stageHistory: ProjectStageHistory[]`. `createMemoryProjectRepository(state)` writes history into that shared array. `createMemoryProjectTimelineRepository(state)` returns defensive copies sorted newest first.

Use ISO timestamps from `new Date().toISOString()`; tests compare source/stages/count rather than exact clock values.

- [ ] **Step 5: Update runtime selection and demo data**

Tauri mode returns the Tauri timeline adapter. Browser mode returns the Memory timeline repository over the same shared state. Add one explicit fictional `project-create` history row for each demo project; no fake historical stage sequence.

- [ ] **Step 6: Verify frontend repository tests**

Run:

```bash
npm test -- --run src/repositories
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain src/repositories src/data/masterSampleData.ts
 git commit -m "feat: add project timeline repositories"
```

---

### Task 5: Timeline read-model composition

**Files:**
- Create: `src/features/projects/projectTimelineModel.ts`
- Create: `src/features/projects/projectTimelineModel.test.ts`

**Interfaces:**

```ts
export type ProjectTimelineItem =
  | {
      kind: 'stage';
      id: string;
      at: string;
      history: ProjectStageHistory;
    }
  | {
      kind: 'event';
      id: string;
      at: string;
      event: CalendarEvent;
    };

export function buildProjectTimeline(
  history: ProjectStageHistory[],
  events: CalendarEvent[],
): ProjectTimelineItem[];
```

- [ ] **Step 1: Write ordering RED tests**

Use fixed history/events around `2026-09-11`. Timeline must be one deterministic feed sorted by `at DESC`, then `kind` and `id` as stable tie-breakers. For event `at`, use `deadlineAt ?? startAt` so a submission deadline is positioned by its actionable due time.

Expected: FAIL because model does not exist.

- [ ] **Step 2: Implement pure composition function**

Map history and events without mutating inputs. Stage item `at = changedAt`; event item `at = deadlineAt ?? startAt`.

- [ ] **Step 3: Add display helpers**

Export pure helpers:

```ts
formatStageTransition(history, stageMap): {
  eyebrow: string;
  title: string;
}

formatTimelineDday(at: string, now: Date): string | null
```

Rules:
- migration baseline → eyebrow `현재단계 기준선`, title = target stage name
- project-create → eyebrow `사업 시작`, title = target stage name
- project-edit → eyebrow `단계변경`, title = `이전단계 → 새단계`
- future event day difference 0 → `D-DAY`; positive → `D-N`; past → null

- [ ] **Step 4: Verify pure-model tests**

Run:

```bash
npm test -- --run src/features/projects/projectTimelineModel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/projectTimelineModel*
 git commit -m "feat: compose project timeline feed"
```

---

### Task 6: Project detail Timeline tab UI

**Files:**
- Modify: `src/features/projects/ProjectDetailPanel.tsx`
- Create: `src/features/projects/ProjectTimelineTab.tsx`
- Create: `src/features/projects/ProjectTimelineTab.test.tsx`
- Modify: `src/features/projects/ProjectsPage.tsx`
- Modify: `src/features/projects/ProjectsPage.test.tsx`
- Modify: `src/styles/masters.css`

**Interfaces:**

`ProjectDetailPanel` receives:

```ts
projectTimelineRepository: ProjectTimelineRepository;
eventRepository: EventRepository;
now?: Date;
```

`ProjectTimelineTab` receives:

```ts
project: Project;
stages: ProjectStage[];
timelineRepository: ProjectTimelineRepository;
eventRepository: EventRepository;
now: Date;
```

- [ ] **Step 1: Write Timeline tab RED test**

Render a project detail with Memory repositories. Click `Timeline`. Assert:
- `현재단계 기준선` or `사업 시작` row is visible;
- a project-linked event is visible;
- event category + title are present;
- future deadline displays D-Day label;
- loading error shows `Timeline을 불러오지 못했습니다.` without breaking the Overview tab.

Expected: FAIL because tab does not exist.

- [ ] **Step 2: Add Overview/Timeline tab controls**

Default remains `개요`. The existing project metadata remains untouched under Overview. Timeline data is loaded only after Timeline is selected.

- [ ] **Step 3: Implement Timeline async loading**

Use one `Promise.all`:

```ts
const [history, events] = await Promise.all([
  timelineRepository.listStageHistory(project.id),
  eventRepository.listByProject(project.id),
]);
```

Ignore stale results after unmount/project change with a cancellation boolean.

- [ ] **Step 4: Implement compact vertical feed**

Each row contains semantic marker, eyebrow, title, timestamp. Event rows also show category and optional D-Day. Empty state text:

```text
아직 기록된 Timeline 항목이 없습니다.
```

Do not add Gantt/progress bar.

- [ ] **Step 5: Wire ProjectsPage**

Pass the runtime timeline/event repositories into the detail panel. Preserve row selection, editor, archive and filters.

- [ ] **Step 6: Verify UI tests/build**

Run:

```bash
npm test -- --run src/features/projects
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/projects src/styles/masters.css
 git commit -m "feat: add project timeline workspace"
```

---

### Task 7: App wiring, documentation and final regression

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx` only if wiring behavior needs explicit coverage
- Modify: `README.md`

**Interfaces:**
- `App` constructs Event + Master + Timeline repositories once with `useMemo` and passes them into `ProjectsPage`.

- [ ] **Step 1: Wire repositories through App**

Reuse existing runtime selection. Do not instantiate repositories per render.

- [ ] **Step 2: Add integration regression**

Navigate to 사업관리, open a demo project, open Timeline, assert one stage item and one linked event appear. Keep existing Calendar/Today/Client tests unchanged.

- [ ] **Step 3: Update README**

Document:
- SQLite schema v3;
- stage history sources;
- baseline semantics;
- Timeline tab;
- project-linked event query;
- exclusions (no manual history editing/Gantt yet).

- [ ] **Step 4: Run complete frontend verification**

```bash
npm test -- --run
npm run build
git diff --check feat/project-client-master...HEAD
```

Expected: all frontend tests PASS, production build PASS, diff check has no output.

- [ ] **Step 5: Run complete Windows verification through GitHub Actions**

Required CI steps:

```text
Generate Tauri icons
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: both frontend and desktop jobs success.

- [ ] **Step 6: Regression checklist**

Verify the following through tests or direct code-path inspection where already covered:

```text
Existing project receives only one migration baseline row
New project receives one project-create row
Same-stage edit adds no row
Stage change adds exactly one project-edit row
Failed stage change rolls back project and history
Archived project retains history
Client deletion retains project/history
listByProject excludes unlinked/other-project events
Overview tab remains default
Timeline tab merges stage history and project events
Quick event project linking still works
Calendar/Today/Client/Project existing tests stay green
Browser demo remains non-persistent and fictional
Tauri remains SQLite-backed
```

- [ ] **Step 7: Commit documentation/wiring**

```bash
git add src/app README.md
 git commit -m "docs: document project timeline"
```

## Completion Criteria

This feature is complete only when:

1. Migration v3 is idempotent and creates exactly one baseline per existing project.
2. Project create/stage-change history is transactionally consistent with `projects.current_stage`.
3. Same-stage saves do not create duplicate history.
4. Rust project-event/history queries and Tauri commands pass.
5. Tauri and Memory repository semantics match.
6. Timeline composition tests are deterministic.
7. Project detail Overview remains the default tab and Timeline renders stage history + project events.
8. Existing frontend regression suite remains green.
9. Production frontend build passes.
10. Windows `cargo test` and `cargo check` pass.
11. `feat/project-client-master...feat/project-timeline` contains no Excel/notification/server/Gantt work.