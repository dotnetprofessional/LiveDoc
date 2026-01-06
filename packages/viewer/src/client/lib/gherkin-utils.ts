import { Scenario, ScenarioOutline, Step } from '@livedoc/schema';

export interface GroupedScenarios {
  regularScenarios: Scenario[];
  outlines: {
    id: string;
    title: string;
    description?: string;
    templateSteps: Step[];
    examples: Scenario[];
    tags?: string[];
  }[];
  background?: Scenario;
}

/**
 * Groups Feature children into regular Scenarios and ScenarioOutlines.
 *
 * Note: In the current schema, Feature.background is a separate property; this helper keeps
 * a `background` field for back-compat with older UI code paths.
 */
export function groupScenarios(nodes: Array<Scenario | ScenarioOutline>, background?: Scenario): GroupedScenarios {
  const regularScenarios: Scenario[] = [];
  const outlines: GroupedScenarios['outlines'] = [];

  for (const node of nodes) {
    if (node.kind === 'Scenario') {
      regularScenarios.push(node);
      continue;
    }

    if (node.kind === 'ScenarioOutline') {
      outlines.push({
        id: node.id,
        title: node.title,
        description: node.description,
        templateSteps: getOutlineTemplateSteps(node),
        examples: node.examples ?? [],
        tags: node.tags,
      });
    }
  }

  return { regularScenarios, outlines, background };
}

export function getOutlineTemplateSteps(outline: ScenarioOutline): Step[] {
  const template = outline.template;
  const children = (template as any).children;
  return Array.isArray(children) ? (children as Step[]) : [];
}
