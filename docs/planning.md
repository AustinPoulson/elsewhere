# Artistic direction and ticket planning

The planner decides what Elsewhere should become next; the executor delivers a prepared piece of that direction. Both work within the Operator's authorized scope recorded in [automation.md](automation.md). This document and the board are reference material, not independent permission to expand that scope.

## Board identity and workflow

The board is [Elsewhere](https://trello.com/b/aymJcqvP/elsewhere) in the personal **Trello workspace**, verified through the authenticated browser. That URL is the stable identity; resolve exact list names fresh each run. The connector's Ether-only view cannot currently access this board. Use the existing authenticated browser, without repeated connector retries or permission expansion.

Current direction: [Direction card](https://trello.com/c/sIzx9Xn6/1-direction-borrowed-color-a-small-world-worth-returning-to).

Keep the existing Ideas, Completed, and Deferred/Canceled names. The requested workflow adds Direction, Ready, In Progress, and Blocked in this order:

| List | Meaning |
| --- | --- |
| Direction | Current direction/weekly focus, plus the shared charter and run ownership/recovery record. |
| Ideas | Structured future feature proposals that still need decisions, scoping, or dependencies; linked side-work proposals are explicitly marked. |
| Ready | Complete contracts for significant new visitor-facing features, ordered by priority; execution waits for their stated dependencies. This is the todo queue, not a maintenance queue. |
| In Progress | A claimed ticket with run, branch/worktree, PR, and current evidence. |
| Blocked | Unfinished work with a specific dependency, unblock condition, and recovery state. |
| Completed | All acceptance checks passed and the merged revision is verified live. |
| Deferred/Canceled | Retired planner decisions with a reason and a condition for revival. |

Resolve all seven lists before execution; list creation/configuration is separate from this document. Move superseded or obsolete unclaimed proposals to Deferred/Canceled with a dated reason, linking duplicates to the surviving card. Recoverable archiving can retain that decision/history; permanent deletion is forbidden. Do not retire, archive, rescope, reorder, or replace claimed work; propose a separate follow-up or obtain its explicit handoff first.

## Weekly direction

The Operator's direction (2026-10-11 through 2026-10-13) is a playable ecosystem: interactions should feel like a gentle touch of a god, with clear immediate feedback and ecological consequences that unfold over time. Develop creatures toward birth, growth, reproduction, aging, and death, with resources returned to the world and populations limited by food, habitat, and other relationships. Aim for a dynamic natural balance with recoverable fluctuations, rather than a permanently fixed population. Treat this as a long-term destination; planning must define and validate each resource cycle and lifecycle slice before it enters Ready. Preserve the quiet artistic character while making actions and their consequences easier to feel and understand.

Inspect the actual code and live desktop/portrait experience, recent expedition notes, screenshots, user feedback, open PRs, board, and unfinished verification. Distinguish implemented behavior, observed gaps, and speculative ideas. Use [next expeditions](next-expeditions.md) as inputs, not an automatic feature list. Research as needed and link evidence supporting a decision.

Maintain a dated Direction card covering:

- A four-to-six-week artistic theme and the experience it should make visible.
- Existing ecological relationships it develops, the current world's strengths/gaps, and deliberate non-goals.
- Next week's focus, ordered tickets and dependencies, and why that sequence is coherent.
- Evidence to revisit, risks or unresolved decisions, and what would justify changing direction.

Prefer a few relationships that reinforce each other over accumulating unrelated species or controls. Each daily run targets a noticeable new feature: creatures, actions, behaviors, weather, or controls with ecological consequences. Track maintenance as explicit linked side work with priority and evidence; routine fixes do not replace that feature. A small readout, visual cue, cleanup, or isolated bug repair cannot alone qualify as a meaningful platform upgrade. Preserve decisions and reasons when changing the direction.

Compare every proposed ticket with the code, Completed cards, active work, and existing proposals. Split oversized ideas into independently satisfying slices; merge duplicates into a single surviving proposal; retire obsolete unclaimed cards with a dated reason. Prepare nine to ten outcome-oriented feature Ready cards for the next week: seven daily upgrades plus two or three independently eligible alternatives. Maintain fifteen to twenty-five structured future Ideas when justified, with a proposed new capability, ecological relationship, dependencies, design questions, and next evidence needed. These are planning targets, not permission to create filler or promote unresolved work. Prefer independently satisfying vertical slices; do not turn one complete feature into weeks of micro-polish. Planning should settle concrete lifecycle/resource/design decisions rather than indefinitely leaving the core creature direction unspecified. Keep uncertain or unspecified dependencies in Ideas. Fully specified Ready cards may link known preceding tickets; execution waits until those dependencies are completed. The executor preserves started work and records its Blocked handoff; the planner cannot rewrite an active claim. Keep Ready ordered, with the highest-priority executable card first; do not churn cards merely to create activity.

## Ticket contract

Every Ready card delivers a significant new visitor-facing capability and has one clear title plus the following completed description/checklist. Its before/after demonstration must make the upgrade obvious during play. Missing mandatory feasibility or invariant decisions keep a card out of Ready; ordinary aesthetic and tuning choices belong to execution. Routine bug cards belong as clearly marked linked side work in the appropriate Ideas, In Progress, Blocked, or Completed state, rather than substituting for a feature in Ready.

```text
Motivation: Why this ticket advances the current direction or resolves a gap.
Current evidence: Code/live observations, feedback, fixtures, or research links;
  distinguish verified facts from proposals and unresolved feasibility.
New capability: The meaningful new creature, action, behavior, weather, or control.
Visible effect: What a visitor can see or do; a playable before/after demonstration
  that makes this new capability noticeable, not just a readout or polish change.
Existing relationship: What already in the world this changes or interacts with.
Scope: Intended behavior, required invariants versus creative starting points,
  affected modules/typed contracts and one feature slice. Link necessary side work.
Non-goals: Features/refactors explicitly outside this ticket.
Dependencies: Linked cards/decisions and objective conditions for starting.
Constraints: Entity/render/storage budgets, determinism, resource accounting,
  keyboard/focus/touch and reduced motion, autosave/snapshot compatibility.
Acceptance: Observable behavior and edge cases, with meaningful tests,
  desktop/portrait rendered evidence, and affected pause/reset/save checks.
Release: Passing npm ci + npm run validate; final PR diff/head/integration CI;
  reviewed-SHA merge; successful Pages run; live release.json equals merged SHA;
  live behavior/assets pass; evidence links recorded before Completed.
Side work / recovery (if applicable): Linked defect or blocked card/revision,
  exact repair, whether it truly blocks release, and its own acceptance evidence.
  Routine fixes do not replace the feature capability or weaken release gates.
```

For a schema change, specify which existing saves remain supported and the tested migration. For a new budget, give a numeric limit and long-run evidence. For an artistic change, include a visible comparison or interaction rather than accepting source changes alone. Claims about physical touch or OS motion preferences require actual device testing; emulation and source review are labeled as such.

## Execution and recovery handoff

The executor claims one complete feature Ready card and targets its verified deployment that day. Planning defines the intended outcome and mandatory guardrails; execution owns creative implementation. Distinguish required ecological/resource invariants, save compatibility, accessibility, budgets and release acceptance from suggested mechanics, tuning, visuals, animation, sound, naming, UI flow and module structure. The executor may prototype, play-test, tune and add small coherent in-scope details without returning to planning for approval. Existing detailed ticket prescriptions are starting points unless explicitly necessary to a hard invariant. Record material choices and evidence on the card and expedition notes. A change of objective, hard invariant/dependency, material scope expansion or unresolved feasibility/safety decision needs a planning handoff; an unspecified aesthetic or tuning choice does not. Capture unrelated new ideas as Ideas proposals and protect claimed work.

Weekly planning covers the seven daily slots before the next planning run, excluding completed work and accounting for unfinished features and dependency chains. Keep seven realistically executable significant features plus two or three independently eligible alternatives, normally nine to ten Ready cards. Ideas, blocked work and cards trapped behind an unresolved dependency do not count as coverage. Prefer outcome contracts to exhaustive blueprints; flag a genuine capacity gap instead of creating filler.

Preserve the card's claim, branch/worktree, PR, reviewed head/base SHAs, checks, merged SHA, deployment stage, and remaining acceptance evidence as work proceeds. Resume actionable unfinished feature work before selecting a new feature. If work is explicitly handed off as externally Blocked, preserve its state before considering another eligible Ready card; never overlap publication.

Separate true release blockers from nonblocking historical QA gaps, tooling limitations, and unrelated defects. Save loss, security risks, failed required checks, and a candidate's failed required deployment/live acceptance must be repaired before publishing that candidate. A missing old QA artifact does not automatically prohibit developing an unrelated feature. Planning identifies the concrete risk, affected feature/revision, repair scope, and unblock evidence. The executor handles routine bug fixes alongside the feature, continues its significant upgrade in the same run when feasible, and reports a bug-only recovery day as such. An independent fix uses its own fresh `codex/` branch and PR; only a necessary scoped fix belongs in the feature PR. No repair waives the original ticket's remaining acceptance, and no failed candidate is published.

## Foundation for a growing world

Plan for a large ecosystem through clear boundaries for species, environment, visitor actions, saved-world persistence, rendering, and UI. Define stable typed contracts between systems, deterministic resource transfers, explicit per-system entity/work/render/storage budgets, and versioned snapshot migrations with old-save checks. Keep authoritative simulation state separate from transient rendering and observation cues.

Deliver feature-oriented vertical slices across those boundaries. Extract a narrow module when a concrete feature exposes duplicated or entangled responsibilities; do not require a speculative framework or large rewrite before adding life to the world. Avoid premature feature-flag infrastructure, unbounded histories/data, and global systems with implicit resource ownership. Every new feature states the resource and budget it consumes, the state it owns, and how saves survive its evolution.

Both roles atomically acquire the common `C:\repos\MAGI\elsewhere\.artifacts\automation-lock` before mutations. It is the exclusion mechanism; Trello run/claim notes are only its visible mirror. Planning holds it for board changes, execution for claims and development/publication; release only the current run's lock, and clear stale ownership only after verifying the prior run is inactive. See [shared coordination](automation.md#shared-coordination) for the ownership metadata. The planner may inspect active work read-only without the lock but cannot rewrite a claimed ticket. Planning creates no production changes or deployment. Quiet runs need no empty report: report meaningful direction/queue changes, completed verified work, or a concrete blocker and required next step.
