# CalendarForwork 사업별 Timeline 설계명세

- 작성일: 2026-09-11
- 기준 브랜치: `feat/project-client-master`
- 구현 브랜치: `feat/project-timeline`
- 상태: 설계 승인 후 명세 고정

## 1. 목적

사업 Master는 현재 `projects.current_stage`를 통해 현재 단계를 저장하지만, 단계가 언제 어떻게 변경되었는지에 대한 이력은 남기지 않는다. 또한 일정은 `projectId`로 사업과 연결될 수 있으나 사업 상세 화면에서 단계 이력과 업무 일정이 함께 보이지 않는다.

이번 단계의 목적은 다음 두 정보를 하나의 사업별 Timeline에서 함께 보여주는 것이다.

1. 사업 단계 변경 이력
2. 해당 사업에 연결된 일정(PQ, SOQ, 설계심의, 가격입찰, 회의 등)

이를 통해 사용자는 사업 상세 화면만 열어도 과거 진행흐름과 가까운 향후 일정을 동시에 확인할 수 있어야 한다.

## 2. 범위

### 포함

- SQLite migration v3
- `project_stage_history` 영구저장
- 사업 신규 등록 시 최초 단계 이력 기록
- 사업 단계 변경 시 이력 자동 기록
- 동일 단계 재저장 시 중복 이력 방지
- 기존 사업의 현재 단계를 migration baseline으로 1건 기록
- `EventRepository.listByProject(projectId)` 추가
- Tauri IPC / TypeScript Repository / Browser Memory 구현 정합성
- 사업 상세패널의 `개요 | Timeline` 탭
- 단계 이력 + 사업연결 일정을 통합한 Timeline 표시
- 향후 일정 D-Day 표시
- 기존 캘린더/오늘/사업/발주처 회귀검증

### 제외

- 단계 이력 수동 수정/삭제
- 과거 실제 단계변경일 추정 또는 소급 생성
- Gantt Chart
- 17단계 전체 Progress Bar
- Timeline Drag & Drop
- Excel Import/Export
- 알림 및 자동백업
- 팀 서버/API

## 3. 핵심 원칙

### 과거 이력을 추정하지 않는다

기존 DB의 `projects.current_stage`만으로는 과거 단계변경 시점을 알 수 없다. 따라서 migration v3는 기존 사업에 대해 과거 이력을 만들어내지 않는다.

기존 사업에는 migration 시점에 다음 1건만 추가한다.

```text
fromStage: null
toStage: 현재 current_stage
source: migration-baseline
changedAt: migration 실행 시각
```

UI에서는 이를 일반 단계변경과 구분하여 `현재단계 기준선`으로 표시한다.

### 현재 상태와 이력은 일관되어야 한다

`projects.current_stage` 변경과 `project_stage_history` 추가는 하나의 SQLite transaction 안에서 처리한다. 단계 변경 저장 중 이력 생성이 실패하면 사업 변경도 rollback 한다.

## 4. 데이터 모델

SQLite schema version은 3으로 올린다.

```sql
CREATE TABLE project_stage_history (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_stage TEXT NULL REFERENCES project_stages(key),
  to_stage TEXT NOT NULL REFERENCES project_stages(key),
  changed_at TEXT NOT NULL,
  source TEXT NOT NULL CHECK (
    source IN ('project-create', 'project-edit', 'migration-baseline')
  ),
  note TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_project_stage_history_project
ON project_stage_history(project_id, changed_at DESC);
```

### 필드 의미

- `id`: 이력 식별자
- `project_id`: 대상 사업
- `from_stage`: 변경 전 단계. 최초 등록/baseline은 null
- `to_stage`: 변경 후 단계
- `changed_at`: 실제 Timeline 정렬 기준시각
- `source`
  - `project-create`: 신규 사업 등록
  - `project-edit`: 사용자가 사업 단계 변경
  - `migration-baseline`: 기존 사업의 현재단계 기준선
- `note`: V1에서는 null로 저장하되 향후 확장 여지 유지
- `created_at`: 레코드 생성시각

### 기존 사업 backfill

migration v3는 현재 존재하는 각 project에 baseline 1건을 추가한다. ID는 충돌 없는 deterministic prefix를 사용한다.

```text
baseline:<project_id>
```

migration은 schema version으로 한 번만 적용되며 재실행 시 중복 생성하지 않는다.

## 5. 사업 생성/수정 Transaction 규칙

### 신규 사업 생성

1. project row 생성
2. 생성된 `current_stage`로 history 1건 생성
3. history source = `project-create`
4. 둘 중 하나라도 실패하면 전체 rollback

최초 이력은 다음 형태다.

```text
fromStage = null
toStage = project.currentStage
```

### 사업 수정

수정 전 currentStage와 수정 후 currentStage를 비교한다.

- 동일: project만 수정, history 추가 없음
- 변경: project 수정 + history 1건 추가

단계변경 이력:

```text
fromStage = 이전 currentStage
toStage = 새 currentStage
source = project-edit
```

사업의 `updated_at`과 history의 `changed_at`은 같은 transaction 안에서 생성된 시각을 사용한다.

## 6. Repository / IPC 구조

### ProjectTimelineRepository

새 Repository를 추가한다.

```ts
interface ProjectStageHistory {
  id: string;
  projectId: string;
  fromStage?: string | null;
  toStage: string;
  changedAt: string;
  source: 'project-create' | 'project-edit' | 'migration-baseline';
  note?: string | null;
  createdAt: string;
}

interface ProjectTimelineRepository {
  listStageHistory(projectId: string): Promise<ProjectStageHistory[]>;
}
```

Tauri command:

```text
project_stage_history_list
```

### EventRepository 확장

기존 계약에 다음 메서드를 추가한다.

```ts
listByProject(projectId: string): Promise<CalendarEvent[]>;
```

Tauri command:

```text
events_list_by_project
```

Rust query는 `project_id = ?` 조건을 사용하며 모든 상태의 사업연결 일정을 반환한다.

## 7. Browser Memory 동작

브라우저/Vitest 모드도 SQLite와 같은 의미를 유지해야 한다.

공유 Master state에 다음을 추가한다.

```text
stageHistory[]
```

MemoryProjectRepository 규칙:

- create → `project-create` history 자동 추가
- update + stage 변경 → `project-edit` history 추가
- update + 동일 stage → history 추가 없음
- archive → history 삭제 없음
- client 삭제 → stage history 영향 없음

가상 demo project에는 최소 1건의 `project-create` history를 제공한다.

## 8. Timeline 표시 규칙

사업 상세 우측패널에 다음 탭을 둔다.

```text
[개요] [Timeline]
```

기본 탭은 기존 `개요`다. 사용자가 `Timeline`을 선택할 때 stage history와 project events를 로드한다.

### Timeline Item 종류

#### 단계변경

예:

```text
단계변경
발주예정 → 입찰공고
2026-09-18 14:25
```

최초 사업등록:

```text
사업 시작
관심사업
2026-09-11 10:00
```

migration baseline:

```text
현재단계 기준선
PQ
2026-09-11 13:00
```

#### 사업연결 일정

예:

```text
PQ · 제출마감
PQ 서류 제출
2026-10-02 17:00 · D-21
```

표시 정보:

- category name
- title
- effective date/time
- status
- priority
- 미래 일정이면 D-Day

## 9. Timeline 정렬

단일 feed를 사용하되 업무 활용성을 위해 다음 규칙으로 정렬한다.

### 미래 일정

`effectiveAt >= 오늘`인 Event는 feed 상단에 배치하며 가장 가까운 일정부터 오름차순 정렬한다.

```text
오늘 → D+1 → D+7 → ...
```

### 과거/현재 이력

단계변경과 과거 Event는 미래 일정 아래에 배치하고 최신순으로 정렬한다.

```text
가장 최근 → 과거
```

Event의 effectiveAt은 다음 기준을 사용한다.

```text
deadlineAt ?? startAt
```

Stage History의 effectiveAt은 `changedAt`이다.

동일 시각 tie-breaker는 다음 순서다.

1. stage-history
2. event
3. id

이 정렬은 별도 순수 함수로 구현하고 unit test한다.

## 10. UI 구조

새 컴포넌트:

```text
ProjectTimeline.tsx
ProjectTimelineItem.tsx (필요한 경우 분리)
```

기존 `ProjectDetailPanel`은 데이터 상세만 책임지지 않고 탭 shell 역할도 하므로, Timeline rendering은 별도 컴포넌트로 분리한다.

Timeline은 카드 여러 개가 아니라 compact vertical feed를 사용한다.

### 시각 원칙

- 단계변경: 작은 단계 badge + transition text
- 일정: 기존 category badge 재사용
- 날짜/시간은 보조 텍스트
- 중요도는 text + subtle accent
- 미래 일정 D-Day는 오른쪽 정렬
- baseline은 중립색/설명 텍스트로 실제 변경이력과 구분
- color만으로 상태를 전달하지 않는다

## 11. Loading / Empty / Error 상태

Timeline tab은 다음 상태를 명확히 구분한다.

- loading: `Timeline을 불러오는 중입니다.`
- empty: `아직 기록된 단계 이력이나 연결 일정이 없습니다.`
- error: `Timeline을 불러오지 못했습니다.` + 재시도 버튼

stage history와 project events는 `Promise.all`로 함께 로드한다. V1에서는 한쪽만 성공한 partial rendering은 하지 않는다. 둘 중 하나가 실패하면 전체 Timeline error 상태로 처리한다.

## 12. 기존 기능과의 관계

- 사업 보관: Timeline 유지
- 발주처 삭제: Timeline 유지
- 사업 삭제 기능은 현재 없으므로 고려하지 않음
- Event 삭제: Timeline에서도 즉시 사라짐
- Event 완료/취소: Timeline에는 남고 status만 반영
- 사업 stage 변경: Timeline에 자동 추가
- 동일 stage 저장: Timeline 변화 없음

## 13. 테스트 전략

### Rust / SQLite

1. migration v3가 `project_stage_history`를 생성
2. migration v3가 기존 project에 baseline 1건 생성
3. migration 재실행 시 baseline 중복 없음
4. 신규 project 생성 시 history 1건 생성
5. stage 변경 시 정확히 1건 추가
6. 동일 stage update 시 추가 없음
7. archive 시 history 유지
8. client 삭제 시 history 유지
9. invalid stage update 실패 시 project/history 모두 원상태 유지
10. events_list_by_project가 해당 사업 일정만 반환

### TypeScript Repository

- Tauri command 이름/argument contract
- Memory/Tauri parity
- Browser create/update history semantics
- EventRepository.listByProject

### Domain Timeline Sort

- 미래 일정 nearest-first
- 과거 history newest-first
- deadlineAt 우선
- tie-break deterministic

### UI

- 개요 탭 기본 표시
- Timeline 탭 전환
- 단계변경 item 표시
- baseline item 표시
- project-linked event 표시
- D-Day 표시
- loading/empty/error/retry
- 사업 단계 변경 후 다시 열면 Timeline 갱신

### 회귀검증

- 기존 Frontend 전체 test
- production build
- Windows cargo test
- Windows cargo check

## 14. 완료 기준

다음 조건을 모두 만족해야 Timeline 단계가 완료된 것으로 본다.

1. SQLite schema version 3 적용 및 idempotent 검증
2. 기존 사업 baseline 정확히 1건
3. 신규/단계변경 history transaction 보장
4. 동일 stage 저장 중복 history 없음
5. Browser/Tauri 동작 의미 일치
6. 사업연결 Event 조회 가능
7. Project Detail의 Timeline 탭 동작
8. 미래 일정 D-Day 표시
9. 기존 기능 회귀 없음
10. 전체 Frontend test/build 통과
11. Windows Rust test/check 통과

## 15. 이후 확장

이번 V1을 기반으로 이후 다음 기능을 추가할 수 있다.

- Timeline item memo/comment
- 담당자별 activity
- 단계 변경 사유
- 자동수집 공고/보도자료 source provenance
- 단계별 예상/실제 날짜 비교
- Gantt / milestone board
- 팀 사용자별 변경이력 audit

이번 단계에서는 위 확장기능을 구현하지 않는다.
