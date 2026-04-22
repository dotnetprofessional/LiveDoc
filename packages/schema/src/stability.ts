/**
 * Simple hash function to generate deterministic IDs.
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generates a deterministic StabilityID for a node based on its hierarchy and attributes.
 */
export function generateStabilityId(params: {
  project: string;
  path?: string;
  title: string;
  kind: string;
  parentId?: string;
  keyword?: string;
  index?: number;
}): string {
  const { project, path, title, kind, parentId, keyword, index } = params;

  // 1. Root Nodes (Feature / Specification / Suite)
  if (!parentId) {
    return simpleHash(`${project}:${path || ''}:${title}`);
  }

  // 2. Leaf Nodes (Step)
  if (kind === 'Step') {
    return `${parentId}:${simpleHash(`${keyword || ''}:${title}:${index ?? 0}`)}`;
  }

  // 3. Child Nodes (Scenario / Rule / Test / etc.)
  // Include `index` when provided to avoid collisions for repeated titles under a parent
  // (e.g., Scenario Outline examples share the same title).
  const indexSuffix = typeof index === 'number' ? `:${index}` : '';
  return `${parentId}:${simpleHash(`${kind}:${title}${indexSuffix}`)}`;
}
