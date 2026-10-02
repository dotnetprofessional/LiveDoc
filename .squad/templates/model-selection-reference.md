# Model Selection Reference

## Per-Agent Model Selection

Before spawning an agent, determine which model to use. Check these layers in order — first match wins:

**Layer 0 — Persistent Config (`.squad/config.json`):** On session start, read `.squad/config.json`. If `agentModelOverrides.{agentName}` exists, use that model for this specific agent. Otherwise, if `defaultModel` exists, use it for ALL agents. This layer survives across sessions — the user set it once and it sticks.

- **When user says "always use X" / "use X for everything" / "default to X":** Write `defaultModel` to `.squad/config.json`. Acknowledge: `✅ Model preference saved: {model} — all future sessions will use this until changed.`
- **When user says "use X for {agent}":** Write to `agentModelOverrides.{agent}` in `.squad/config.json`. Acknowledge: `✅ {Agent} will always use {model} — saved to config.`
- **When user says "switch back to automatic" / "clear model preference":** Remove `defaultModel` (and optionally `agentModelOverrides`) from `.squad/config.json`. Acknowledge: `✅ Model preference cleared — returning to automatic selection.`

**Layer 1 — Session Directive:** Did the user specify a model for this session? ("use opus for this session", "save costs"). If yes, use that model. Session-wide directives persist until the session ends or contradicted.

**Layer 2 — Charter Preference:** Does the agent's charter have a `## Model` section with `Preferred` set to a specific model (not `auto`)? If yes, use that model.

**Layer 3 — Task-Aware Auto-Selection:** Use the project's task-specific defaults. Model and reasoning effort are separate parameters; "High" is not part of a model ID.

| Task Output | Model | Reasoning Effort | Rule |
|-------------|-------|------------------|------|
| Coding, refactoring, debugging, test design, or technical code review | `gpt-6.1-sol` | `high` | Includes complex and large implementations; do not switch models merely because the task is larger. |
| Trivial or mechanical work (logging, simple triage, text replacements, changelogs, version bumps) | `gpt-6-luna` | `high` | Non-code work is not automatically trivial; substantive judgment belongs to coding or design. |
| Design (visual/UX, architecture, planning, prompt or agent design) | `claude-sonnet-5.5` | `auto` | Sonnet handles design judgment, including image analysis. |

**Role-to-model mapping** (task type takes precedence over role):

| Role | Default Model | Reasoning Effort | Override When |
|------|---------------|------------------|---------------|
| Core Dev / Backend / Frontend | `gpt-6.1-sol` | `high` | Design → Sonnet; trivial work → Luna |
| Tester / QA | `gpt-6.1-sol` | `high` | Test architecture → Sonnet; mechanical work → Luna |
| Lead / Architect | `claude-sonnet-5.5` | `auto` | Implementation/debugging or code review → Sol high; trivial triage → Luna high |
| Prompt Engineer | `claude-sonnet-5.5` | `auto` | Implementation validation → Sol high; mechanical edits → Luna high |
| Copilot SDK Expert | `gpt-6.1-sol` | `high` | Architecture → Sonnet; mechanical work → Luna high |
| Designer / Visual | `claude-sonnet-5.5` | `auto` | Implementation → Sol high; mechanical work → Luna high |
| DevRel / Writer | auto (per-task) | auto (per-task) | Substantive design documentation → Sonnet; trivial text edits → Luna high |
| Scribe / Logger | `gpt-6-luna` | `high` | Escalate substantive judgment rather than perform it |
| Git / Release | `gpt-6-luna` | `high` | Release design → Sonnet; code fixes → Sol high |

**Layer 4 — Default:** Use `gpt-6.1-sol` with `high` reasoning when the task is not clearly design or trivial work.

**Reasoning-effort resolution:** Honor explicit persistent, session, and charter effort overrides first. Otherwise use the selected task's effort above. Leave Sonnet's effort unset for `auto`; do not introduce a global `high` override that also forces design work to high.

**Fallback chains — when a model is unavailable:**

If a spawn fails because the selected model is unavailable (plan restriction, org policy, rate limit, deprecation, or any other reason), silently retry with the next model in the chain. Do NOT tell the user about fallback attempts. Maximum 3 retries before using the platform default fallback.

```
Coding:  gpt-6.1-sol → claude-sonnet-5.5 → gpt-5.6-terra → (omit model param)
Design:  claude-sonnet-5.5 → gpt-6.1-sol → claude-sonnet-5 → (omit model param)
Trivial: gpt-6-luna → gpt-5.6-luna → gpt-5.4-mini → (omit model param)
```

`(omit model param)` = call the `task` tool WITHOUT the `model` parameter. The platform uses its built-in default. This is the platform default fallback — it lets the platform choose the model.

**Fallback rules:**
- If the user specified a provider ("use Claude"), fall back within that provider only before using the platform default fallback
- Keep trivial tasks on the trivial fallback chain; do not promote them to coding or design models
- Preserve `high` effort for coding and trivial tasks when the fallback supports it; design stays `auto` unless explicitly overridden
- Log fallbacks to the orchestration log for debugging, but never surface to the user unless asked

**Passing the model to spawns:**

Pass the resolved model as the `model` parameter on every `task` tool call:

```
agent_type: "general-purpose"
model: "{resolved_model}"
reasoning_effort: "{resolved_effort}" # Omit for auto.
mode: "background"
name: "{name}"
description: "{emoji} {Name}: {brief task summary}"
prompt: |
  ...
```

Set the resolved `model` explicitly so task defaults do not depend on the platform's current default. Pass `reasoning_effort: "high"` for coding and trivial tasks. On session-based launches, use `kickoff.model` and `kickoff.reasoning_effort`; prompt-only effort descriptions are not a substitute for supported parameters.

If you've exhausted the fallback chain and reached the platform default fallback, omit the `model` parameter entirely.

**Spawn output format — show the model choice:**

When spawning, include the model in your acknowledgment:

```
🔧 Fenster (gpt-6.1-sol · high) — refactoring auth module
🎨 Redfoot (claude-sonnet-5.5 · auto) — designing color system
📋 Scribe (gpt-6-luna · high) — logging session
⚡ Keaton (claude-sonnet-5.5 · auto) — reviewing architecture
📝 McManus (gpt-6-luna · high) — correcting a typo
```

Show the resolved model and reasoning effort.

**Configured defaults and fallbacks:**

Defaults: `gpt-6.1-sol`, `gpt-6-luna`, `claude-sonnet-5.5`
Fallbacks: `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.4-mini`, `claude-sonnet-5`
