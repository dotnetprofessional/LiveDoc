#!/usr/bin/env node
// LiveDoc AI Skill Installer — install AI coding skills for your team.
// Usage:
//   npx @swedevtools/livedoc-vitest setup                    # Interactive menu
//   npx @swedevtools/livedoc-vitest setup --tool copilot     # Non-interactive
//   npx livedoc-vitest-setup --tool all                      # Direct bin entry

import { existsSync, mkdirSync, cpSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Paths ──────────────────────────────────────────────────
const skillsSource = join(__dirname, 'skills');

if (!existsSync(join(skillsSource, 'SKILL.md'))) {
  console.error('  Error: Could not find skill files at', skillsSource);
  process.exit(1);
}

// ── Git root discovery ─────────────────────────────────────
function findGitRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return process.cwd();
  }
}

const gitRoot = findGitRoot();

// ── Tool definitions (same mapping as xUnit SDK) ──────────
const tools = [
  { key: 'copilot',  name: 'GitHub Copilot', dest: '.github/skills/livedoc-vitest' },
  { key: 'claude',   name: 'Claude Code',    dest: '.claude/skills/livedoc-vitest' },
  { key: 'roo',      name: 'Roo Code',       dest: '.roo/skills/livedoc-vitest' },
  { key: 'cursor',   name: 'Cursor',         dest: '.cursor/rules/livedoc-vitest' },
  { key: 'windsurf', name: 'Windsurf',       dest: '.windsurf/rules/livedoc-vitest' },
];

// ── Recursive directory copy ──────────────────────────────
function copyRecursive(src, dest) {
  const entries = readdirSync(src, { withFileTypes: true });
  mkdirSync(dest, { recursive: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// ── Install skills for selected tools ─────────────────────
function installSkills(selected) {
  console.log('');
  for (const tool of selected) {
    const dest = join(gitRoot, tool.dest);
    copyRecursive(skillsSource, dest);
    console.log(`  \x1b[32m[ok]\x1b[0m ${tool.name} → ${dest}`);
  }
  console.log('');
  console.log('  \x1b[36mDone! Commit the generated files to share with your team.\x1b[0m');
  console.log('');
}

// ── Parse CLI args ────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  // Strip leading "setup" command if present (npx @swedevtools/livedoc-vitest setup --tool X)
  if (args[0] === 'setup') args.shift();

  let toolArg = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool' && args[i + 1]) {
      toolArg = args[i + 1].toLowerCase();
      break;
    }
    // Also support --tool=value
    if (args[i].startsWith('--tool=')) {
      toolArg = args[i].slice('--tool='.length).toLowerCase();
      break;
    }
  }
  return toolArg;
}

// ── Non-interactive mode ──────────────────────────────────
function resolveNonInteractive(toolArg) {
  if (toolArg === 'all') return tools;

  const match = tools.find((t) => t.key === toolArg);
  if (!match) {
    console.error(`  Unknown tool: ${toolArg}. Use: copilot, claude, roo, cursor, windsurf, all`);
    process.exit(1);
  }
  return [match];
}

// ── Interactive menu ──────────────────────────────────────
function showInteractiveMenu() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    console.log('');
    console.log('  \x1b[36mLiveDoc AI Skill Installer\x1b[0m');
    console.log('');
    console.log('  Select AI tool(s) to install skills for:');
    console.log('');
    tools.forEach((t, i) => {
      console.log(`    ${i + 1}. ${t.name}`);
    });
    console.log('    A. All of the above');
    console.log('');

    rl.question('  Choice [A]: ', (answer) => {
      rl.close();
      const choice = (answer || 'A').trim();

      if (choice.toLowerCase() === 'a') {
        resolve(tools);
        return;
      }

      const idx = parseInt(choice, 10);
      if (idx >= 1 && idx <= tools.length) {
        resolve([tools[idx - 1]]);
        return;
      }

      console.error(`  Invalid choice: ${choice}`);
      process.exit(1);
    });
  });
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const toolArg = parseArgs();

  let selected;
  if (toolArg) {
    selected = resolveNonInteractive(toolArg);
  } else if (!process.stdin.isTTY) {
    // Non-interactive context without --tool: default to all
    console.log('  Non-interactive context detected. Installing for all tools.');
    selected = tools;
  } else {
    selected = await showInteractiveMenu();
  }

  installSkills(selected);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
