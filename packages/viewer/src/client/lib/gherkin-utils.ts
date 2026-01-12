export interface GroupedScenarios {
  regularScenarios: unknown[];
  outlines: {
    id: string;
    title: string;
    description?: string;
    templateSteps: unknown[];
    examples: unknown[];
    tags?: string[];
  }[];
  background?: unknown;
}

/**
 * Groups Feature children into regular Scenarios and ScenarioOutlines.
 *
 * Note: In the current schema, Feature.background is a separate property; this helper keeps
 * a `background` field for back-compat with older UI code paths.
 */
export function groupScenarios(nodes: Array<any>, background?: any): GroupedScenarios {
  const regularScenarios: unknown[] = [];
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

export function getOutlineTemplateSteps(outline: any): unknown[] {
  const template = outline?.template;
  const steps = template?.steps;
  if (Array.isArray(steps)) return steps;

  const children = template?.children;
  if (Array.isArray(children)) return children;

  return [];
}
