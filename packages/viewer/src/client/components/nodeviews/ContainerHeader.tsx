import type { Status } from '@swedevtools/livedoc-schema';
import { ChevronRight, Home, Tag } from 'lucide-react';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { Markdown } from '../Markdown';
import { StatusBadge } from '../StatusBadge';
import { formatTagLabel } from '../../lib/filter-utils';

export interface ContainerHeaderBreadcrumb {
  id: string;
  title: string;
}

export interface ContainerHeaderProps {
  breadcrumbs: ContainerHeaderBreadcrumb[];
  isContainer: boolean;
  navigate: (kind: 'group' | 'node', id: string) => void;

  containerTitleWithKind?: string;
  containerTitle: string;
  environment: string;
  containerStatus?: Status;

  containerDescription?: string;
  containerTags: string[];
}

export function ContainerHeader({
  breadcrumbs,
  isContainer,
  navigate,
  containerTitleWithKind,
  containerTitle,
  environment,
  containerStatus,
  containerDescription,
  containerTags,
}: ContainerHeaderProps) {
  return (
    <div className="space-y-2">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2 overflow-hidden">
        {breadcrumbs.length > 0 ? (() => {
          // Container pages (Feature/Specification/Suite) should not show a non-clickable final crumb.
          // Scenario pages should include the owning Feature (clickable), but not the current Scenario.
          const crumbs = isContainer ? breadcrumbs.slice(0, -1) : breadcrumbs;
          
          // If no crumbs remain after slicing, show the home-only fallback
          if (crumbs.length === 0) {
            return (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => navigate('group', 'group:/')}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors px-1 py-0.5 rounded-md hover:bg-muted/50"
                >
                  <Home className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          }

          return crumbs.map((item, index) => {
            const isRoot = item.title === 'Root' && index === 0;

            return (
              <div key={item.id} className="flex items-center gap-1 shrink-0">
                {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
                <button
                  onClick={() => navigate('group', item.id)}
                  className={cn(
                    "flex items-center gap-1.5 hover:text-foreground transition-colors truncate px-1 py-0.5 rounded-md hover:bg-muted/50",
                    ""
                  )}
                >
                  {isRoot ? (
                    <>
                      <Home className="w-3.5 h-3.5" />
                      <span>Root</span>
                    </>
                  ) : item.title}
                </button>
              </div>
            );
          });
        })() : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => navigate('group', 'group:/')}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors px-1 py-0.5 rounded-md hover:bg-muted/50"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </nav>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{containerTitleWithKind || containerTitle}</h1>
        <div className="flex items-center gap-3">
          {environment && (
            <Badge variant="outline" className="text-muted-foreground font-normal border-border bg-muted/20">
              {environment}
            </Badge>
          )}
          {containerStatus && <StatusBadge status={containerStatus} size="lg" showLabel />}
        </div>
      </div>

      {containerDescription && <Markdown content={containerDescription} className="max-w-3xl" />}

      {containerTags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {containerTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-xs font-normal">
              <Tag className="w-3 h-3 mr-1 opacity-60" />
              {formatTagLabel(tag)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
