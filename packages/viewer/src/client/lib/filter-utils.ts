import type { AnyTest, TestCase } from '@swedevtools/livedoc-schema';

export function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

export function formatTagLabel(tag: string): string {
  const normalized = normalizeTag(String(tag ?? ''));
  return normalized.startsWith('@') ? normalized.slice(1) : normalized;
}

type Item = TestCase | AnyTest;

function getItemChildrenForTraversal(item: Item): Item[] {
  const anyItem = item as any;

  // TestCase
  if (Array.isArray(anyItem.tests) || anyItem.background) {
    const children: Item[] = [];
    if (anyItem.background) children.push(anyItem.background as AnyTest);
    if (Array.isArray(anyItem.tests)) children.push(...(anyItem.tests as AnyTest[]));
    return children;
  }

  // Scenario
  if (String(anyItem.kind) === 'Scenario' && Array.isArray(anyItem.steps)) {
    return anyItem.steps as AnyTest[];
  }

  // Outlines have template steps too
  const kind = String(anyItem.kind);
  if ((kind === 'ScenarioOutline' || kind === 'RuleOutline') && Array.isArray(anyItem.steps)) {
    return anyItem.steps as AnyTest[];
  }

  return [];
}

export function subtreeHasMatch(node: Item, textQueryLower: string, tagTokens: string[]): boolean {
  const requiresText = textQueryLower.length > 0;
  const requiresTags = tagTokens.length > 0;

  const stack = [node];
  while (stack.length > 0) {
    const n = stack.pop();
    if (!n) continue;

    const titleLower = (n.title ?? '').toLowerCase();
    const tags = ((n as any).tags ?? []) as unknown[];
    const tagsSet = new Set(tags.map((t) => normalizeTag(String(t)).toLowerCase()).filter(Boolean));

    const titleOk = !requiresText || titleLower.includes(textQueryLower);
    const tagsOk = !requiresTags || tagTokens.every((t) => tagsSet.has(t.toLowerCase()));

    if (titleOk && tagsOk) return true;

    for (const child of getItemChildrenForTraversal(n)) stack.push(child);
  }

  return false;
}
