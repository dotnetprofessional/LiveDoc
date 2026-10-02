export type JsonValue = string | number | boolean | null | JsonCollection;
export type JsonCollection = JsonValue[] | { [key: string]: JsonValue };

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return typeof value === 'object' && Object.values(value).every(isJsonValue);
}

export function isJsonCollection(value: JsonValue): value is JsonCollection {
  return value !== null && typeof value === 'object';
}

export interface JsonSearchField {
  /** Positions in upstream tree groups, in Object.keys / array order. */
  positions: number[];
  path: (string | number)[];
  part: 'key' | 'value' | 'empty';
  text: string;
  rendered: string;
  ancestors: JsonCollection[];
}

export interface JsonSearchHit {
  field: JsonSearchField;
  ranges: { start: number; end: number }[];
}

export function indexJson(value: JsonValue): JsonSearchField[] {
  const fields: JsonSearchField[] = [];
  const visit = (current: JsonValue, positions: number[], path: (string | number)[], ancestors: JsonCollection[]) => {
    if (!isJsonCollection(current) || Object.keys(current).length === 0) {
      const rendered = JSON.stringify(current);
      fields.push({ positions, path, ancestors, part: isJsonCollection(current) ? 'empty' : 'value',
        text: typeof current === 'string' ? current : rendered, rendered });
      return;
    }
    const nextAncestors = [...ancestors, current];
    if (Array.isArray(current)) {
      current.forEach((child, position) => visit(child, [...positions, position], [...path, position], nextAncestors));
    } else {
      Object.entries(current).forEach(([key, child], position) => {
        const childPositions = [...positions, position];
        const childPath = [...path, key];
        fields.push({ positions: childPositions, path: childPath, ancestors: nextAncestors,
          part: 'key', text: key, rendered: JSON.stringify(key) });
        visit(child, childPositions, childPath, nextAncestors);
      });
    }
  };
  visit(value, [], [], []);
  return fields;
}

// Map case-folded UTF-16 offsets back to the original, including expanding folds
// such as İ, and then to JSON-escaped text without rewriting rendered nodes.
function foldedText(text: string) {
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const character of text) {
    const lower = character.toLowerCase().replace('ς', 'σ');
    for (let index = 0; index < lower.length; index++) {
      starts.push(offset);
      ends.push(offset + character.length);
    }
    folded += lower;
    offset += character.length;
  }
  return { folded, starts, ends };
}

function escapedOffsets(text: string): number[] {
  const offsets = [1];
  let renderedOffset = 1;
  for (const character of text) {
    const escapedLength = JSON.stringify(character).length - 2;
    for (let index = 1; index <= character.length; index++) {
      offsets.push(renderedOffset + Math.min(index, escapedLength));
    }
    renderedOffset += escapedLength;
    offsets[offsets.length - 1] = renderedOffset;
  }
  return offsets;
}

/** One result per key or value field; highlight every non-overlapping substring. */
export function findJsonHits(fields: JsonSearchField[], query: string): JsonSearchHit[] {
  if (!query) return [];
  const needle = foldedText(query).folded;
  const hits: JsonSearchHit[] = [];
  for (const field of fields) {
    const { folded, starts, ends } = foldedText(field.text);
    const offsets = field.rendered.startsWith('"') ? escapedOffsets(field.text) : undefined;
    const ranges: JsonSearchHit['ranges'] = [];
    for (let from = 0; from < folded.length;) {
      const index = folded.indexOf(needle, from);
      if (index < 0) break;
      const start = starts[index];
      const end = ends[index + needle.length - 1];
      ranges.push({ start: offsets?.[start] ?? start, end: offsets?.[end] ?? end });
      from = index + needle.length;
    }
    if (ranges.length) hits.push({ field, ranges });
  }
  return hits;
}

export function jsonFieldLocation(field: JsonSearchField): string {
  return `${field.path.reduce<string>((path, segment) =>
    typeof segment === 'number' ? `${path}[${segment}]` : `${path}[${JSON.stringify(segment)}]`, '$')} (${field.part === 'key' ? 'key' : 'value'})`;
}

/** Read the maintained renderer's semantic tree; never change its nodes or text. */
export function jsonFieldElement(viewport: HTMLElement, field: JsonSearchField): HTMLElement | null {
  if (!viewport.querySelector('[role="tree"]')) return viewport.querySelector('.livedoc-json-value');
  let row = viewport.querySelector<HTMLElement>('[role="tree"] > [role="treeitem"]');
  for (const position of field.positions) {
    row = row?.querySelectorAll<HTMLElement>(':scope > [role="group"] > [role="treeitem"]')[position] ?? null;
  }
  if (!row) return null;
  return row.querySelector<HTMLElement>(field.part === 'key' ? ':scope > .livedoc-json-label'
    : field.part === 'empty' ? ':scope > .livedoc-json-punctuation' : ':scope > .livedoc-json-value');
}

export function jsonHitRanges(element: HTMLElement, hit: JsonSearchHit): Range[] {
  const first = element.firstChild;
  if (!(first instanceof Text)) return [];
  if (hit.field.part === 'empty') {
    const last = element.nextElementSibling?.firstChild;
    if (!(last instanceof Text)) return [];
    return hit.ranges.map(({ start, end }) => {
      const range = document.createRange();
      range.setStart(start < first.length ? first : last, start < first.length ? start : start - first.length);
      range.setEnd(end <= first.length ? first : last, end <= first.length ? end : end - first.length);
      return range;
    });
  }
  return hit.ranges.map(({ start, end }) => {
    const range = document.createRange();
    range.setStart(first, start);
    range.setEnd(first, end);
    return range;
  });
}
