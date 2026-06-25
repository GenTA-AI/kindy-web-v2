# Agent Operating Guide

This repository is prepared for a Codex-led, Claude-assisted multi-agent workflow. Keep work traceable, small, and reviewable.

## Operating Model

- Codex Lead is the single source of truth for scope, work decomposition, integration, and final approval.
- Claude Planner drafts the objective, constraints, assumptions, architecture impact, work packages, dependency graph, risks, test strategy, rollback considerations, and proposed worker allocation.
- Codex Lead reviews and amends the planner output before any worker starts.
- Claude Workers implement only assigned, file-scoped work packages.
- Codex Reviewer and Test Auditor review outcomes before the Lead accepts the work.

## Automatic Run Command

From the project root, the full automated flow can be launched by the toolkit:

```bash
team-auto . "describe the target change"
```

This calls Claude Planner, Codex Lead, Claude Workers, and Codex Reviewer through their local CLIs. Run artifacts are written under `.agent/runs/<run-id>/`.

## Shared Rules

- Read the local code, tests, `AGENTS.md` or `AGENTS.ai-team-kit.md`, `.agent/repo.yaml`, `.codex/config.toml`, and relevant agent definitions before proposing changes.
- Preserve existing user work. Never overwrite project files unless the task explicitly calls for it.
- Keep work package briefs and handoffs under `.agent/tasks/work-packages/`.
- Keep review notes under `.agent/tasks/reviews/`.
- Keep command summaries and investigation notes under `.agent/logs/`.
- Prefer narrow, verifiable changes over broad refactors.
- Use the repository's existing patterns, frameworks, commands, and style.
- Run the most relevant checks available before handing off.

## Role Boundaries

- Lead approves; workers do not approve their own output.
- Planner plans; planner does not implement.
- Workers implement assigned packages; workers do not rewrite the plan.
- Reviewers review; reviewers do not implement unless the Lead explicitly reassigns the fix.
- Test Auditor owns verification quality, not broad implementation.

## Artifact Layout

- `.codex/config.toml` sets Codex agent concurrency and depth.
- `.codex/agents/` contains Codex custom agent definitions.
- `.claude/agents/` contains Claude Code subagent definitions.
- `.agent/repo.yaml` describes the local team harness.
- `.agent/prompts/` contains role prompts copied from ai-team-kit.
- `.agent/tasks/work-packages/` stores worker briefs and handoffs.
- `.agent/tasks/reviews/` stores reviewer and test audit notes.
- `.agent/logs/` stores command output summaries and session notes.

## Completion Standard

A task is complete only when:

- Requirements are satisfied.
- Planned risks are handled or recorded as residual risk.
- Tests or explicit verification have been added or updated.
- Worker outputs pass Codex Lead review.
- Documentation and configuration changes are reflected.
- Temporary logs, dead code, and unrelated cleanup are removed.
