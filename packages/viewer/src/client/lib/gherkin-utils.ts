import { Scenario, Background } from '../store';

export interface GroupedScenarios {
  regularScenarios: Scenario[];
  outlines: {
    id: string;
    title: string;
    description?: string;
    templateSteps: { type: string; title: string }[];
    examples: Scenario[];
    tags?: string[];
  }[];
  background?: Background;
}

export function groupScenarios(scenarios: Scenario[]): GroupedScenarios {
  const outlineMap = new Map<string, {
    id: string;
    title: string;
    description?: string;
    templateSteps: { type: string; title: string }[];
    examples: Scenario[];
    tags?: string[];
  }>();
  
  // First pass: process ScenarioOutline entries first (they have type='ScenarioOutline' and no outlineId)
  // This ensures we have the template steps with placeholders before processing examples
  for (const scenario of scenarios) {
    if (scenario.type === 'ScenarioOutline' && !scenario.outlineId) {
      outlineMap.set(scenario.id, {
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
        templateSteps: scenario.steps?.map(s => ({ type: s.type, title: s.title })) || [],
        examples: [],
        tags: scenario.tags,
      });
    }
  }
  
  const regularScenarios: Scenario[] = [];
  let background: Background | undefined;
  
  // Second pass: process all other scenarios
  for (const scenario of scenarios) {
    // Skip ScenarioOutline definitions (already processed)
    if (scenario.type === 'ScenarioOutline' && !scenario.outlineId) {
      continue;
    }
    
    // Check if this is a background
    if (scenario.title === 'Background' || scenario.type === 'Background' || scenario.id?.includes('background')) {
      background = {
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
        steps: scenario.steps,
      };
      continue;
    }
    
    // Check if this is part of an outline (has outlineId)
    if (scenario.outlineId) {
      if (!outlineMap.has(scenario.outlineId)) {
        // Fallback: create outline from example (shouldn't happen normally)
        outlineMap.set(scenario.outlineId, {
          id: scenario.outlineId,
          title: getOutlineTitle(scenario.title, scenario.exampleValues || {}),
          description: scenario.description,
          templateSteps: getTemplateSteps(scenario),
          examples: [],
          tags: scenario.tags,
        });
      }
      const outline = outlineMap.get(scenario.outlineId)!;
      outline.examples.push(scenario);

      // If templateSteps are empty (e.g. outline definition didn't have steps), try to populate them from this example
      if (outline.templateSteps.length === 0 && scenario.steps && scenario.steps.length > 0) {
        outline.templateSteps = getTemplateSteps(scenario);
      }
    } else {
      // Regular scenario
      regularScenarios.push(scenario);
    }
  }
  
  return {
    regularScenarios,
    outlines: Array.from(outlineMap.values()),
    background,
  };
}

// Extract outline title by removing example values and "Example N" suffix
export function getOutlineTitle(title: string, exampleValues: Record<string, string>): string {
  // The title might be "Scenario Title: Example 1" or just have actual values
  // First, remove "Example N" suffix or prefix
  let outlineTitle = title
    .replace(/:\s*Example\s*\d+$/i, '')
    .replace(/^(Rule|Example\s+\d+):\s*/i, '')
    .trim();
  
  // Also handle case where title is just "Example 1"
  if (outlineTitle.match(/^Example\s*\d+$/i)) {
    return outlineTitle;
  }
  
  // Try to find and replace values with placeholders
  if (exampleValues && Object.keys(exampleValues).length > 0) {
    // Sort values by length descending to avoid partial matches
    const sortedKeys = Object.keys(exampleValues).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const value = String(exampleValues[key]);
      if (value && value.length > 0) {
        const escapedValue = escapeRegExp(value);
        const regex = new RegExp(escapedValue, 'g');
        outlineTitle = outlineTitle.replace(regex, `<${key}>`);
      }
    }
  }
  
  return outlineTitle;
}

// Get template steps from a scenario (either outline definition or first example)
export function getTemplateSteps(scenario: Scenario): { type: string; title: string }[] {
  if (!scenario.steps) return [];
  
  return scenario.steps.map(step => {
    let templateTitle = step.title;
    
    // If this is an example (has exampleValues), replace actual values with placeholders
    if (scenario.exampleValues) {
      for (const [key, value] of Object.entries(scenario.exampleValues)) {
        if (value && templateTitle.includes(value)) {
          templateTitle = templateTitle.replace(new RegExp(escapeRegExp(value), 'g'), `<${key}>`);
        }
      }
    }
    
    return { type: step.type, title: templateTitle };
  });
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
