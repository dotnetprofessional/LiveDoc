import { Node } from '@livedoc/schema';

export type ContainerKind = 'Feature' | 'Specification' | 'Suite';
export type NavKind = 'Group' | ContainerKind;

export type NavItem =
  | {
      kind: 'Group';
      id: string;
      title: string;
      children: NavItem[];
      status?: string;
    }
  | {
      kind: ContainerKind;
      id: string;
      title: string;
      node: Node;
      children: NavItem[];
      status?: string;
    };

export function isContainerKind(kind: string): kind is ContainerKind {
  return kind === 'Feature' || kind === 'Specification' || kind === 'Suite';
}

function getContainerChildren(node: Node): Node[] {
  if (node.kind !== 'Suite') return [];
  const anyNode = node as any;
  const suiteChildren = (Array.isArray(anyNode.children) ? anyNode.children : []) as Node[];
  return suiteChildren.filter((child) => child && child.kind === 'Suite');
}

function getNodePathSegments(node: Node): string[] {
  const raw = String((node as any).path ?? '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!raw) return [];
  const parts = raw.split('/').filter(Boolean);
  // If it looks like a file path, use directories as groups.
  if (parts.length <= 1) return [];
  return parts.slice(0, -1);
}

function statusRank(status: string): number {
  // Higher is worse / more important.
  switch (status) {
    case 'failed':
    case 'timedOut':
      return 6;
    case 'running':
      return 5;
    case 'pending':
      return 4;
    case 'cancelled':
      return 3;
    case 'skipped':
      return 2;
    case 'passed':
      return 1;
    default:
      return 0;
  }
}

function rollupStatus(statuses: Array<string | undefined>): string | undefined {
  let best: string | undefined;
  let bestRank = -1;
  for (const st of statuses) {
    if (!st) continue;
    const rank = statusRank(st);
    if (rank > bestRank) {
      bestRank = rank;
      best = st;
    }
  }
  return best;
}

function computeNavStatus(item: NavItem): string | undefined {
  if (item.kind !== 'Group') {
    return (item.node.execution?.status as unknown as string | undefined) ?? undefined;
  }
  const statuses: Array<string | undefined> = [];
  const stack = [...item.children];
  while (stack.length > 0) {
    const child = stack.pop();
    if (!child) continue;
    if (child.kind === 'Group') {
      stack.push(...child.children);
    } else {
      statuses.push((child.node.execution?.status as unknown as string | undefined) ?? undefined);
    }
  }
  return rollupStatus(statuses);
}

function sortNavItems(items: NavItem[]): NavItem[] {
  const copy = [...items];
  copy.sort((a, b) => {
    const aIsGroup = a.kind === 'Group';
    const bIsGroup = b.kind === 'Group';
    if (aIsGroup !== bIsGroup) return aIsGroup ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
  return copy;
}

export function buildGroupedNavTree(documents: Node[]): NavItem[] {
  const rootGroup: NavItem & { kind: 'Group' } = {
    kind: 'Group',
    id: 'group:/',
    title: 'Root',
    children: [],
  };
  const root: NavItem[] = [rootGroup];
  const groupById = new Map<string, NavItem & { kind: 'Group' }>();
  groupById.set(rootGroup.id, rootGroup);

  const getOrCreateGroup = (parentChildren: NavItem[], pathParts: string[]): NavItem & { kind: 'Group' } => {
    const id = `group:${pathParts.join('/')}`;
    const existing = groupById.get(id);
    if (existing) return existing;

    const group: NavItem & { kind: 'Group' } = {
      kind: 'Group',
      id,
      title: pathParts[pathParts.length - 1] || 'Group',
      children: [],
    };
    parentChildren.push(group);
    groupById.set(id, group);
    return group;
  };

  for (const node of documents) {
    if (!isContainerKind(node.kind)) continue;

    const pathSegments = getNodePathSegments(node);
    let parentChildren = rootGroup.children;
    const soFar: string[] = [];
    for (const seg of pathSegments) {
      soFar.push(seg);
      const group = getOrCreateGroup(parentChildren, soFar);
      parentChildren = group.children;
    }

    const navNode: NavItem = {
      kind: node.kind as ContainerKind,
      id: node.id,
      title: node.title,
      node,
      children: [],
    };

    // Suite files can contain nested suites; keep that nesting under the suite item.
    if (node.kind === 'Suite') {
      const childSuites = getContainerChildren(node);
      navNode.children = childSuites.map((c) => ({
        kind: 'Suite',
        id: c.id,
        title: c.title,
        node: c,
        children: getContainerChildren(c).map((gc) => ({
          kind: 'Suite',
          id: gc.id,
          title: gc.title,
          node: gc,
          children: [],
        })),
      }));
    }

    parentChildren.push(navNode);
  }

  // Sort recursively (groups first, then alpha)
  const sortRecursive = (items: NavItem[]): NavItem[] => {
    const sorted = sortNavItems(items);
    for (const item of sorted) {
      item.children = sortRecursive(item.children);
      item.status = computeNavStatus(item);
    }
    return sorted;
  };

  return sortRecursive(root);
}

export function findNavItemById(items: NavItem[], id: string): NavItem | undefined {
  const stack = [...items];
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) continue;
    if (item.id === id) return item;
    if (item.children.length > 0) stack.push(...item.children);
  }
  return undefined;
}
