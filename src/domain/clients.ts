export interface Client {
  id: string;
  name: string;
  category?: string | null;
  department?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  memo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewClient = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;
