import { ErrorDisplay } from '../ErrorDisplay';

export interface FailureSummaryProps {
  node: any;
  isBusiness: boolean;
  isTestCaseNode: boolean;
  isOutline: boolean;
}

export function FailureSummary({ node, isBusiness, isTestCaseNode, isOutline }: FailureSummaryProps) {
  if (isTestCaseNode) return null;
  if (isOutline) return null;
  if ((node as any).execution?.status !== 'failed') return null;
  if (!(node as any).execution?.error) return null;

  return (
    <ErrorDisplay
      error={(node as any).execution.error}
      title="Failure Summary"
      isBusiness={isBusiness}
      variant="card"
    />
  );
}
