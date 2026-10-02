// @ts-check
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import xml from 'xml-js';

const libraries = {
  vitest: {label: 'Vitest SDK', source: ['packages', 'vitest', 'package.json']},
  xunit: {label: 'xUnit SDK', source: ['dotnet', 'xunit', 'livedoc-xunit.csproj']},
  viewer: {label: 'LiveDoc Viewer', source: ['packages', 'viewer', 'package.json']},
  vscode: {label: 'VS Code extension', source: ['packages', 'vscode', 'package.json']},
};

/**
 * @param {unknown} value
 * @param {string} source
 * @param {boolean} nuget
 */
function requireVersion(value, source, nuget = false) {
  const number = '(?:0|[1-9]\\d*)';
  const numericPart = nuget ? '\\d+(?:\\.\\d+){2,3}' : `${number}\\.${number}\\.${number}`;
  const prerelease = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
  const build = '[0-9A-Za-z-]+';
  const pattern = new RegExp(`^${numericPart}(?:-${prerelease}(?:\\.${prerelease})*)?(?:\\+${build}(?:\\.${build})*)?$`);
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new Error(`Missing or invalid library version in ${source}: ${String(value)}`);
  }
  return value;
}

/**
 * @param {string} content
 * @param {string} source
 */
export function readProjectVersion(content, source = 'xUnit project') {
  const document = /** @type {import('xml-js').Element} */ (xml.xml2js(content, {compact: false, trim: true}));
  const projects = document.elements?.filter(element => element.type === 'element' && element.name === 'Project') ?? [];
  if (projects.length !== 1) {
    throw new Error(`Expected one Project element in ${source}`);
  }

  const properties = projects[0].elements
    ?.filter(element => element.type === 'element' && element.name === 'PropertyGroup')
    .flatMap(group => (group.elements ?? []).map(element => ({group, element}))) ?? [];

  /** @param {string} name */
  function property(name) {
    const matches = properties.filter(({element}) => element.type === 'element' && element.name === name);
    if (matches.length === 0) return undefined;
    if (matches.length !== 1 || matches[0].group.attributes?.Condition !== undefined || matches[0].element.attributes?.Condition !== undefined) {
      throw new Error(`Expected one unconditional ${name} property in ${source}`);
    }
    const nodes = matches[0].element.elements ?? [];
    if (nodes.some(node => !['text', 'cdata', 'comment'].includes(node.type ?? ''))) {
      throw new Error(`Expected a literal ${name} property in ${source}`);
    }
    return nodes.filter(node => node.type === 'text' || node.type === 'cdata')
      .map(node => node.text ?? node.cdata ?? '').join('').trim();
  }

  const version = property('Version');
  if (version !== undefined) return requireVersion(version, source, true);
  const prefix = property('VersionPrefix');
  const suffix = property('VersionSuffix');
  return requireVersion(prefix === undefined ? undefined : `${prefix}${suffix ? `-${suffix}` : ''}`, source, true);
}

/**
 * @param {string} repoRoot
 * @param {(path: string) => string} readSource
 * @returns {import('./src/utils/libraryVersions').LibraryVersions}
 */
export function loadLibraryVersions(repoRoot, readSource = path => readFileSync(path, 'utf8')) {
  return /** @type {import('./src/utils/libraryVersions').LibraryVersions} */ (Object.fromEntries(Object.entries(libraries).map(([id, {label, source}]) => {
    const sourcePath = join(repoRoot, ...source);
    const content = readSource(sourcePath);
    const version = id === 'xunit'
      ? readProjectVersion(content, sourcePath)
      : requireVersion(JSON.parse(content).version, sourcePath);
    return [id, {label, version}];
  })));
}
