import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ExportOptions {
  input: string;
  output: string;
  title?: string;
}

export interface ExportResult {
  outputPath: string;
  sizeBytes: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function exportReport(options: ExportOptions): ExportResult {
  // 1. Read and validate input JSON
  const inputPath = resolve(options.input);
  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  let rawJson: string;
  try {
    rawJson = readFileSync(inputPath, 'utf8');
  } catch {
    throw new Error(`Could not read input file: ${inputPath}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JSON in input file: ${inputPath}`);
  }

  if (data.protocolVersion !== '3.0') {
    throw new Error(
      `Invalid TestRunV3 format: expected protocolVersion '3.0', got '${String(data.protocolVersion ?? 'undefined')}'`
    );
  }

  // 2. Resolve webview assets directory
  const webviewDir = fileURLToPath(new URL('./webview/', import.meta.url));

  const jsPath = resolve(webviewDir, 'index.js');
  const cssPath = resolve(webviewDir, 'index.css');

  if (!existsSync(jsPath) || !existsSync(cssPath)) {
    throw new Error(
      'Webview assets not found. Run `pnpm build` first to generate the client bundle.'
    );
  }

  // 3. Read webview assets
  const jsContent = readFileSync(jsPath, 'utf8');
  const cssContent = readFileSync(cssPath, 'utf8');

  // 4. Determine title
  const title = options.title
    ?? (data.project as string | undefined)
    ?? 'LiveDoc';

  // 5. Build safe JSON (escape </script> tags that could appear in content)
  const safeJson = JSON.stringify(data).replace(/<\/script>/gi, '<\\/script>');

  // 6. Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — LiveDoc Report</title>
  <style>${cssContent}</style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.__LIVEDOC_DATA__ = ${safeJson};
  </script>
  <script>${jsContent}</script>
</body>
</html>`;

  // 7. Write output
  const outputPath = resolve(options.output);
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  writeFileSync(outputPath, html, 'utf8');

  const sizeBytes = Buffer.byteLength(html, 'utf8');

  return { outputPath, sizeBytes };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Run export from CLI and print results to console. */
export function runExport(options: ExportOptions): void {
  try {
    const result = exportReport(options);
    const size = formatFileSize(result.sizeBytes);
    console.log('');
    console.log('✅ LiveDoc report exported successfully!');
    console.log(`   Input:  ${options.input}`);
    console.log(`   Output: ${result.outputPath}`);
    console.log(`   Size:   ${size}`);
    console.log('');
    console.log('   Open in any browser to view your test results.');
    console.log('');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Export failed: ${message}\n`);
    process.exit(1);
  }
}
