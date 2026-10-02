import ReactDOM from 'react-dom/client';
import App from '../App';
import { standardRun } from './standard-report';
import '../index.css';
import type { Status } from '@swedevtools/livedoc-schema';

const params = new URLSearchParams(location.search);
const run = standardRun(params.has('detailed'), params.has('container') ? 'Container' : 'Standard');
const statuses: Status[] = ['passed', 'failed', 'skipped', 'pending', 'running', 'timedOut', 'cancelled'];
const status = statuses.find(value => value === params.get('status'));
if (status) {
  run.documents[0]!.tests[0]!.execution.status = status;
  if (status === 'timedOut') run.documents[0]!.tests[0]!.execution.error = { message: 'The native test timed out' };
}
if (params.has('qualified')) {
  for (const test of run.documents[0]!.tests) {
    const title = test.title.includes('(') ? test.title : test.title.replace(/ /g, '_');
    test.title = `Example.Native.PlainTests.${title}`;
  }
}
Object.assign(window, { __LIVEDOC_DATA__: run });
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
