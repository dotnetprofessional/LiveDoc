import { Tag } from 'lucide-react';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { formatTagLabel } from '../lib/filter-utils';

export function TagChips({
  tags,
  className,
  chipClassName,
}: {
  tags: string[] | undefined;
  className?: string;
  chipClassName?: string;
}) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className={cn('px-1.5 py-0 text-xs font-normal', chipClassName)}
        >
          <Tag className="w-3 h-3 mr-1 opacity-60" />
          {formatTagLabel(tag)}
        </Badge>
      ))}
    </div>
  );
}
