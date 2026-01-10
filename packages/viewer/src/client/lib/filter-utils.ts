import { Node } from '@livedoc/schema';

export function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

export function formatTagLabel(tag: string): string {
  const normalized = normalizeTag(String(tag ?? ''));
  return normalized.startsWith('@') ? normalized.slice(1) : normalized;
}

function getNodeChildrenForTraversal(node: Node): Node[] {
  const children: Node[] = [];
  const anyNode = node as any;
  if (Array.isArray(anyNode.children)) children.push(...anyNode.children);
  if (Array.isArray(anyNode.examples)) children.push(...anyNode.examples);
  if (anyNode.template) children.push(anyNode.template);
  if (anyNode.background) children.push(anyNode.background);
  return children;
}

export function subtreeHasMatch(node: Node, textQueryLower: string, tagTokens: string[]): boolean {
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

    for (const child of getNodeChildrenForTraversal(n)) stack.push(child);
  }

  return false;
}
