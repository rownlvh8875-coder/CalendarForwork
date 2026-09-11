import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createRuntimeEventRepository } from '../../repositories/runtimeEventRepository';
import { createRuntimeMasterRepositories } from '../../repositories/runtimeMasterRepositories';
import type { ProjectTimelineRepository } from '../../repositories/ProjectTimelineRepository';
import { ProjectTimelineTab } from './ProjectTimelineTab';

const anchor = new Date('2026-09-11T09:00:00+09:00');

async function renderDemoTimeline() {
  const masters = createRuntimeMasterRepositories(anchor, false);
  const events = createRuntimeEventRepository(anchor, false);
  const project = (await masters.projects.get('demo-project-a'))!;
  const stages = await masters.projects.listStages();

  render(
    <ProjectTimelineTab
      project={project}
      stages={stages}
      timelineRepository={masters.timeline}
      eventRepository={events}
      now={anchor}
    />,
  );
}

describe('ProjectTimelineTab', () => {
  it('renders stage history and linked project events in one compact feed', async () => {
    await renderDemoTimeline();

    expect(await screen.findByText('사업 시작')).toBeInTheDocument();
    expect(screen.getByText('PQ 제출서류 검토')).toBeInTheDocument();
    expect(screen.getAllByText('PQ').length).toBeGreaterThan(0);
    expect(screen.getByText('D-DAY')).toBeInTheDocument();
  });

  it('shows a clear error state when timeline data cannot be loaded', async () => {
    const masters = createRuntimeMasterRepositories(anchor, false);
    const events = createRuntimeEventRepository(anchor, false);
    const project = (await masters.projects.get('demo-project-a'))!;
    const stages = await masters.projects.listStages();
    const failingTimeline: ProjectTimelineRepository = {
      async listStageHistory() {
        throw new Error('history unavailable');
      },
    };

    render(
      <ProjectTimelineTab
        project={project}
        stages={stages}
        timelineRepository={failingTimeline}
        eventRepository={events}
        now={anchor}
      />,
    );

    expect(await screen.findByText('Timeline을 불러오지 못했습니다.')).toBeInTheDocument();
  });
});
