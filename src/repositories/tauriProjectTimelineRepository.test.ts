import type { ProjectStageHistory } from '../domain/timeline';
import { createTauriProjectTimelineRepository, type TimelineInvokeFn } from './tauriProjectTimelineRepository';

const history: ProjectStageHistory = {
  id: 'history-1',
  projectId: 'project-1',
  fromStage: 'planned-order',
  toStage: 'pq',
  changedAt: '2026-09-11T09:00:00Z',
  source: 'project-edit',
  note: null,
  createdAt: '2026-09-11T09:00:00Z',
};

describe('Tauri project timeline repository', () => {
  test('maps stage history reads to the expected Tauri command', async () => {
    const calls: Array<[string, Record<string, unknown> | undefined]> = [];
    const invoke: TimelineInvokeFn = async <T>(command: string, args?: Record<string, unknown>) => {
      calls.push([command, args]);
      if (command === 'project_stage_history_list') return [history] as T;
      throw new Error(`unexpected command: ${command}`);
    };

    const repository = createTauriProjectTimelineRepository(invoke);
    const result = await repository.listStageHistory('project-1');

    expect(result).toEqual([history]);
    expect(calls).toEqual([
      ['project_stage_history_list', { projectId: 'project-1' }],
    ]);
  });
});
