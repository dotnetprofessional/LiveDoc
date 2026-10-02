import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import ts from 'typescript';
import {loadLibraryVersions, readProjectVersion} from '../libraryVersions.mjs';

const routeModule = ts.transpileModule(
  readFileSync(new URL('../src/utils/libraryVersions.ts', import.meta.url), 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}},
).outputText;
const {getLibraryVersion, resolveLibraryCode} = await import(`data:text/javascript;base64,${Buffer.from(routeModule).toString('base64')}`);
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

const sourceVersions = {
  vitest: '1.2.3',
  viewer: '4.5.6',
  vscode: '7.8.9',
  xunit: '1.2.3.4',
};
function fixtureReader(versions) {
  return path => {
    if (basename(path) === 'livedoc-xunit.csproj') {
      return `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><Version>${versions.xunit}</Version></PropertyGroup></Project>`;
    }
    const section = path.split(/[\\/]/).at(-2);
    return JSON.stringify({version: versions[section]});
  };
}

const versions = loadLibraryVersions(repoRoot, fixtureReader(sourceVersions));
for (const [section, label] of Object.entries({
  vitest: 'Vitest SDK',
  xunit: 'xUnit SDK',
  viewer: 'LiveDoc Viewer',
  vscode: 'VS Code extension',
})) {
  for (const docId of [`${section}/index`, `/${section}`, `/${section}/`, `${section}/learn/getting-started`, `/${section}/reference/configuration`]) {
    test(`'${docId}' selects '${label}' v'${sourceVersions[section]}'`, () => {
      assert.deepEqual(getLibraryVersion(docId, versions), {label, version: sourceVersions[section]});
    });
  }
}

for (const docId of ['', '/', 'index', 'concepts/living-documentation', 'guides/ai-project-setup', '/category/concepts', '/viewer-extra/index', '/vitest-next/index', '/toString', '/constructor']) {
  test(`shared or unrelated page '${docId}' has no library version label`, () => {
    assert.equal(getLibraryVersion(docId, versions), undefined);
  });
}

test("changing source metadata from '1.2.3' to '9.8.7' updates the next build without editing docs", () => {
  const updated = loadLibraryVersions(repoRoot, fixtureReader({...sourceVersions, vitest: '9.8.7', xunit: '2.3.4.5'}));
  assert.equal(getLibraryVersion('vitest/reference/feature', updated).version, '9.8.7');
  assert.equal(getLibraryVersion('xunit/reference/feature-test', updated).version, '2.3.4.5');
  assert.equal(getLibraryVersion('viewer/index', updated).version, '4.5.6');
});

test("release metadata changes update xUnit examples from '1.2.3.4' to '2.3.4.5' and VSIX filenames from '7.8.9' to '8.9.0'", () => {
  const updated = loadLibraryVersions(repoRoot, fixtureReader({...sourceVersions, xunit: '2.3.4.5', vscode: '8.9.0'}));
  const xml = '<PackageReference Include="SweDevTools.LiveDoc.xUnit" Version="{{libraryVersion}}" />';
  const vsix = 'code --install-extension livedoc-vscode-{{libraryVersion}}.vsix';
  assert.equal(resolveLibraryCode(xml, 'xunit', versions), '<PackageReference Include="SweDevTools.LiveDoc.xUnit" Version="1.2.3.4" />');
  assert.equal(resolveLibraryCode(xml, 'xunit', updated), '<PackageReference Include="SweDevTools.LiveDoc.xUnit" Version="2.3.4.5" />');
  assert.equal(resolveLibraryCode(vsix, 'vscode', versions), 'code --install-extension livedoc-vscode-7.8.9.vsix');
  assert.equal(resolveLibraryCode(vsix, 'vscode', updated), 'code --install-extension livedoc-vscode-8.9.0.vsix');
});

test("all '{{libraryVersion}}' placeholders resolve while unrelated versions stay '2.9.3'", () => {
  const code = 'LiveDoc={{libraryVersion}}, repeat={{libraryVersion}}, xunit=2.9.3';
  assert.equal(resolveLibraryCode(code, 'xunit', versions), 'LiveDoc=1.2.3.4, repeat=1.2.3.4, xunit=2.9.3');
});

for (const [path, library] of [
  ['docs/xunit/reference/configuration.mdx', 'xunit'],
  ['docs/viewer/guides/code-coverage.mdx', 'xunit'],
  ['docs/vscode/overview.mdx', 'vscode'],
]) {
  test(`'${path}' consumes '${library}' build metadata instead of maintaining a separate version literal`, () => {
    const page = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(page, new RegExp(`<LibraryCodeBlock library="${library}"`));
    if (library === 'xunit') {
      assert.match(page, /Include="SweDevTools.LiveDoc.xUnit" Version="\{\{libraryVersion\}\}"/);
      assert.doesNotMatch(page, /Include="SweDevTools.LiveDoc.xUnit" Version="\d/);
    } else {
      assert.match(page, /livedoc-vscode-\{\{libraryVersion\}\}\.vsix/);
      assert.doesNotMatch(page, /livedoc(?:-vscode)?-\d.*\.vsix/);
    }
  });
}

test('the build reads all four canonical manifests rather than registry metadata', () => {
  const paths = [];
  const read = fixtureReader(sourceVersions);
  loadLibraryVersions(repoRoot, path => {
    paths.push(path);
    return read(path);
  });
  assert.deepEqual(paths, [
    join(repoRoot, 'packages', 'vitest', 'package.json'),
    join(repoRoot, 'dotnet', 'xunit', 'livedoc-xunit.csproj'),
    join(repoRoot, 'packages', 'viewer', 'package.json'),
    join(repoRoot, 'packages', 'vscode', 'package.json'),
  ]);
});

test('the actual manifests are valid and their values flow to the library labels', () => {
  const current = loadLibraryVersions(repoRoot);
  for (const section of ['vitest', 'viewer', 'vscode']) {
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'packages', section, 'package.json'), 'utf8'));
    assert.equal(getLibraryVersion(`${section}/index`, current).version, manifest.version);
  }
  assert.equal(current.xunit.version, readProjectVersion(readFileSync(join(repoRoot, 'dotnet', 'xunit', 'livedoc-xunit.csproj'), 'utf8')));
});

for (const [description, content, expected] of [
  ['direct Version with comments and other package versions', '<Project><PropertyGroup><Version> 0.3.0.6 </Version></PropertyGroup><!-- <Version>99.0.0</Version> --><ItemGroup><PackageReference Version="8.0.0"/></ItemGroup></Project>', '0.3.0.6'],
  ['VersionPrefix and VersionSuffix', '<Project><PropertyGroup><VersionPrefix>1.2.3</VersionPrefix><VersionSuffix>beta.2</VersionSuffix></PropertyGroup></Project>', '1.2.3-beta.2'],
  ['VersionPrefix alone', '<Project><PropertyGroup><VersionPrefix>1.2.3</VersionPrefix></PropertyGroup></Project>', '1.2.3'],
  ['Version takes precedence over VersionPrefix', '<Project><PropertyGroup><Version>2.3.4</Version><VersionPrefix>1.2.3</VersionPrefix><VersionSuffix>beta</VersionSuffix></PropertyGroup></Project>', '2.3.4'],
  ['XML namespace and CDATA', '<Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003"><PropertyGroup><Version><![CDATA[1.2.3.4]]></Version></PropertyGroup></Project>', '1.2.3.4'],
  ['multiple property groups and an XML declaration', '<?xml version="1.0" encoding="utf-8"?><Project><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup><PropertyGroup><Version>1.2.3</Version></PropertyGroup></Project>', '1.2.3'],
]) {
  test(`xUnit ${description} yields '${expected}'`, () => {
    assert.equal(readProjectVersion(content), expected);
  });
}

for (const [description, content] of [
  ['missing version', '<Project><PropertyGroup><AssemblyVersion>1.2.3</AssemblyVersion></PropertyGroup></Project>'],
  ['empty version', '<Project><PropertyGroup><Version /></PropertyGroup></Project>'],
  ['invalid version', '<Project><PropertyGroup><Version>latest</Version></PropertyGroup></Project>'],
  ['MSBuild expression', '<Project><PropertyGroup><Version>$(LibraryVersion)</Version></PropertyGroup></Project>'],
  ['duplicate Version properties', '<Project><PropertyGroup><Version>1.2.3</Version></PropertyGroup><PropertyGroup><Version>2.3.4</Version></PropertyGroup></Project>'],
  ['conditional property group', '<Project><PropertyGroup Condition="true"><Version>1.2.3</Version></PropertyGroup></Project>'],
  ['conditional Version', '<Project><PropertyGroup><Version Condition="true">1.2.3</Version></PropertyGroup></Project>'],
  ['version nested in a target', '<Project><Target><PropertyGroup><Version>1.2.3</Version></PropertyGroup></Target></Project>'],
  ['nested version markup', '<Project><PropertyGroup><Version><Value>1.2.3</Value></Version></PropertyGroup></Project>'],
  ['malformed XML', '<Project><PropertyGroup><Version>1.2.3</PropertyGroup>'],
  ['missing Project root', '<PropertyGroup><Version>1.2.3</Version></PropertyGroup>'],
]) {
  test(`xUnit ${description} fails the build instead of inventing a version`, () => {
    assert.throws(() => readProjectVersion(content));
  });
}

for (const version of [undefined, null, 123, '', 'latest', '1.2', '1.2.3.4', '1.2.3 garbage', '01.2.3', '1.2.3-01', '1.2.3-1..beta']) {
  test(`npm version '${String(version)}' fails validation`, () => {
    assert.throws(() => loadLibraryVersions(repoRoot, fixtureReader({...sourceVersions, vitest: version})), /Missing or invalid library version/);
  });
}

test("npm prerelease '1.2.3-beta.2+build.4' is preserved", () => {
  assert.equal(loadLibraryVersions(repoRoot, fixtureReader({...sourceVersions, vitest: '1.2.3-beta.2+build.4'})).vitest.version, '1.2.3-beta.2+build.4');
});

test('missing metadata and malformed JSON fail the build', () => {
  assert.throws(() => loadLibraryVersions(repoRoot, () => {throw new Error('Manifest not found');}), /Manifest not found/);
  assert.throws(() => loadLibraryVersions(repoRoot, () => '{'));
});
