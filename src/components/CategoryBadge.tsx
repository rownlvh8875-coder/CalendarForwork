import type { CategoryKey } from '../domain/calendar';

export interface CategoryBadgeProps {
  categoryKey: CategoryKey;
  label: string;
}

export function CategoryBadge({ categoryKey, label }: CategoryBadgeProps) {
  return (
    <span className="category-badge" data-category={categoryKey}>
      <span className="category-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
