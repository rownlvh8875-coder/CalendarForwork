import type { Client } from '../domain/clients';
import type { Project, ProjectStage } from '../domain/projects';

export interface MasterSampleData {
  clients: Client[];
  projects: Project[];
  stages: ProjectStage[];
}

export function createMasterSampleData(anchor = new Date()): MasterSampleData {
  const stamp = anchor.toISOString();
  const clients: Client[] = [
    {
      id: 'demo-client-a',
      name: '가상 공공 발주처 A',
      category: '공공기관',
      department: '사업관리부',
      contactName: null,
      phone: null,
      email: null,
      memo: '브라우저 UI 확인용 가상 데이터입니다.',
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'demo-client-b',
      name: '가상 공공 발주처 B',
      category: '공공기관',
      department: null,
      contactName: null,
      phone: null,
      email: null,
      memo: '브라우저 UI 확인용 가상 데이터입니다.',
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];

  const stages: ProjectStage[] = [
    ['interest', '관심사업'], ['planning', '계획'], ['planned-order', '발주예정'],
    ['notice', '입찰공고'], ['pq', 'PQ'], ['soq', 'SOQ'], ['basic-design', '기본설계'],
    ['detailed-design', '실시설계'], ['design-review', '설계심의'], ['price-bid', '가격입찰'],
    ['opening', '개찰'], ['preferred-bidder', '우선협상'], ['won', '수주'], ['lost', '탈락'],
    ['hold', '보류'], ['closed', '종료'],
  ].map(([key, name], index) => ({ key, name, sortOrder: (index + 1) * 10, isActive: true }));

  const projects: Project[] = [
    {
      id: 'demo-project-a', projectCode: 'DEMO-A', name: '가상 A철도 차량기지 건설공사',
      clientId: clients[0].id, clientName: clients[0].name, projectType: '철도', region: '서울',
      contractType: '기술형입찰', estimatedCost: 320000000000, currentStage: 'pq', priority: 'critical',
      assignee: '담당자', expectedBidDate: '2027-03-15', description: '브라우저 UI 확인용 가상 사업입니다.',
      memo: null, url: null, archived: false, createdAt: stamp, updatedAt: stamp,
    },
    {
      id: 'demo-project-b', projectCode: 'DEMO-B', name: '가상 B항만 개발사업',
      clientId: clients[1].id, clientName: clients[1].name, projectType: '항만', region: '부산',
      contractType: '종합심사낙찰제', estimatedCost: 180000000000, currentStage: 'planned-order', priority: 'high',
      assignee: '담당자', expectedBidDate: '2027-05-20', description: '브라우저 UI 확인용 가상 사업입니다.',
      memo: null, url: null, archived: false, createdAt: stamp, updatedAt: stamp,
    },
  ];

  return { clients, projects, stages };
}
