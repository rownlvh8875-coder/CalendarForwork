# SQLite Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CalendarForwork의 일정 데이터를 Windows 사용자 로컬 SQLite 파일에 저장하여 앱을 종료하고 다시 실행해도 일정 생성·수정·완료·삭제 상태가 유지되도록 한다.

**Architecture:** React는 기존 `EventRepository` 인터페이스만 사용한다. Tauri 실행환경에서는 `TauriEventRepository`가 `@tauri-apps/api/core.invoke()`로 Rust command를 호출하고, Rust persistence 계층이 `rusqlite`를 통해 앱 데이터 디렉터리의 `calendarforwork.sqlite3`를 관리한다. 브라우저 개발/테스트 환경은 기존 Memory Repository를 유지하여 UI 테스트가 네이티브 런타임에 종속되지 않게 한다.

**Tech Stack:** React 19, TypeScript 7, Tauri 2.11, `@tauri-apps/api` 2.11.1, Rust, `rusqlite` 0.40.2 (`bundled`), serde 1.0, serde_json 1.0, uuid 1.x, tempfile 3.25 (tests), SQLite

**Spec:** `docs/superpowers/specs/2026-09-10-calendar-for-work-design.md`

## Global Constraints

- 개인 Windows PC 로컬 저장이 V1의 기준이다.
- UI는 SQLite 또는 Rust 구현을 직접 참조하지 않고 `EventRepository`를 통해서만 데이터에 접근한다.
- SQLite 파일 자체에 대용량 첨부파일 BLOB을 저장하지 않는다.
- `deadline_at`과 `start_at`/`end_at`은 분리 저장한다.
- 기존 `CalendarEvent`의 선택적 필드도 손실 없이 round-trip 되어야 한다.
- SQLite 실제 테이블은 snake_case, IPC JSON은 기존 TypeScript와 맞춰 camelCase를 사용한다.
- 앱 데이터베이스 파일은 Tauri `app_data_dir()/calendarforwork.sqlite3`에 둔다.
- DB가 비어 있는 실제 Tauri 앱에는 데모 일정을 자동 삽입하지 않는다.
- 브라우저 `npm run dev`와 Vitest에서는 기존 예시 Memory Repository를 계속 사용한다.
- 이번 계획에는 Project/Client Master, Excel Import/Export, 알림, 첨부파일, 검색, 백업을 포함하지 않는다.

---

## File Structure

```text
CalendarForwork/
├─ package.json
├─ src/
│  ├─ app/App.tsx
│  └─ repositories/
│     ├─ EventRepository.ts
│     ├─ memoryEventRepository.ts
│     ├─ runtimeEventRepository.ts
│     ├─ runtimeEventRepository.test.ts
│     ├─ tauriEventRepository.ts
│     └─ tauriEventRepository.test.ts
├─ src-tauri/
│  ├─ Cargo.toml
│  └─ src/
│     ├─ lib.rs
│     ├─ commands/
│     │  ├─ mod.rs
│     │  └─ events.rs
│     └─ persistence/
│        ├─ mod.rs
│        ├─ schema.rs
│        ├─ types.rs
│        └─ events.rs
└─ docs/superpowers/plans/2026-09-10-sqlite-persistence.md
```

### Task 1: SQLite database bootstrap and migration

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/persistence/mod.rs`
- Create: `src-tauri/src/persistence/schema.rs`

**Interfaces:**
- Produces: `pub struct Database { connection: Mutex<rusqlite::Connection> }`
- Produces: `Database::open(path: impl AsRef<Path>) -> Result<Database, PersistenceError>`
- Produces: `Database::open_in_memory() -> Result<Database, PersistenceError>` for tests.
- Produces schema version 1 containing the `events` table and indexes.

- [ ] **Step 1: Add persistence dependencies**

Update `src-tauri/Cargo.toml` dependencies to include:

```toml
[dependencies]
tauri = { version = "2.11.5", features = [] }
rusqlite = { version = "0.40.2", features = ["bundled"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
uuid = { version = "1", features = ["v4"] }
thiserror = "2"

[dev-dependencies]
tempfile = "3.25"
```

`bundled` is required so the Windows app does not depend on a separately installed SQLite DLL.

- [ ] **Step 2: Write the failing migration test**

In `src-tauri/src/persistence/schema.rs` add a test first:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn migration_creates_events_table_and_version() {
        let connection = Connection::open_in_memory().unwrap();
        migrate(&connection).unwrap();

        let version: i64 = connection
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);

        let table_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='events'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 1);
    }
}
```

- [ ] **Step 3: Run the Rust test and verify RED**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml persistence::schema::tests::migration_creates_events_table_and_version
```

Expected: FAIL because `migrate` and persistence module do not exist yet.

- [ ] **Step 4: Implement schema version 1**

`schema.rs` must create this schema in one transaction:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NULL,
  project_name TEXT NULL,
  client_name TEXT NULL,
  category_id TEXT NOT NULL,
  category_key TEXT NOT NULL,
  category_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NULL,
  deadline_at TEXT NULL,
  all_day INTEGER NOT NULL CHECK (all_day IN (0, 1)),
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  assignee TEXT NULL,
  location TEXT NULL,
  url TEXT NULL,
  memo TEXT NULL,
  is_pinned INTEGER NOT NULL CHECK (is_pinned IN (0, 1)),
  completed_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_deadline_at ON events(deadline_at);
CREATE INDEX IF NOT EXISTS idx_events_project_id ON events(project_id);
```

After successful creation insert migration version 1 with `INSERT OR IGNORE`.

- [ ] **Step 5: Implement `Database`**

`persistence/mod.rs` exposes a mutex-protected connection and enables SQLite safety pragmas on open:

```rust
connection.execute_batch(
    "PRAGMA foreign_keys = ON;\nPRAGMA journal_mode = WAL;\nPRAGMA synchronous = NORMAL;",
)?;
schema::migrate(&connection)?;
```

For `open_in_memory()`, skip `journal_mode = WAL` but still enable foreign keys and run migrations.

- [ ] **Step 6: Run persistence tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml persistence::
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/persistence
git commit -m "feat: add SQLite database bootstrap and migration"
```

### Task 2: Rust event persistence CRUD and restart durability

**Files:**
- Create: `src-tauri/src/persistence/types.rs`
- Create: `src-tauri/src/persistence/events.rs`
- Modify: `src-tauri/src/persistence/mod.rs`

**Interfaces:**
- Produces `EventRecord` and `NewEventRecord` with `#[serde(rename_all = "camelCase")]`.
- Produces `Database::list_events_between(start_iso, end_iso)`.
- Produces `Database::list_upcoming(from_iso, days)`.
- Produces `Database::get_event(id)`.
- Produces `Database::create_event(input)`.
- Produces `Database::replace_event(id, input)`.
- Produces `Database::remove_event(id)`.

- [ ] **Step 1: Define serializable Rust DTOs**

`types.rs` mirrors TypeScript field names exactly:

```rust
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NewEventRecord {
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub client_name: Option<String>,
    pub category_id: String,
    pub category_key: String,
    pub category_name: String,
    pub title: String,
    pub description: Option<String>,
    pub start_at: String,
    pub end_at: Option<String>,
    pub deadline_at: Option<String>,
    pub all_day: bool,
    pub status: String,
    pub priority: String,
    pub assignee: Option<String>,
    pub location: Option<String>,
    pub url: Option<String>,
    pub memo: Option<String>,
    pub is_pinned: bool,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EventRecord {
    pub id: String,
    #[serde(flatten)]
    pub event: NewEventRecord,
    pub created_at: String,
    pub updated_at: String,
}
```

If flatten produces JSON incompatible with the TypeScript contract during tests, replace the flatten representation with explicit fields before proceeding; do not change the TypeScript `CalendarEvent` shape.

- [ ] **Step 2: Write failing round-trip and restart tests**

Use a helper `sample_event()` and test all nullable fields, booleans, status, priority and timestamps. The durability test must use a real temporary file:

```rust
#[test]
fn event_survives_database_reopen() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("calendarforwork.sqlite3");

    let created_id = {
        let db = Database::open(&path).unwrap();
        db.create_event(sample_event()).unwrap().id
    };

    let reopened = Database::open(&path).unwrap();
    let event = reopened.get_event(&created_id).unwrap().unwrap();
    assert_eq!(event.event.title, "PQ 제출");
    assert_eq!(event.event.client_name.as_deref(), Some("국가철도공단"));
}
```

Also add tests that `list_events_between` includes boundary dates, `replace_event` keeps `created_at` but changes `updated_at`, and `remove_event` makes `get_event` return `None`.

- [ ] **Step 3: Run tests and verify RED**

```bash
cargo test --manifest-path src-tauri/Cargo.toml persistence::events::tests
```

Expected: FAIL because CRUD methods are missing.

- [ ] **Step 4: Implement row mapping and CRUD**

Use parameterized SQL only. Do not interpolate user text into SQL. Store bool values as `0/1`. Use RFC3339/ISO strings as received from the frontend. Generate IDs with `Uuid::new_v4().to_string()` and timestamps with SQLite `strftime('%Y-%m-%dT%H:%M:%fZ','now')` or one consistently generated UTC timestamp per operation.

`list_events_between` must compare `substr(start_at, 1, 10)` to `substr(?1, 1, 10)` and `substr(?2, 1, 10)` so it keeps current calendar-date semantics instead of converting time zones in SQLite.

- [ ] **Step 5: Run the full Rust persistence suite**

```bash
cargo test --manifest-path src-tauri/Cargo.toml persistence::
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/persistence
git commit -m "feat: persist calendar events in SQLite"
```

### Task 3: Tauri commands and app-data database initialization

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/events.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Commands: `events_list_between`, `events_list_upcoming`, `events_get`, `events_create`, `events_replace`, `events_remove`.
- All commands return `Result<..., String>` at the IPC boundary while persistence internals retain typed errors.

- [ ] **Step 1: Implement thin command adapters**

Each command gets `tauri::State<'_, Database>` and delegates exactly once to persistence. Example:

```rust
#[tauri::command]
pub fn events_list_between(
    database: tauri::State<'_, Database>,
    start_iso: String,
    end_iso: String,
) -> Result<Vec<EventRecord>, String> {
    database
        .list_events_between(&start_iso, &end_iso)
        .map_err(|error| error.to_string())
}
```

- [ ] **Step 2: Initialize the database before the webview uses it**

In `lib.rs`, use `tauri::Manager` and `.setup()`:

```rust
.setup(|app| {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;
    let database = Database::open(app_data_dir.join("calendarforwork.sqlite3"))?;
    app.manage(database);
    Ok(())
})
```

Register all six commands through one `tauri::generate_handler![...]` call.

- [ ] **Step 3: Verify Rust tests and Tauri compilation**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands src-tauri/src/lib.rs
git commit -m "feat: expose SQLite event commands through Tauri"
```

### Task 4: TypeScript Tauri EventRepository adapter

**Files:**
- Modify: `package.json`
- Create: `src/repositories/tauriEventRepository.ts`
- Create: `src/repositories/tauriEventRepository.test.ts`

**Interfaces:**
- Add runtime dependency `@tauri-apps/api` version `2.11.1`.
- Produces `createTauriEventRepository(invokeFn?: InvokeFn): EventRepository`.

- [ ] **Step 1: Write failing IPC adapter tests**

Define the injectable boundary:

```ts
export type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
```

Tests must assert command names and argument shapes for list/create/remove. For update, assert this sequence:

1. `events_get` returns the current `CalendarEvent`.
2. TypeScript merges the `Partial<NewCalendarEvent>` patch.
3. `events_replace` receives a full `NewCalendarEvent`, without `id`, `createdAt`, or `updatedAt`.

Example test:

```ts
test('update merges a partial patch before replacing the SQLite record', async () => {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const invokeFn: InvokeFn = async <T>(command, args) => {
    calls.push([command, args]);
    if (command === 'events_get') return currentEvent as T;
    if (command === 'events_replace') return { ...currentEvent, title: '수정 일정' } as T;
    throw new Error(`unexpected command: ${command}`);
  };

  const repository = createTauriEventRepository(invokeFn);
  const updated = await repository.update(currentEvent.id, { title: '수정 일정' });

  expect(updated.title).toBe('수정 일정');
  expect(calls[0]).toEqual(['events_get', { id: currentEvent.id }]);
  expect(calls[1][0]).toBe('events_replace');
  expect((calls[1][1]?.event as Record<string, unknown>).id).toBeUndefined();
});
```

- [ ] **Step 2: Run test and verify RED**

```bash
npm test -- --run src/repositories/tauriEventRepository.test.ts
```

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement adapter using Tauri `invoke`**

Import the production invoke implementation from:

```ts
import { invoke } from '@tauri-apps/api/core';
```

Map methods exactly:

```text
listBetween  -> events_list_between
listUpcoming -> events_list_upcoming
create       -> events_create
update       -> events_get + events_replace
remove       -> events_remove
```

If `events_get` returns `null`, throw `Error('Event not found: <id>')` to retain the Memory Repository contract.

- [ ] **Step 4: Run repository and full frontend tests**

```bash
npm test -- --run src/repositories/tauriEventRepository.test.ts
npm test -- --run
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json src/repositories/tauriEventRepository.ts src/repositories/tauriEventRepository.test.ts
git commit -m "feat: add Tauri SQLite event repository adapter"
```

### Task 5: Runtime selection — SQLite in Tauri, Memory in browser tests

**Files:**
- Create: `src/repositories/runtimeEventRepository.ts`
- Create: `src/repositories/runtimeEventRepository.test.ts`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Produces `createRuntimeEventRepository(now: Date, tauriRuntime?: boolean): EventRepository`.
- Tauri runtime returns a Tauri repository with an empty persistent DB.
- Browser runtime returns `createMemoryEventRepository(createSampleEvents(now))`.

- [ ] **Step 1: Write failing runtime-selection test**

```ts
test('uses memory demo repository outside Tauri', async () => {
  const repository = createRuntimeEventRepository(new Date('2026-09-10T09:00:00+09:00'), false);
  const events = await repository.listBetween('2026-09-01', '2026-09-30');
  expect(events.length).toBeGreaterThan(0);
});
```

Also test that the Tauri path returns an adapter object whose methods are present without invoking a command during construction.

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- --run src/repositories/runtimeEventRepository.test.ts
```

Expected: FAIL because runtime selector does not exist.

- [ ] **Step 3: Implement runtime selection**

Use `isTauri()` from `@tauri-apps/api/core` only when the optional test override is not supplied:

```ts
const runningInTauri = tauriRuntime ?? isTauri();
return runningInTauri
  ? createTauriEventRepository()
  : createMemoryEventRepository(createSampleEvents(now));
```

Change `App.tsx` from constructing Memory Repository directly to `createRuntimeEventRepository(appNow)`.

- [ ] **Step 4: Run all frontend tests and build**

```bash
npm test -- --run
npm run build
```

Expected: PASS with existing UI behavior unchanged under jsdom.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx src/repositories/runtimeEventRepository.ts src/repositories/runtimeEventRepository.test.ts
git commit -m "feat: use SQLite repository in Tauri runtime"
```

### Task 6: CI durability gate and documentation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Windows desktop CI must generate icons, run `cargo test`, then `cargo check`.
- README must state the actual SQLite location and distinguish browser demo storage from Tauri persistent storage.

- [ ] **Step 1: Strengthen Windows CI**

Desktop job order:

```yaml
- name: Install desktop tooling
  run: npm install
- name: Generate Tauri icons
  run: npm run icon:generate
- name: Test SQLite persistence
  run: cargo test --manifest-path src-tauri/Cargo.toml
- name: Check Tauri Rust crate
  run: cargo check --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 2: Update README**

Document these exact semantics:

```text
Tauri Windows 앱: SQLite 영구 저장
파일명: calendarforwork.sqlite3
위치: 운영체제가 제공하는 CalendarForwork 앱 데이터 디렉터리
브라우저 npm run dev: 데모용 Memory Repository, 재시작 시 초기화
```

State that Project/Client Master and Excel import are still planned and are not part of this persistence slice.

- [ ] **Step 3: Run final verification**

```bash
npm test -- --run
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: all PASS with zero failing tests.

- [ ] **Step 4: Verify the persistence contract**

The Rust test `event_survives_database_reopen` must be present and passing. This is the automated proof that data written to a SQLite file survives closing and reopening the database connection.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "docs: document SQLite-backed local persistence"
```

## Completion Criteria

The slice is complete only when all conditions below are true:

1. Tauri runtime no longer constructs `MemoryEventRepository` for real user data.
2. Creating an event writes a row to SQLite.
3. Completing/updating an event survives DB reopen.
4. Deleting an event removes it permanently.
5. Existing Calendar/Today/Quick Add UI tests still pass unchanged in behavior.
6. Rust database tests include a real-file reopen durability case.
7. Windows CI passes icon generation, Rust tests and `cargo check`.
8. Frontend CI passes all Vitest tests and production build.
9. No Project/Client Master or other follow-up subsystem is mixed into this branch.
