import { describe, expect, it } from 'vitest';
import { createRuntimeMasterRepositories } from './runtimeMasterRepositories';

const anchor = new Date('2026-09-11T09:00:00+09:00');

describe('createRuntimeMasterRepositories', () => {
  it('uses fictional shared browser data and preserves project/client relations', async () => {
    const { clients, projects } = createRuntimeMasterRepositories(anchor, false);

    const clientRows = await clients.list();
    const projectRows = await projects.list(false);

    expect(clientRows.length).toBeGreaterThan(0);
    expect(projectRows.length).toBeGreaterThan(0);
    expect(clientRows[0].name).toContain('가상');
    expect(projectRows[0].name).toContain('가상');
    expect(projectRows[0].clientId).toBe(clientRows[0].id);
    expect(projectRows[0].clientName).toBe(clientRows[0].name);
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
