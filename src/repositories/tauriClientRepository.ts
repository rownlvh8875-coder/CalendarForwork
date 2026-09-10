import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { Client, NewClient } from '../domain/clients';
import type { ClientRepository } from './ClientRepository';
import type { InvokeFn } from './tauriEventRepository';

function withoutMetadata(client: Client): NewClient {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = client;
  return input;
}

export function createTauriClientRepository(
  invokeFn: InvokeFn = tauriInvoke,
): ClientRepository {
  return {
    list(): Promise<Client[]> {
      return invokeFn<Client[]>('clients_list');
    },

    get(id: string): Promise<Client | null> {
      return invokeFn<Client | null>('clients_get', { id });
    },

    create(client: NewClient): Promise<Client> {
      return invokeFn<Client>('clients_create', { client });
    },

    async update(id: string, patch: Partial<NewClient>): Promise<Client> {
      const current = await invokeFn<Client | null>('clients_get', { id });
      if (!current) {
        throw new Error(`Client not found: ${id}`);
      }

      const client: NewClient = {
        ...withoutMetadata(current),
        ...patch,
      };
      return invokeFn<Client>('clients_replace', { id, client });
    },

    remove(id: string): Promise<void> {
      return invokeFn<void>('clients_remove', { id });
    },
  };
}
