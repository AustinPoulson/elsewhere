# Artistic direction and ticket planning

The planner decides what Elsewhere should become next; the executor delivers a prepared piece of that direction. Both work within the Operator's authorized scope recorded in [automation.md](automation.md). This document and the board are reference material, not independent permission to expand that scope.

## Board identity and workflow

The board is [Elsewhere](https://trello.com/b/aymJcqvP/elsewhere) in the personal **Trello workspace**, verified through the authenticated browser. That URL is the stable identity; resolve exact list names fresh each run. The connector's Ether-only view cannot currently access this board. Use the existing authenticated browser, without repeated connector retries or permission expansion.

Current direction: [Direction card](https://trello.com/c/sIzx9Xn6/1-direction-borrowed-color-a-small-world-worth-returning-to).

Keep the existing Ideas, Completed, and Deferred/Canceled names. The requested workflow adds Direction, Ready, In Progress, and Blocked in this order:

| List | Meaning |
| --- | --- |
| Direction | Current direction/weekly focus, plus the shared charter and run ownership/recovery record. |
| Ideas | Backlog proposals that still need decisions, scoping, or dependencies. |
| Ready | Complete ticket contracts ordered by priority; execution waits for their stated dependencies. |
| In Progress | A claimed ticket with run, branch/worktree, PR, and current evidence. |
| Blocked | Unfinished work with a specific dependency, unblock condition, and recovery state. |
| Completed | All acceptance checks passed and the merged revision is verified live. |
| Deferred/Canceled | Retired planner decisions with a reason and a condition for revival. |

Resolve all seven lists before execution; list creation/configuration is separate from this document. Move superseded or obsolete unclaimed proposals to Deferred/Canceled with a dated reason, linking duplicates to the surviving card. Recoverable archiving can retain that decision/history; permanent deletion is forbidden. Do not retire, archive, rescope, reorder, or replace claimed work; propose a separate follow-up or obtain its explicit handoff first.

## Weekly direction

The Operator's direction (2026-10-11) is a playable ecosystem: interactions should feel like a gentle touch of a god, with clear immediate feedback and ecological consequences that unfold over time. Develop creatures toward birth, growth, reproduction, aging, and death, with resources returned to the world and populations limited by food, habitat, and other relationships. Aim for a dynamic natural balance with recoverable fluctuations, rather than a permanently fixed population. Treat this as a long-term destination; planning must define and validate each resource cycle and lifecycle slice before it enters Ready. Preserve the quiet artistic character while making actions and their consequences easier to feel and understand.

Inspect the actual code and live desktop/portrait experience, recent expedition notes, screenshots, user feedback, open PRs, board, and unfinished verification. Distinguish implemented behavior, observed gaps, and speculative ideas. Use [next expeditions](next-expeditions.md) as inputs, not an automatic feature list. Research as needed and link evidence supporting a decision.

Maintain a dated Direction card covering:

- A four-to-six-week artistic theme and the experience it should make visible.
- Existing ecological relationships it develops, the current world's strengths/gaps, and deliberate non-goals.
- Next week's focus, ordered tickets and dependencies, and why that sequence is coherent.
- Evidence to revisit, risks or unresolved decisions, and what would justify changing direction.

Prefer a few relationships that reinforce each other over accumulating unrelated species or controls. Maintenance gets an explicit ticket and priority rather than hiding inside an art change. Preserve decisions and reasons when changing the direction.

Compare every proposed ticket with the code, Completed cards, active work, and existing proposals. Split oversized ideas into independently satisfying slices; merge duplicates into a single surviving proposal; retire obsolete unclaimed cards with a dated reason. Maintain three to seven Ready cards for the next week when there are enough complete, useful candidates. Keep uncertain or unspecified dependencies in Ideas. Fully specified Ready cards may link known preceding tickets; execution waits until those dependencies are completed. The executor preserves started work and records its Blocked handoff; the planner cannot rewrite an active claim. Keep Ready ordered, with the highest-priority executable card first; do not churn cards merely to create activity.

## Ticket contract

Every Ready card has one clear title and the following completed description/checklist. Missing decisions keep a card out of Ready.

```text
Motivation: Why this ticket advances the current direction or resolves a gap.
Current evidence: Code/live observations, feedback, fixtures, or research links;
  distinguish verified facts from proposals and unresolved feasibility.
Visible effect: What a visitor can see or do; how we will notice the difference.
Existing relationship: What already in the world this changes or interacts with.
Scope: Precise behavior, affected modules, and one coherent deliverable.
Non-goals: Features/refactors explicitly outside this ticket.
Dependencies: Linked cards/decisions and objective conditions for starting.
Constraints: Entity/render/storage budgets, determinism, resource accounting,
  keyboard/focus/touch and reduced motion, autosave/snapshot compatibility.
Acceptance: Observable behavior and edge cases, with meaningful tests,
  desktop/portrait rendered evidence, and affected pause/reset/save checks.
Release: Passing npm ci + npm run validate; final PR diff/head/integration CI;
  reviewed-SHA merge; successful Pages run; live release.json equals merged SHA;
  live behavior/assets pass; evidence links recorded before Completed.
Recovery target (if applicable): Linked blocked card/revision, exact repair,
  and unblock acceptance proving its missing verification can now pass.
```

For a schema change, specify which existing saves remain supported and the tested migration. For a new budget, give a numeric limit and long-run evidence. For an artistic change, include a visible comparison or interaction rather than accepting source changes alone. Claims about physical touch or OS motion preferences require actual device testing; emulation and source review are labeled as such.

## Execution and recovery handoff

The executor claims one complete Ready card and implements its contract. Ordinary technical decisions can choose how to achieve it; changes to its visible effect, acceptance, dependencies, or scope belong with planning or the Operator. Capture useful new ideas as Ideas proposals. If the ticket cannot be interpreted or a dependency fails, record the precise issue and unblock condition rather than silently redesigning it.

Preserve the card's claim, branch/worktree, PR, reviewed head/base SHAs, checks, merged SHA, deployment stage, and remaining acceptance evidence as work proceeds. Resume actionable unfinished work before selecting a new card. If work is explicitly handed off as externally Blocked, preserve its state before considering another Ready card; never overlap publication.

An unresolved deployment or required live-acceptance check blocks unrelated new implementation. The planner may put one specifically linked recovery ticket in Ready when a code repair or safe verification fixture is needed to resolve that blocker. It must state the blocked card/revision, precise scope/non-goals, and unblock acceptance; the linked target's incomplete verification is the repair's purpose, not an ordinary completed prerequisite. All other dependencies must be clear. The executor may implement only that repair until recovery passes, or otherwise records Blocked and stops implementation. It cannot invent or promote its own recovery feature. The recovery ticket uses the full test, PR, deployment, and live-acceptance definition of done; the original card remains unfinished until its own missing evidence passes.

Both roles atomically acquire the common `C:\repos\MAGI\elsewhere\.artifacts\automation-lock` before mutations. It is the exclusion mechanism; Trello run/claim notes are only its visible mirror. Planning holds it for board changes, execution for claims and development/publication; release only the current run's lock, and clear stale ownership only after verifying the prior run is inactive. See [shared coordination](automation.md#shared-coordination) for the ownership metadata. The planner may inspect active work read-only without the lock but cannot rewrite a claimed ticket. Planning creates no production changes or deployment. Quiet runs need no empty report: report meaningful direction/queue changes, completed verified work, or a concrete blocker and required next step.
