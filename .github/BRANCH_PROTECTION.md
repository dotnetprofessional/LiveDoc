# Branch Protection Setup

This document describes the recommended branch protection rules for the `master` branch.

> **Note:** Branch protection rules must be configured manually in the GitHub repository settings.
> Go to **Settings → Branches → Add branch protection rule**.

## Rule: `master`

### Required Settings

| Setting | Value | Why |
|---------|-------|-----|
| **Branch name pattern** | `master` | Protects the default branch |
| **Require a pull request before merging** | ✅ Enabled | Prevents direct pushes; all changes go through PR review |
| **Require approvals** | 1 | At least one reviewer must approve |
| **Require status checks to pass before merging** | ✅ Enabled | CI must be green before merge |
| **Status checks that are required** | `Node.js 18`, `Node.js 22`, `.NET` | All CI jobs must pass |
| **Require branches to be up to date before merging** | ✅ Enabled | Ensures PR is tested against latest `master` |
| **Require conversation resolution before merging** | ✅ Enabled | All review comments must be resolved |
| **Do not allow bypassing the above settings** | ✅ Enabled | Applies rules to admins too |

### Optional Settings

| Setting | Value | Notes |
|---------|-------|-------|
| **Require signed commits** | Optional | Adds commit verification |
| **Require linear history** | Optional | Enforces squash or rebase merges |
| **Include administrators** | ✅ Recommended | Ensures no one can bypass rules |
| **Allow force pushes** | ❌ Disabled | Protects commit history |
| **Allow deletions** | ❌ Disabled | Prevents accidental branch deletion |

## Quick Setup Steps

1. Go to your repository on GitHub
2. Click **Settings** → **Branches**
3. Click **Add branch protection rule**
4. Enter `master` as the branch name pattern
5. Enable the settings listed above
6. Click **Create** / **Save changes**
