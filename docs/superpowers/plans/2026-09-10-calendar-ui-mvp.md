# CalendarForwork UI MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows 개인 PC에서 실행할 수 있는 CalendarForwork의 첫 번째 vertical slice를 구현한다. 월간 캘린더, 오늘 업무, 빠른 일정등록, 일정 상세 패널이 하나의 일관된 UI에서 동작하고 이후 SQLite/팀용 API로 확장 가능한 경계를 갖는다.

**Architecture:** React + TypeScript UI를 Tauri v2 데스크톱 shell에 탑재한다. UI는 domain/application/repository 경계를 분리하며, 첫 UI slice에서는 `EventRepository` 인터페이스와 메모리 구현으로 화면 동작을 검증한 뒤 후속 단계에서 SQLite 구현을 교체 가능하게 한다. 날짜 계산과 상태 계산은 React 컴포넌트 밖의 순수 함수로 유지한다.

**Tech Stack:** React, TypeScript, Vite, Tauri v2, Vitest, React Testing Library, CSS Design Tokens

**Spec:** `docs/superpowers/specs/2026-09-10-calendar-for-work-design.md`

## Global Constraints

- 대상 플랫폼은 Windows 개인 PC다.
- V1은 향후 API/PostgreSQL 기반 팀용으로 확장할 수 있도록 UI에서 저장소 구현을 직접 참조하지 않는다.
- 핵심 품질은 정보 가독성, 입력 속도, 일상적 사용성, UI 일관성이다.
- 월간 셀은 일정 최대 3건을 우선 노출하고 초과분은 `+N개 더보기`로 표시한다.
- 색상만으로 의미를 전달하지 않고 카테고리 텍스트/배지를 함께 표시한다.
- 일정 클릭 시 캘린더 context를 유지한 채 우측 Detail Side Panel을 연다.
- `deadlineAt`과 일반 시작/종료 시각을 구분한다.
- V1에서 로그인, 권한, 실시간 동시편집, 사내 서버, 모바일 앱, 나라장터 자동수집, 외부 캘린더 양방향 동기화는 구현하지 않는다.

---

## File Structure

```text
CalendarForwork/
├─ package.json                       # frontend scripts/dependencies
├─ vite.config.ts                     # Vite/Vitest config
├─ tsconfig.json                      # TypeScript config
├─ index.html                         # Vite entry
├─ src/
│  ├─ main.tsx                        # React bootstrap
│  ├─ app/App.tsx                     # top-level routes/view state
│  ├─ app/App.test.tsx                # smoke/integration tests
│  ├─ domain/calendar.ts              # Event/Category/Project types
│  ├─ domain/date.ts                  # month grid, D-Day pure functions
│  ├─ domain/date.test.ts             # date behavior tests
│  ├─ repositories/EventRepository.ts # persistence abstraction
│  ├─ repositories/memoryEventRepository.ts # first-slice implementation
│  ├─ data/sampleData.ts              # deterministic demo data
│  ├─ features/calendar/CalendarPage.tsx
│  ├─ features/calendar/CalendarPage.test.tsx
│  ├─ features/calendar/MonthGrid.tsx
│  ├─ features/calendar/CalendarToolbar.tsx
│  ├─ features/events/EventDetailPanel.tsx
│  ├─ features/events/QuickEventDialog.tsx
│  ├─ features/today/TodayPage.tsx
│  ├─ components/AppSidebar.tsx
│  ├─ components/CategoryBadge.tsx
│  └─ styles/
│     ├─ tokens.css                   # light/dark design tokens
│     └─ app.css                      # layout/component styles
├─ src-tauri/
│  ├─ Cargo.toml                      # Tauri Rust package
│  ├─ build.rs
│  ├─ tauri.conf.json                 # Windows desktop config
│  ├─ capabilities/default.json       # minimal permissions
│  └─ src/
│     ├─ main.rs
│     └─ lib.rs
└─ docs/superpowers/plans/...
```

### Task 1: Executable React + Tauri shell

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`
- Create: `src/main.tsx`, `src/app/App.tsx`, `src/app/App.test.tsx`
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: React entry `App`; scripts `npm run dev`, `npm run test`, `npm run build`, `npm run tauri dev`.

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders CalendarForwork shell', () => {
  render(<App />);
  expect(screen.getByText('CalendarForwork')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- --run src/app/App.test.tsx`
Expected: FAIL because the project/App does not exist yet.

- [ ] **Step 3: Add the minimal React/Vite/Tauri scaffold**

`App.tsx` initially renders a semantic shell with application title. Configure Vitest with `jsdom` and a test setup importing `@testing-library/jest-dom/vitest`. Configure Tauri v2 with one main window and only core capability permissions needed to launch.

- [ ] **Step 4: Verify frontend and Rust configuration**

Run: `npm test -- --run`
Expected: PASS.

Run: `npm run build`
Expected: PASS and `dist/` generated.

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.ts tsconfig*.json index.html src src-tauri
git commit -m "feat: scaffold CalendarForwork desktop app"
```

### Task 2: Domain model and calendar date rules

**Files:**
- Create: `src/domain/calendar.ts`
- Create: `src/domain/date.ts`
- Test: `src/domain/date.test.ts`

**Interfaces:**
- Produces: `CalendarEvent`, `EventCategory`, `ProjectSummary`, `CalendarDay`.
- Produces: `buildMonthGrid(year: number, monthIndex: number): CalendarDay[]`.
- Produces: `getDeadlineLabel(deadlineAt: string, now: Date, completedAt?: string | null): string | null`.

- [ ] **Step 1: Write failing tests for a 6-week month grid and D-Day**

```ts
expect(buildMonthGrid(2026, 8)).toHaveLength(42);
expect(getDeadlineLabel('2026-09-10T17:00:00+09:00', new Date('2026-09-10T09:00:00+09:00'))).toBe('D-Day');
expect(getDeadlineLabel('2026-09-09T17:00:00+09:00', new Date('2026-09-10T09:00:00+09:00'))).toBe('D+1');
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- --run src/domain/date.test.ts`
Expected: FAIL because utilities are not defined.

- [ ] **Step 3: Implement pure date functions**

Use local calendar dates rather than millisecond/24h rounding for D-Day. Completed events return `null` to suppress urgency labeling.

- [ ] **Step 4: Run tests**

Run: `npm test -- --run src/domain/date.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain
git commit -m "feat: add calendar domain and deadline rules"
```

### Task 3: Persistence boundary and deterministic demo data

**Files:**
- Create: `src/repositories/EventRepository.ts`
- Create: `src/repositories/memoryEventRepository.ts`
- Create: `src/repositories/memoryEventRepository.test.ts`
- Create: `src/data/sampleData.ts`

**Interfaces:**
- Produces:

```ts
export interface EventRepository {
  listBetween(startIso: string, endIso: string): Promise<CalendarEvent[]>;
  listUpcoming(fromIso: string, days: number): Promise<CalendarEvent[]>;
  create(input: NewCalendarEvent): Promise<CalendarEvent>;
  update(id: string, patch: Partial<NewCalendarEvent>): Promise<CalendarEvent>;
  remove(id: string): Promise<void>;
}
```

- [ ] **Step 1: Write CRUD/query tests against memory repository**
- [ ] **Step 2: Run tests and verify failure**
- [ ] **Step 3: Implement repository without leaking array mutation to callers**
- [ ] **Step 4: Run repository tests and full suite**
- [ ] **Step 5: Commit `feat: add event repository boundary`**

### Task 4: Design system and application shell

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/app.css`
- Create: `src/components/AppSidebar.tsx`, `src/components/CategoryBadge.tsx`
- Modify: `src/app/App.tsx`, `src/main.tsx`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- `AppSidebar` exposes `activeView` and `onSelect(view)`.
- Design tokens expose semantic variables for surface, text, border, accent, danger, warning, success and category accents in light/dark mode.

- [ ] **Step 1: Extend shell test to verify `오늘`, `캘린더`, `사업관리`, `설정` navigation labels**
- [ ] **Step 2: Run and verify failure**
- [ ] **Step 3: Implement compact SaaS-style shell with collapsible sidebar and responsive main area**
- [ ] **Step 4: Verify tests and `npm run build`**
- [ ] **Step 5: Commit `feat: add CalendarForwork design system and shell`**

### Task 5: Month calendar UI

**Files:**
- Create: `src/features/calendar/CalendarToolbar.tsx`
- Create: `src/features/calendar/MonthGrid.tsx`
- Create: `src/features/calendar/CalendarPage.tsx`
- Test: `src/features/calendar/CalendarPage.test.tsx`
- Modify: `src/app/App.tsx`, `src/styles/app.css`

**Interfaces:**
- `CalendarPage` consumes `EventRepository`.
- `MonthGrid` receives `days`, `events`, `onSelectEvent`, `onSelectDay`.

- [ ] **Step 1: Write test for September 2026 header, weekday grid, three-event cap, and `+N개 더보기`**
- [ ] **Step 2: Run and verify failure**
- [ ] **Step 3: Implement toolbar and 42-cell month grid**
- [ ] **Step 4: Add previous/today/next month navigation and event category/D-Day chips**
- [ ] **Step 5: Run component tests and build**
- [ ] **Step 6: Commit `feat: add interactive month calendar`**

### Task 6: Event detail side panel

**Files:**
- Create: `src/features/events/EventDetailPanel.tsx`
- Create: `src/features/events/EventDetailPanel.test.tsx`
- Modify: `src/features/calendar/CalendarPage.tsx`, `src/styles/app.css`

**Interfaces:**
- Props: `event: CalendarEvent | null`, `onClose(): void`, `onComplete(id: string): void`, `onDelete(id: string): void`.

- [ ] **Step 1: Write test that clicking an event opens details without unmounting the calendar**
- [ ] **Step 2: Run and verify failure**
- [ ] **Step 3: Implement right side panel with project/client/category/deadline/status/priority/memo/url fields**
- [ ] **Step 4: Add keyboard Escape and accessible close button**
- [ ] **Step 5: Run tests/build**
- [ ] **Step 6: Commit `feat: add event detail panel`**

### Task 7: Quick event registration

**Files:**
- Create: `src/features/events/QuickEventDialog.tsx`
- Create: `src/features/events/QuickEventDialog.test.tsx`
- Modify: `src/features/calendar/CalendarPage.tsx`, `src/styles/app.css`

**Interfaces:**
- Required input: title, date.
- Optional input: project, category, deadline time, priority.
- On submit calls `EventRepository.create()` and refreshes the visible range.

- [ ] **Step 1: Write validation and successful-create tests**
- [ ] **Step 2: Run and verify failure**
- [ ] **Step 3: Implement dialog with keyboard-first input order**
- [ ] **Step 4: Add `+ 일정등록` and day-cell double-click entry points**
- [ ] **Step 5: Run full test/build suite**
- [ ] **Step 6: Commit `feat: add quick event registration`**

### Task 8: Today dashboard first slice

**Files:**
- Create: `src/features/today/TodayPage.tsx`
- Create: `src/features/today/TodayPage.test.tsx`
- Modify: `src/app/App.tsx`, `src/styles/app.css`

**Interfaces:**
- Consumes `EventRepository.listUpcoming()`.
- Groups events into `긴급`, `이번 주`, `마감 초과`, `발주예정` using deterministic domain helpers.

- [ ] **Step 1: Write grouping test with fixed current date**
- [ ] **Step 2: Run and verify failure**
- [ ] **Step 3: Implement dashboard grouping and compact rows**
- [ ] **Step 4: Connect sidebar navigation between Today and Calendar**
- [ ] **Step 5: Run full tests/build**
- [ ] **Step 6: Commit `feat: add today work dashboard`**

### Task 9: First-slice verification and README update

**Files:**
- Modify: `README.md`
- Modify only if defects are found: files from Tasks 1-8

**Interfaces:**
- Produces documented local run commands and MVP capability list.

- [ ] **Step 1: Run `npm test -- --run` and require all tests PASS**
- [ ] **Step 2: Run `npm run build` and require PASS**
- [ ] **Step 3: Run `cargo check --manifest-path src-tauri/Cargo.toml` and require PASS**
- [ ] **Step 4: Manually verify 1280×800 and 1920×1080 layouts in Tauri dev window**
- [ ] **Step 5: Verify keyboard focus, Escape close, category text labels and light/dark token contrast**
- [ ] **Step 6: Update README with install/run/test instructions and implemented-vs-planned checklist**
- [ ] **Step 7: Commit `docs: document CalendarForwork UI MVP`**

## Follow-up Plans After This MVP

SQLite persistence, project/client master management, project timeline, drag-and-drop persistence/undo, Excel Import Wizard, Excel Export, local notifications, backup/restore, global search/filter, installer/release packaging are intentionally split into follow-up implementation plans. This keeps the first vertical slice executable, reviewable, and visually testable before persistence and migration complexity are introduced.
