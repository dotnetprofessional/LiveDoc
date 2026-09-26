import { createRoot } from 'react-dom/client';
import { V1TestCaseSchema } from '@swedevtools/livedoc-schema';
import type { FeatureTestCase } from '@swedevtools/livedoc-schema';
import { NodeView } from '../components/NodeView';
import { useStore } from '../store';
import type { Run } from '../store';
import '../index.css';

const feature = V1TestCaseSchema.parse({
  id: 'feature-background',
  kind: 'Feature',
  title: 'Shared setup',
  background: {
    id: 'feature-background:background',
    kind: 'Background',
    title: 'Shared setup',
    execution: { status: 'passed', duration: 2 },
    steps: [
      { id: 'background-given', kind: 'Step', keyword: 'given', title: 'the account starts with 10 credits', execution: { status: 'passed', duration: 1 } },
      { id: 'background-and', kind: 'Step', keyword: 'and', title: 'the account is ready', execution: { status: 'passed', duration: 1 } },
    ],
  },
  tests: [{
    id: 'scenario-own-given',
    kind: 'Scenario',
    title: 'A scenario adds its own Given',
    execution: { status: 'passed', duration: 3 },
    steps: [
      { id: 'scenario-given', kind: 'Step', keyword: 'given', title: 'the account receives 2 more credits', execution: { status: 'passed', duration: 1 } },
      { id: 'scenario-when', kind: 'Step', keyword: 'when', title: 'the balance is checked', execution: { status: 'passed', duration: 1 } },
      { id: 'scenario-then', kind: 'Step', keyword: 'then', title: 'the balance is 12 credits', execution: { status: 'passed', duration: 1 } },
    ],
  }],
  statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
}) as FeatureTestCase;

const run: Run = {
  run: {
    protocolVersion: '1.0',
    runId: 'background-fixture',
    project: 'Viewer',
    environment: 'test',
    framework: 'xunit',
    timestamp: '2026-01-01T00:00:00Z',
    duration: 3,
    status: 'passed',
    summary: feature.statistics,
    documents: [feature],
  },
  itemById: {},
};

useStore.setState({
  getCurrentRun: () => run,
  currentView: { type: 'node', id: feature.id },
});

function Preview() {
  const selectedId = useStore((state) => state.currentView.id);
  const selectedScenario = feature.tests.find((test) => test.id === selectedId);
  return <NodeView node={selectedScenario ?? feature} />;
}

createRoot(document.getElementById('root')!).render(<Preview />);
