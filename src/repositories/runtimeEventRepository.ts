import { isTauri } from '@tauri-apps/api/core';
import { createSampleEvents } from '../data/sampleData';
import type { EventRepository } from './EventRepository';
import { createMemoryEventRepository } from './memoryEventRepository';
import { createTauriEventRepository } from './tauriEventRepository';

export function createRuntimeEventRepository(
  now: Date,
  tauriRuntime?: boolean,
): EventRepository {
  const runningInTauri = tauriRuntime ?? isTauri();

  if (runningInTauri) {
    return createTauriEventRepository();
  }

  return createMemoryEventRepository(createSampleEvents(now));
}
