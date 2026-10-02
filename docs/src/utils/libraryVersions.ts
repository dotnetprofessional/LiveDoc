export const libraryIds = ['vitest', 'xunit', 'viewer', 'vscode'] as const;

export type LibraryId = (typeof libraryIds)[number];
export type LibraryVersion = {label: string; version: string};
export type LibraryVersions = Record<LibraryId, LibraryVersion>;
export type DocsCustomFields = {libraryVersions: LibraryVersions};

export function getLibraryVersion(docId: string, versions: LibraryVersions): LibraryVersion | undefined {
  const section = docId.replace(/^\/+/, '').split('/')[0];
  const library = libraryIds.find(id => id === section);
  return library ? versions[library] : undefined;
}

export function resolveLibraryCode(code: string, library: LibraryId, versions: LibraryVersions): string {
  return code.replaceAll('{{libraryVersion}}', versions[library].version);
}
