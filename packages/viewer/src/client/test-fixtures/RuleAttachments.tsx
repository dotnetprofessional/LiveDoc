import { createRoot } from 'react-dom/client';
import '../index.css';
import { V1RuleOutlineTestSchema, V1ScenarioOutlineTestSchema } from '@swedevtools/livedoc-schema';
import type { FeatureTestCase, RuleOutlineTest, RuleTest, ScenarioTest, SpecificationTestCase, StepTest } from '@swedevtools/livedoc-schema';
import { NodeView } from '../components/NodeView';
import { OutlineNodeView } from '../components/nodeviews/OutlineNodeView';
import { ScenarioBlock } from '../components/ScenarioBlock';
import { GroupView } from '../components/GroupView';
import { useStore } from '../store';
import type { Run } from '../store';

const rule: RuleTest = {
  id: 'rule-1',
  kind: 'Rule',
  title: 'A rule with evidence',
  execution: {
    status: 'passed',
    duration: 3,
    attachments: [
      { id: 'json', kind: 'file', title: 'order.json', mimeType: 'application/json', base64: 'eyJvcmRlciI6MX0=' },
      { id: 'image', kind: 'image', title: 'chart.png', mimeType: 'image/png', base64: 'iVBORw0KGgo=' },
      { id: 'screenshot', kind: 'screenshot', title: 'capture.png', mimeType: 'image/png', base64: 'iVBORw0KGgo=' },
      { id: 'binary', kind: 'file', title: 'receipt.pdf', mimeType: 'application/pdf', base64: 'UERG' },
    ],
  },
};

const outline: RuleOutlineTest = {
  id: 'outline-1',
  kind: 'RuleOutline',
  title: 'A rule with row evidence',
  execution: { status: 'passed', duration: 0 },
  steps: [
    { id: 'row-evidence-step', kind: 'Step', keyword: 'then', title: 'the result is recorded', execution: { status: 'pending', duration: 0 } },
  ],
  examples: [{
    headers: ['policy'],
    rows: [
      { rowId: 1, values: [{ type: 'string', value: 'standard' }] },
      { rowId: 2, values: [{ type: 'string', value: 'express' }] },
    ],
  }],
  exampleResults: [
    { testId: 'outline-1', result: { rowId: 1, status: 'passed', duration: 1, attachments: [
      { id: 'repeat', kind: 'file', title: 'standard.json', mimeType: 'application/json', base64: 'eyJyb3ciOjF9' },
    ] } },
    { testId: 'outline-1', result: { rowId: 1, status: 'passed', duration: 1, attachments: [
      { id: 'first', kind: 'file', title: 'standard.json', mimeType: 'application/json', base64: 'eyJyb3ciOjF9' },
    ] } },
    { testId: 'row-evidence-step', result: { rowId: 1, status: 'passed', duration: 1, attachments: [
      { id: 'row-step', kind: 'file', title: 'row-step.json', mimeType: 'application/json', base64: 'e30=' },
    ] } },
    { testId: 'other-rule', result: { rowId: 2, status: 'passed', duration: 1, attachments: [
      { id: 'wrong', kind: 'file', title: 'wrong-row.json', mimeType: 'application/json', base64: 'e30=' },
    ] } },
    { testId: 'outline-1', result: { rowId: 2, status: 'passed', duration: 1, attachments: [
      { id: 'second', kind: 'file', title: 'express.json', mimeType: 'application/json', base64: 'eyJyb3ciOjJ9' },
    ] } },
  ],
  statistics: { total: 2, passed: 2, failed: 0, pending: 0, skipped: 0 },
};

const failedRule: RuleTest = {
  id: 'rule-failed',
  kind: 'Rule',
  title: 'A failed rule with evidence',
  execution: { status: 'failed', duration: 1, attachments: [
    { id: 'failure', kind: 'file', title: 'failure.json', mimeType: 'application/json', base64: 'e30=' },
  ] },
};

const emptyRule: RuleTest = {
  ...rule, id: 'rule-empty', title: 'A rule without evidence',
  execution: { status: 'passed', duration: 1, attachments: [] },
};

const emptyOutline: RuleOutlineTest = {
  ...outline,
  id: 'outline-empty',
  title: 'An outline without evidence',
  exampleResults: [
    { testId: 'outline-1', result: { rowId: 1, status: 'passed', duration: 1, attachments: [
      { id: 'other-outline', kind: 'file', title: 'unrelated.json', mimeType: 'application/json', base64: 'e30=' },
    ] } },
  ],
};

const stepEvidenceOutline: RuleOutlineTest = V1RuleOutlineTestSchema.parse({
  id: 'outline-step-evidence',
  kind: 'RuleOutline',
  title: 'An outline with step evidence',
  execution: { status: 'passed', duration: 0 },
  template: {
    steps: [
      { id: 'outline-step-one', kind: 'Step', keyword: 'given', title: 'a policy is selected', execution: {
        status: 'pending', duration: 0, attachments: [
          { id: 'template-step', kind: 'file', title: 'policy.json', mimeType: 'application/json', base64: 'e30=' },
        ],
      } },
      { id: 'outline-step-two', kind: 'Step', keyword: 'then', title: 'the policy is checked', execution: { status: 'pending', duration: 0 } },
    ],
  },
  examples: [{
    headers: ['policy'],
    rows: [
      { rowId: 1, values: [{ type: 'string', value: 'standard' }] },
      { rowId: 2, values: [{ type: 'string', value: 'express' }] },
    ],
  }],
  exampleResults: [
    { testId: 'outline-step-one', result: { rowId: 1, status: 'passed', duration: 1, attachments: [
      { id: 'step-one', kind: 'file', title: 'policy.json', mimeType: 'application/json', base64: 'e30=' },
    ] } },
    { testId: 'outline-step-two', result: { rowId: 1, status: 'passed', duration: 1, attachments: [
      { id: 'step-two', kind: 'file', title: 'check.json', mimeType: 'application/json', base64: 'e30=' },
    ] } },
    { testId: 'outline-step-one', result: { rowId: 99, status: 'passed', duration: 1, attachments: [
      { id: 'unknown-row', kind: 'file', title: 'unknown-row.json', mimeType: 'application/json', base64: 'e30=' },
    ] } },
    { testId: 'another-outline', result: { rowId: 2, status: 'passed', duration: 1, attachments: [
      { id: 'another-outline', kind: 'file', title: 'another-outline.json', mimeType: 'application/json', base64: 'e30=' },
    ] } },
    { testId: 'unknown-step', result: { rowId: 2, status: 'passed', duration: 1, attachments: [
      { id: 'unknown-step', kind: 'file', title: 'unknown-step.json', mimeType: 'application/json', base64: 'e30=' },
    ] } },
  ],
  statistics: { total: 2, passed: 1, failed: 0, pending: 1, skipped: 0 },
});

const scenarioOutline = V1ScenarioOutlineTestSchema.parse({
  id: 'scenario-outline-evidence',
  kind: 'ScenarioOutline',
  title: 'Each scenario example owns its step evidence',
  execution: { status: 'passed', duration: 0 },
  steps: [
    { id: 'scenario-outline-given', kind: 'Step', keyword: 'given', title: 'the example is loaded',
      execution: { status: 'passed', duration: 1, attachments: [
        { id: 'template', kind: 'file', title: 'first.json', mimeType: 'application/json', base64: 'eyJyb3ciOjF9' },
      ] } },
    { id: 'scenario-outline-then', kind: 'Step', keyword: 'then', title: 'the result is recorded',
      execution: { status: 'passed', duration: 1 } },
  ],
  examples: [{
    headers: ['example'],
    rows: [
      { rowId: 1, values: [{ type: 'string', value: 'first' }] },
      { rowId: 2, values: [{ type: 'string', value: 'second' }] },
      { rowId: 3, values: [{ type: 'string', value: 'unattached' }] },
    ],
  }],
  exampleResults: [
    { testId: 'scenario-outline-given', result: { rowId: 1, status: 'passed', duration: 1, attachments: [
      { id: 'first', kind: 'file', title: 'first.json', mimeType: 'application/json', base64: 'eyJyb3ciOjF9' },
    ] } },
    { testId: 'scenario-outline-given', result: { rowId: 2, status: 'passed', duration: 1, attachments: [
      { id: 'second', kind: 'file', title: 'second.json', mimeType: 'application/json', base64: 'eyJyb3ciOjJ9' },
    ] } },
    { testId: 'scenario-outline-evidence', result: { rowId: 3, status: 'passed', duration: 1 } },
    { testId: 'unrelated-step', result: { rowId: 3, status: 'passed', duration: 1, attachments: [
      { id: 'unrelated', kind: 'file', title: 'unrelated.json', mimeType: 'application/json', base64: 'e30=' },
    ] } },
  ],
  statistics: { total: 3, passed: 3, failed: 0, pending: 0, skipped: 0 },
});

const specification: SpecificationTestCase = {
  id: 'specification-1',
  kind: 'Specification',
  title: 'Evidence examples',
  tests: [rule, outline, failedRule, emptyRule, emptyOutline, stepEvidenceOutline],
  statistics: { total: 3, passed: 3, failed: 0, pending: 0, skipped: 0 },
};

const step: StepTest = {
  id: 'step-1',
  kind: 'Step',
  keyword: 'given',
  title: 'a screenshot is recorded',
  execution: {
    status: 'passed',
    duration: 1,
    attachments: [{ id: 'step-image', kind: 'screenshot', title: 'step.png', mimeType: 'image/png', base64: 'iVBORw0KGgo=' }],
  },
};

const scenario: ScenarioTest = {
  id: 'scenario-1',
  kind: 'Scenario',
  title: 'A passed scenario with evidence',
  steps: [step],
  execution: {
    status: 'passed',
    duration: 2,
    attachments: [{ id: 'scenario-file', kind: 'file', title: 'scenario.json', mimeType: 'application/json', base64: 'e30=' }],
  },
};

const emptyScenario: ScenarioTest = {
  ...scenario,
  id: 'scenario-empty',
  title: 'A scenario without evidence',
  steps: [],
  execution: { status: 'passed', duration: 1, attachments: [] },
};

const scenarioOnly: ScenarioTest = {
  ...scenario, id: 'scenario-only', title: 'A scenario with execution evidence only',
  steps: [],
};

const stepOnly: ScenarioTest = {
  ...scenario, id: 'scenario-step-only', title: 'A scenario with step evidence only',
  execution: { status: 'passed', duration: 1, attachments: [] },
};

const feature: FeatureTestCase = {
  id: 'feature-1',
  kind: 'Feature',
  title: 'Scenario examples',
  tests: [scenario, scenarioOnly, stepOnly, emptyScenario],
  statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
};

const run = { run: { documents: [specification, feature] }, itemById: {} } as Run;
const kind = new URLSearchParams(window.location.search).get('kind');
useStore.setState({
  getCurrentRun: () => run,
  currentView: { type: 'group', id: kind === 'feature-list' ? feature.id : specification.id },
});

function NavigationState() {
  const view = useStore((state) => state.currentView);
  return <output data-testid="navigation-state">{`${view.type}:${view.id ?? ''}`}</output>;
}

function ListJourney({ groupId }: { groupId: string }) {
  const view = useStore((state) => state.currentView);
  const selectedNode = [...specification.tests, ...feature.tests].find((test) => test.id === view.id);
  return view.type === 'node' && selectedNode
    ? <NodeView node={selectedNode} />
    : <GroupView run={run} groupId={groupId} />;
}

const component = kind === 'outline'
  ? <OutlineNodeView label="Rule Outline" node={outline} isBusiness={false} tone="scenario" />
  : kind === 'scenario-outline'
    ? <OutlineNodeView label="Scenario Outline" node={scenarioOutline} isBusiness={true} tone="scenario" />
  : kind === 'list'
    ? <ListJourney groupId={specification.id} />
    : kind === 'children'
      ? <NodeView node={specification} />
      : kind === 'feature-list'
        ? <ListJourney groupId={feature.id} />
        : kind === 'feature-children'
          ? <NodeView node={feature} />
  : kind === 'scenario'
    ? <ScenarioBlock label="Scenario" title="Step evidence" steps={[step]} showDurations={false} showErrorStack={false} tone="scenario" />
    : <NodeView node={kind === 'empty-rule'
      ? emptyRule
      : rule} />;

createRoot(document.getElementById('root')!).render(<><NavigationState />{component}</>);
