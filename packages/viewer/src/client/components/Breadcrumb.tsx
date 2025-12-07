import { useStore, Feature, Scenario } from '../store';
import { groupFeatures } from './SummaryView';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

export function Breadcrumb() {
  const { currentView, navigate, getCurrentRun } = useStore();
  const run = getCurrentRun();

  if (!run || currentView.type === 'summary') {
    return null;
  }

  const features = run.features || [];
  const groups = groupFeatures(features);
  
  // If we have a feature but no group, find the group
  let groupName = currentView.groupName;
  if (!groupName && currentView.featureId) {
    for (const [name, groupFeatures] of Object.entries(groups)) {
      if (groupFeatures.some(f => f.id === currentView.featureId)) {
        groupName = name;
        break;
      }
    }
  }

  const items: BreadcrumbItem[] = [];

  // Always start with Summary
  items.push({
    label: run.project || 'Summary',
    onClick: () => navigate('summary'),
  });

  // Add Group if we're in group, feature, scenario, or outline view
  if (groupName && ['group', 'feature', 'scenario', 'outline'].includes(currentView.type)) {
    const displayGroup = groupName === '/' ? 'Root' : groupName.replace(/_/g, ' ');
    items.push({
      label: displayGroup,
      onClick: currentView.type === 'group' ? undefined : () => navigate('group', groupName),
    });
  }

  // Add Feature if we're in feature, scenario, or outline view
  if (currentView.featureId && ['feature', 'scenario', 'outline'].includes(currentView.type)) {
    const feature = findFeature(features, currentView.featureId);
    if (feature) {
      items.push({
        label: feature.title,
        onClick: currentView.type === 'feature' ? undefined : () => navigate('feature', groupName, currentView.featureId),
      });
    }
  }

  // Add Scenario if we're in scenario view
  if (currentView.scenarioId && currentView.type === 'scenario') {
    const feature = findFeature(features, currentView.featureId || '');
    const scenario = feature?.scenarios.find(s => s.id === currentView.scenarioId);
    if (scenario) {
      items.push({
        label: scenario.title,
      });
    }
  }

  // Add Outline if we're in outline view
  if (currentView.outlineId && currentView.type === 'outline') {
    const feature = findFeature(features, currentView.featureId || '');
    if (feature) {
      // Find the outline title from ScenarioOutline entry
      const outline = feature.scenarios.find(s => s.id === currentView.outlineId && s.type === 'ScenarioOutline');
      if (outline) {
        items.push({
          label: outline.title,
        });
      }
    }
  }

  return (
    <nav className="flex items-center gap-2 text-sm mb-4">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          {index > 0 && (
            <span className="text-text-muted">›</span>
          )}
          {item.onClick ? (
            <button
              className="text-accent hover:underline cursor-pointer"
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ) : (
            <span className="text-text-secondary">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function findFeature(features: Feature[], featureId: string): Feature | undefined {
  return features.find(f => f.id === featureId);
}
