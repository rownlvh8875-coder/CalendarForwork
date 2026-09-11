import type { Client, NewClient } from '../domain/clients';
import type { ClientRepository } from './ClientRepository';
import { cloneClient, type MemoryMasterState } from './memoryMasterState';

export function createMemoryClientRepository(state: MemoryMasterState): ClientRepository {
  return {
    async list(): Promise<Client[]> {
      return state.clients.map(cloneClient);
    },

    async get(id: string): Promise<Client | null> {
      const client = state.clients.find((item) => item.id === id);
      return client ? cloneClient(client) : null;
    },

    async create(input: NewClient): Promise<Client> {
      const now = new Date().toISOString();
      const client: Client = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      state.clients = [...state.clients, client];
      return cloneClient(client);
    },

    async update(id: string, patch: Partial<NewClient>): Promise<Client> {
      const index = state.clients.findIndex((item) => item.id === id);
      if (index < 0) throw new Error(`Client not found: ${id}`);

      const current = state.clients[index];
      const updated: Client = { ...current, ...patch, id: current.id, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
      state.clients = state.clients.map((item) => (item.id === id ? updated : item));
      return cloneClient(updated);
    },

    async remove(id: string): Promise<void> {
      state.clients = state.clients.filter((item) => item.id !== id);
      state.projects = state.projects.map((project) =>
        project.clientId === id ? { ...project, clientId: null, clientName: null, updatedAt: new Date().toISOString() } : project,
      );
    },
  };
}
