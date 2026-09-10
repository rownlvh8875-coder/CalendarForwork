import type { Client, NewClient } from '../domain/clients';

export interface ClientRepository {
  list(): Promise<Client[]>;
  get(id: string): Promise<Client | null>;
  create(input: NewClient): Promise<Client>;
  update(id: string, patch: Partial<NewClient>): Promise<Client>;
  remove(id: string): Promise<void>;
}
