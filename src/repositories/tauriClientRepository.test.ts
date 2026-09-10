import { describe, expect, it, vi } from 'vitest';
import type { Client, NewClient } from '../domain/clients';
import { createTauriClientRepository } from './tauriClientRepository';

const client: Client = {
  id: 'client-1',
  name: '가상 발주처',
  category: '공공기관',
  department: null,
  contactName: null,
  phone: null,
  email: null,
  memo: null,
  createdAt: '2026-09-11T00:00:00Z',
  updatedAt: '2026-09-11T00:00:00Z',
};

describe('createTauriClientRepository', () => {
  it('maps list, create and remove to Tauri commands', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'clients_list') return [client];
      if (command === 'clients_create') return client;
      return undefined;
    });
    const repository = createTauriClientRepository(invoke);
    const input: NewClient = { ...client };
    delete (input as Partial<Client>).id;
    delete (input as Partial<Client>).createdAt;
    delete (input as Partial<Client>).updatedAt;

    await expect(repository.list()).resolves.toEqual([client]);
    await expect(repository.create(input)).resolves.toEqual(client);
    await repository.remove(client.id);

    expect(invoke).toHaveBeenCalledWith('clients_list');
    expect(invoke).toHaveBeenCalledWith('clients_create', { client: input });
    expect(invoke).toHaveBeenCalledWith('clients_remove', { id: client.id });
  });

  it('updates by loading, merging and replacing without metadata', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'clients_get') return client;
      if (command === 'clients_replace') return { ...client, memo: '변경' };
      return undefined;
    });
    const repository = createTauriClientRepository(invoke);

    await repository.update(client.id, { memo: '변경' });

    expect(invoke).toHaveBeenNthCalledWith(1, 'clients_get', { id: client.id });
    expect(invoke).toHaveBeenNthCalledWith(2, 'clients_replace', {
      id: client.id,
      client: expect.not.objectContaining({ id: expect.anything(), createdAt: expect.anything(), updatedAt: expect.anything() }),
    });
  });

  it('throws the repository-level not-found error', async () => {
    const repository = createTauriClientRepository(async () => null as never);
    await expect(repository.update('missing', { memo: 'x' })).rejects.toThrow('Client not found: missing');
  });
});
