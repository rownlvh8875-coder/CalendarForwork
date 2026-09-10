import type { EventCategory } from '../domain/calendar';

export const defaultCategories: EventCategory[] = [
  { id: 'notice', key: 'notice', name: '입찰공고', colorToken: 'notice' },
  { id: 'pq', key: 'pq', name: 'PQ', colorToken: 'pq' },
  { id: 'soq', key: 'soq', name: 'SOQ', colorToken: 'soq' },
  { id: 'site-briefing', key: 'site-briefing', name: '현장설명', colorToken: 'site-briefing' },
  { id: 'design', key: 'design', name: '설계', colorToken: 'design' },
  { id: 'design-review', key: 'design-review', name: '설계심의', colorToken: 'design-review' },
  { id: 'price-bid', key: 'price-bid', name: '가격입찰', colorToken: 'price-bid' },
  { id: 'opening', key: 'opening', name: '개찰', colorToken: 'opening' },
  { id: 'planned-order', key: 'planned-order', name: '발주예정', colorToken: 'planned-order' },
  { id: 'meeting', key: 'meeting', name: '회의', colorToken: 'meeting' },
  { id: 'report', key: 'report', name: '보고', colorToken: 'report' },
  { id: 'submission', key: 'submission', name: '제출마감', colorToken: 'submission' },
  { id: 'other', key: 'other', name: '기타', colorToken: 'other' },
];
