import { describe, expect, it } from 'vitest';
import { createRuntimeMasterRepositories } from './runtimeMasterRepositories';

describe('createRuntimeMasterRepositories', () => {
  it('uses fictional shared browser data and preserves project/client relations', async () => {
    const { clientRepository, projectRepository } = createRuntimeMasterRepositories(false);

    const clients = await clientRepository.list();
    const projects = await projectRepository.list(false);

    expect(clients.length).toBeGreaterThan(0);
    expect(projects.length).toBeGreaterThan(0);
    expect(clients[0].name).toContain('가상');
    expect(projects[0].name).toContain('가상');
    expect(projects[0].clientId).toBe(clients[0].id);
    expect(projects[0].clientName).toBe(clients[0].name);
  });

  it('nulls a linked project client when the browser client is removed', async () => {
    const { clientRepository, projectRepository } = createRuntimeMasterRepositories(false);
    const client = (await clientRepository.list())[0];
    const linked = (await projectRepository.list(false)).find((project) => project.clientId === client.id);

    expect(linked).toBeDefined();
    await clientRepository.remove(client.id);

    const after = await projectRepository.get(linked!.id);
    expect(after?.clientId).toBeNull();
    expect(after?.clientName).toBeNull();
  });

  it('supports project archive filtering in browser mode', async () => {
    const { projectRepository } = createRuntimeMasterRepositories(false);
    const project = (await projectRepository.list(false))[0];

    await projectRepository.setArchived(project.id, true);

    expect((await projectRepository.list(false)).some((item) => item.id === project.id)).toBe(false);
    expect((await projectRepository.list(true)).some((item) => item.id === project.id)).toBe(true);
  });
});
