import { Run, Feature } from '../store';
import { Breadcrumb } from './Breadcrumb';
import { ItemList } from './ItemList';
import { StatsBar } from './StatsBar';
import { groupFeatures, getFeatureStats } from './SummaryView';

interface GroupViewProps {
  run: Run;
  groupName: string;
  onFeatureClick: (featureId: string) => void;
}

export function GroupView({ run, groupName, onFeatureClick }: GroupViewProps) {
  const features = run.features || [];
  const groups = groupFeatures(features);
  const groupFeatureList = groups[groupName] || [];
  const displayName = formatGroupDisplayName(groupName);

  // Calculate group totals
  const groupTotals = groupFeatureList.reduce((acc, f) => {
    const stats = getFeatureStats(f);
    acc.passed += stats.passed;
    acc.failed += stats.failed;
    acc.pending += stats.pending;
    acc.duration += f.duration || 0;
    return acc;
  }, { passed: 0, failed: 0, pending: 0, duration: 0 });

  const featureItems = groupFeatureList.map(f => {
    const stats = getFeatureStats(f);
    const total = stats.passed + stats.failed + stats.pending;
    const status = stats.failed > 0 ? 'fail' : stats.pending > 0 ? 'pending' : 'pass';

    return {
      id: f.id,
      name: f.title,
      status: status as 'pass' | 'fail' | 'pending',
      count: total,
      passed: stats.passed,
      failed: stats.failed,
      pending: stats.pending,
      duration: f.duration,
    };
  });

  return (
    <div className="max-w-5xl mx-auto">
      <Breadcrumb />
      
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-text">{displayName}</h1>
        <div className="text-sm text-text-secondary mt-1">
          {groupFeatureList.length} feature{groupFeatureList.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar 
        passed={groupTotals.passed}
        failed={groupTotals.failed}
        pending={groupTotals.pending}
        duration={groupTotals.duration}
        label="scenarios"
      />

      {/* Features List */}
      <ItemList 
        type="Feature"
        items={featureItems}
        onItemClick={onFeatureClick}
      />
    </div>
  );
}

function formatGroupDisplayName(groupName: string): string {
  if (groupName === '/') return 'Root';
  return groupName
    .split('/')
    .map((segment) => (segment.startsWith('_') ? segment : segment.replace(/_/g, ' ')))
    .join('/');
}
