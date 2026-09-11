import { describe, expect, it } from 'vitest';
import { createRuntimeMasterRepositories } from './runtimeMasterRepositories';

const anchor = new Date('2026-09-11T09:00:00+09:00');

describe('createRuntimeMasterRepositories', () => {
  it('uses fictional shared browser data and preserves project/client relations', async () => {
    const { clients, projects, timeline } = createRuntimeMasterRepositories(anchor, false);

    const clientRows = await clients.list();
    const projectRows = await projects.list(false);
    const stages = await projects.listStages();

    expect(clientRows.length).toBeGreaterThan(0);
    expect(projectRows.length).toBeGreaterThan(0);
    expect(clientRows[0].name).toContain('가상');
    expect(projectRows[0].name).toContain('가상');
    expect(projectRows[0].clientId).toBe(clientRows[0].id);
    expect(projectRows[0].clientName).toBe(clientRows[0].name);
    expect(stages).toHaveLength(17);
    expect(stages.at(-1)).toMatchObject({ key: 'cancelled', name: '취소' });

    const history = await timeline.listStageHistory(projectRows[0].id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      projectId: projectRows[0].id,
      fromStage: null,
      toStage: projectRows[0].currentStage,
      source: 'project-create',
    });
  });

  it('records only real stage changes and keeps history after archive in browser mode', async () => {
    const { projects, timeline } = createRuntimeMasterRepositories(anchor, false);
    const created = await projects.create({
      projectCode: 'DEMO-TIMELINE',
      name: '가상 Timeline 검증사업',
      clientId: null,
      projectType: '철도',
      region: '서울',
      contractType: '기술형입찰',
      estimatedCost: 100_000_000_000,
      currentStage: 'interest',
      priority: 'normal',
      assignee: null,
      expectedBidDate: null,
      description: null,
      memo: null,
      url: null,
      archived: false,
    });

    expect(await timeline.listStageHistory(created.id)).toHaveLength(1);

    await projects.update(created.id, { memo: '단계 변경 없음' });
    expect(await timeline.listStageHistory(created.id)).toHaveLength(1);

    await projects.update(created.id, { currentStage: 'pq' });
    const changed = await timeline.listStageHistory(created.id);
    expect(changed).toHaveLength(2);
    expect(changed[0]).toMatchObject({
      fromStage: 'interest',
      toStage: 'pq',
      source: 'project-edit',
    });

    await projects.setArchived(created.id, true);
    expect(await timeline.listStageHistory(created.id)).toHaveLength(2);
  });

  it('nulls a linked project client when the browser client is removed', async () => {
    const { clients, projects } = createRuntimeMasterRepositories(anchor, false);
    const client = (await clients.list())[0];
    const linked = (await projects.list(false)).find((project) => project.clientId === client.id);

    expect(linked).toBeDefined();
    await clients.remove(client.id);

    const after = await projects.get(linked!.id);
    expect(after?.clientId).toBeNull();
    expect(after?.clientName).toBeNull();
  });

  it('supports project archive filtering in browser mode', async () => {
    const { projects } = createRuntimeMasterRepositories(anchor, false);
    const project = (await projects.list(false))[0];

    await projects.setArchived(project.id, true);

    expect((await projects.list(false)).some((item) => item.id === project.id)).toBe(false);
    expect((await projects.list(true)).some((item) => item.id === project.id)).toBe(true);
  });

  it('constructs Tauri adapters without invoking commands', () => {
    expect(() => createRuntimeMasterRepositories(anchor, true)).not.toThrow();
  });
});
