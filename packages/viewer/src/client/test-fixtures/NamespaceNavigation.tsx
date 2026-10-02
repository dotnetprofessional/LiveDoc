import ReactDOM from 'react-dom/client';
import App from '../App';
import { namespaceRun, SHARED_NAMESPACE } from './namespace-report';
import { makeRunState, useStore } from '../store';
import '../index.css';

const params = new URLSearchParams(location.search);
const run = namespaceRun();
if (params.get('framework') === 'vitest') run.framework = 'vitest';
if (params.has('deep')) {
  run.documents[4]!.path = `${SHARED_NAMESPACE}/ResourceProviders/Billing/Lifecycle/Renewals/LongTransactionAuthorizationPolicies/Check5.cs`;
}
if (run.framework === 'vitest') {
  for (const document of run.documents) {
    document.path = document.path?.replace(/\.cs$/, '.Spec.ts');
    if (params.has('trimmed')) document.path = document.path?.slice(SHARED_NAMESPACE.length + 1);
  }
}
if (params.has('single')) run.documents = run.documents.slice(0, 1);
if (params.has('single')) run.summary = { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 };
if (params.has('partial')) {
  run.runType = 'partial';
  run.baselineRunId = 'namespace-baseline';
}
Object.assign(window, {
  ...(params.has('live') ? {} : { __LIVEDOC_DATA__: run }),
  ...(params.has('embedded') ? { __LIVEDOC_CONFIG__: { mode: 'embedded' } } : {}),
  __NAVIGATION_FIXTURE__: {
    store: useStore,
    installPhysical: () => {
      const physical = structuredClone(run);
      physical.documents = physical.documents.slice(0, 4);
      physical.summary = { total: 4, passed: 4, failed: 0, pending: 0, skipped: 0 };
      useStore.getState().upsertPhysicalRun(run.runId, makeRunState(physical));
    },
  },
});
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
