import { createRuntimeEventRepository } from './runtimeEventRepository';

describe('runtime event repository', () => {
  test('uses demo-backed memory storage outside Tauri', async () => {
    const now = new Date('2026-09-10T09:00:00+09:00');
    const repository = createRuntimeEventRepository(now, false);

    const events = await repository.listBetween('2026-09-01', '2026-09-30');

    expect(events).toHaveLength(4);
    expect(events.map((event) => event.id)).toContain('demo-pq-review');
  });

  test('constructs the Tauri repository without invoking native commands', () => {
    const now = new Date('2026-09-10T09:00:00+09:00');
    const repository = createRuntimeEventRepository(now, true);

    expect(typeof repository.listBetween).toBe('function');
    expect(typeof repository.listUpcoming).toBe('function');
    expect(typeof repository.create).toBe('function');
    expect(typeof repository.update).toBe('function');
    expect(typeof repository.remove).toBe('function');
  });
});
