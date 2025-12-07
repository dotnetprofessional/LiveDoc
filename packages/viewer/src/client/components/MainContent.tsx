import { useStore } from '../store';
import { SummaryView, groupFeatures } from './SummaryView';
import { GroupView } from './GroupView';
import { FeatureView } from './FeatureView';
import { ScenarioView } from './ScenarioView';
import { ScenarioOutlineView } from './ScenarioOutlineView';

export function MainContent() {
  const { currentView, navigate, getCurrentRun } = useStore();
  
  const run = getCurrentRun();

  if (!run) {
    return (
      <main className="flex-1 overflow-auto p-6 flex items-center justify-center">
        <div className="text-center text-text-muted">
          <div className="text-5xl mb-4 opacity-50">📋</div>
          <p className="text-lg mb-2">No test results</p>
          <p className="text-sm">Run your tests with the LiveDoc reporter to see results here.</p>
        </div>
      </main>
    );
  }

  // Helper to find group name for a feature
  const findGroupName = (featureId: string): string => {
    const features = run.features || [];
    const groups = groupFeatures(features);
    for (const [groupName, groupFeatures] of Object.entries(groups)) {
      if (groupFeatures.some(f => f.id === featureId)) {
        return groupName;
      }
    }
    return '/';
  };

  // Get current feature if needed
  const feature = currentView.featureId 
    ? (run.features || []).find(f => f.id === currentView.featureId)
    : undefined;

  return (
    <main className="flex-1 overflow-auto p-6">
      {currentView.type === 'summary' && (
        <SummaryView 
          run={run} 
          onGroupClick={(groupName) => navigate('group', groupName)} 
        />
      )}
      
      {currentView.type === 'group' && currentView.groupName && (
        <GroupView 
          run={run} 
          groupName={currentView.groupName}
          onFeatureClick={(featureId) => navigate('feature', currentView.groupName, featureId)}
        />
      )}
      
      {currentView.type === 'feature' && feature && (
        <FeatureView 
          feature={feature}
          groupName={currentView.groupName || findGroupName(feature.id)}
          onScenarioClick={(scenarioId) => navigate('scenario', currentView.groupName, currentView.featureId, scenarioId)}
          onOutlineClick={(outlineId) => navigate('outline', currentView.groupName, currentView.featureId, undefined, outlineId)}
        />
      )}
      
      {currentView.type === 'scenario' && currentView.featureId && currentView.scenarioId && (
        <ScenarioView 
          run={run}
          featureId={currentView.featureId}
          scenarioId={currentView.scenarioId}
        />
      )}

      {currentView.type === 'outline' && currentView.featureId && currentView.outlineId && (
        <ScenarioOutlineView 
          run={run}
          featureId={currentView.featureId}
          outlineId={currentView.outlineId}
        />
      )}
    </main>
  );
}
