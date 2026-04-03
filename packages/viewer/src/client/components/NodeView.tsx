import type { AnyTest, Statistics, Status, StepTest, TestCase } from '@swedevtools/livedoc-schema';
import { StepList } from './StepList';
import { useStore } from '../store';
import { renderTitle, stripLeadingKindLabel } from '../lib/title-utils';
import { cn } from '../lib/utils';
import { useMemo } from 'react';
import { buildGroupedNavTree, findNavPath, NavItem } from '../lib/nav-tree';
import { ScenarioBlock } from './ScenarioBlock';
import { ContainerHeader } from './nodeviews/ContainerHeader';
import { ChildrenList } from './nodeviews/ChildrenList';
import { FailureSummary } from './nodeviews/FailureSummary';
import { OutlineNodeView } from './nodeviews/OutlineNodeView';
import { statusFromStats } from '../lib/status-utils';

interface NodeViewProps {
  node: TestCase | AnyTest;
}

export function NodeView({ node }: NodeViewProps) {
  const { navigate, audienceMode, getCurrentRun } = useStore();

  const runState = getCurrentRun();
  const run = runState?.run;
  const kind = String((node as any).kind ?? (node as any).style ?? '').toLowerCase();
  const isBusiness = audienceMode === 'business';

  const isTestCaseNode = (n: TestCase | AnyTest): n is TestCase => {
    return (n as any)?.style !== undefined && Array.isArray((n as any)?.tests);
  };

  const isContainer = isTestCaseNode(node);
  const isOutline = kind === 'scenariooutline' || kind === 'ruleoutline';

  // Build nav tree for breadcrumbs
  const navTree = useMemo(() => run ? buildGroupedNavTree(run.documents ?? []) : [], [run?.documents]);

  // Given any node (Rule/Scenario/Step/etc), find the owning top-level container (Feature/Specification/Suite)
  // by scanning documents.
  const containerTestCase = useMemo<TestCase | undefined>(() => {
    if (!run?.documents) return undefined;

    const isTestCase = (n: any) => n?.style !== undefined && Array.isArray(n?.tests);

    const containsId = (n: any): boolean => {
      if (!n) return false;
      if (n.id === node.id) return true;

      const children =
        (n.tests as any[] | undefined) ??
        (n.children as any[] | undefined) ??
        (n.steps as any[] | undefined);
      if (Array.isArray(children)) {
        for (const c of children) {
          if (containsId(c)) return true;
        }
      }

      const examples = n.examples as any[] | undefined;
      if (Array.isArray(examples)) {
        for (const e of examples) {
          if (containsId(e)) return true;
        }
      }

      const template = (n as any).template;
      if (template && containsId(template)) return true;

      return false;
    };

    for (const doc of run.documents) {
      if (isTestCase(doc) && containsId(doc)) return doc as TestCase;
    }
    return undefined;
  }, [run?.documents, node.id]);

  const feature = useMemo<TestCase | undefined>(() => {
    const style = String((containerTestCase as any)?.style ?? (containerTestCase as any)?.kind ?? '').toLowerCase();
    return style === 'feature' ? containerTestCase : undefined;
  }, [containerTestCase]);

  const background = useMemo<AnyTest | undefined>(() => {
    if (!feature) return undefined;

    return feature.background as AnyTest | undefined;
  }, [feature]);

  // Get breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (containerTestCase) {
      const path = findNavPath(navTree, containerTestCase.id);
      return path || [];
    }
    if (isContainer) {
      const path = findNavPath(navTree, node.id);
      return path || [];
    }
    return [];
  }, [navTree, containerTestCase, node.id, isContainer]);

  const children = isTestCaseNode(node)
    ? ((node.tests ?? []) as AnyTest[])
    : ('children' in (node as any) ? (node as any).children : undefined);

  const isLeafContainer = ['scenario', 'background', 'rule', 'test'].includes(kind);
  const steps = Array.isArray((node as any).steps)
    ? ((node as any).steps as AnyTest[])
    : (isLeafContainer ? (children as AnyTest[] | undefined) : undefined);

  const stepTests = useMemo(() => {
    const arr = (steps ?? []) as AnyTest[];
    return arr.filter((t): t is StepTest => typeof (t as any)?.keyword === 'string');
  }, [steps]);
  const showCards = Array.isArray(children) && !isLeafContainer;

  const kindPrefixTitle = (kindLabel: string, title: string) => `${kindLabel}: ${title}`;

  const highlightValues = undefined;

  const isScenarioView = !!feature && kind === 'scenario';
  const containerStyle = String((containerTestCase as any)?.style ?? (containerTestCase as any)?.kind ?? '').toLowerCase();
  const isSpecificationContainer = containerStyle === 'specification';
  const isRuleView = isSpecificationContainer && kind === 'rule';
  const isRuleOutlineView = isSpecificationContainer && kind === 'ruleoutline';

  // Outline rendering and exception UI are now isolated in OutlineNodeView.

  // Determine the container to display as header (same style as GroupView)
  const containerNode = containerTestCase || (isContainer ? node : undefined);
  const containerTitle = (containerNode as any)?.title || '';
  const containerDescription = (containerNode as any)?.description;
  const containerTags = (((containerNode as any)?.tags ?? []) as string[]) || [];

  const hasContainerMeta =
    (typeof containerDescription === 'string' && containerDescription.trim().length > 0) ||
    containerTags.length > 0;

  const containerStatus = statusFromStats((containerNode as any)?.statistics as Statistics | undefined);
  const environment = run?.environment || 'local';

  const containerTitleWithKind = containerNode
    ? (String((containerNode as any).style ?? (containerNode as any).kind ?? '').toLowerCase() === 'feature'
      ? kindPrefixTitle('Feature', containerTitle)
      : containerTitle)
    : '';

  // renderOutline/renderChildren extracted into nodeviews/* components.

  return (
    <div className={cn(hasContainerMeta ? 'space-y-6' : 'space-y-4')}>
      <ContainerHeader
        breadcrumbs={breadcrumbs.map((b) => ({ id: b.id, title: b.title }))}
        isContainer={isContainer}
        navigate={navigate}
        containerTitleWithKind={containerTitleWithKind || containerTitle}
        containerTitle={containerTitle}
        environment={environment}
        containerStatus={containerStatus}
        containerDescription={typeof containerDescription === 'string' ? containerDescription : undefined}
        containerTags={containerTags}
      />

      {/* ========== BACKGROUND ========== */}
      {background && (
        <div className="space-y-3">
          <ScenarioBlock
            label="Background"
            title={renderTitle(stripLeadingKindLabel(String(background.title ?? ''), 'Background'))}
            status={(background as any).execution?.status as Status | undefined}
            description={background.description}
            tags={(background as any).tags}
            steps={(((background as any).steps || (background as any).children) ?? []) as StepTest[]}
            showDurations={!isBusiness}
            showErrorStack={!isBusiness}
            tone="background"
          />
        </div>
      )}

      {/* ========== SCENARIO SECTION (when viewing a child of a Feature) ========== */}
      {feature && !isTestCaseNode(node) && kind === 'scenario' && (
        <div className="space-y-3">
          <ScenarioBlock
            label="Scenario"
            title={renderTitle(stripLeadingKindLabel(String(node.title ?? ''), 'Scenario'), highlightValues)}
            status={(node as any).execution?.status as Status | undefined}
            description={node.description}
            tags={node.tags}
            steps={stepTests}
            highlightValues={highlightValues}
            showDurations={!isBusiness}
            showErrorStack={!isBusiness}
            tone="scenario"
          />
        </div>
      )}

      {/* ========== RULE SECTION (when viewing a child of a Specification) ========== */}
      {isSpecificationContainer && !isTestCaseNode(node) && kind === 'rule' && (
        <div className="space-y-3">
          <ScenarioBlock
            label="Rule"
            title={renderTitle(stripLeadingKindLabel(String(node.title ?? ''), 'Rule'))}
            status={(node as any).execution?.status as Status | undefined}
            description={node.description}
            tags={node.tags}
            steps={stepTests}
            showDurations={!isBusiness}
            showErrorStack={!isBusiness}
            tone="scenario"
          />
        </div>
      )}

      {/* ========== SCENARIO OUTLINE SECTION ========== */}
      {feature && !isTestCaseNode(node) && kind === 'scenariooutline' && (
        <OutlineNodeView
          label="Scenario Outline"
          node={node as any}
          isBusiness={isBusiness}
          tone="scenario"
          featurePath={typeof (feature as any)?.path === 'string' ? String((feature as any).path) : undefined}
        />
      )}

      {/* ========== RULE OUTLINE SECTION (Specification) ========== */}
      {isSpecificationContainer && !isTestCaseNode(node) && kind === 'ruleoutline' && (
        <OutlineNodeView
          label="Rule Outline"
          node={node as any}
          isBusiness={isBusiness}
          tone="scenario"
          featurePath={typeof (containerTestCase as any)?.path === 'string' ? String((containerTestCase as any).path) : undefined}
        />
      )}

      {/* ========== FAILURE SUMMARY ========== */}
      <FailureSummary
        node={node as any}
        isBusiness={isBusiness}
        isTestCaseNode={isTestCaseNode(node)}
        isOutline={isOutline}
      />

      {/* ========== STEPS ========== */}
      {steps && steps.length > 0 && !isScenarioView && !isRuleView && !isOutline && (
        <StepList
          steps={stepTests}
          highlightValues={highlightValues}
          showDurations={!isBusiness}
          showErrorStack={!isBusiness}
        />
      )}

      {/* ========== OUTLINES (ScenarioOutline / RuleOutline) ========== */}
      {kind === 'ruleoutline' && !isRuleOutlineView ? (
        <OutlineNodeView
          label="Rule Outline"
          node={node as any}
          isBusiness={isBusiness}
          tone="scenario"
          featurePath={typeof (containerTestCase as any)?.path === 'string' ? String((containerTestCase as any).path) : undefined}
        />
      ) : null}

      {/* ========== CHILDREN (when viewing a container) ========== */}
      <ChildrenList
        children={children as AnyTest[] | undefined}
        showCards={showCards}
        filterText=""
        filterTags={[]}
        navigate={navigate}
        isSpecificationContainer={isSpecificationContainer}
      />
    </div>
  );
}
