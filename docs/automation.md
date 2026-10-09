# Scheduled expeditions

Elsewhere is a continuing art collaboration. Each scheduled run develops and publishes one small, coherent addition that interacts with something already in the world.

**Authority:** The Operator has authorized recurring Elsewhere development, feature-branch commits/pushes, reviewed pull request merges, and GitHub Pages deployment, including the initial repository/site setup needed to run this workflow. Every scheduled addition reaches `main` through a PR; routine actions within that process do not need another approval.

**Schedule:** Daily at **9:00 AM America/Chicago (Central time)**, confirmed by the Operator. Runtime scheduling is configured separately and follows this timezone through daylight-saving changes.

The active Codex task is **Grow Elsewhere** (`grow-elsewhere`), attached to the collaboration chat. The computer and desktop app must be running, with this checkout available, for its local development work.

## Publishing access on this host

Use existing authenticated local Git when available; verify its access each run. Local Git was unavailable at initial launch, but Expedition 002's publication preflight succeeded with the existing credentials. The GitHub connector rejects tree writes with HTTP 403. The authenticated GitHub browser is a supported fallback for feature-branch uploads, pull requests, merges, and Pages workflow controls. Review the resulting remote diff and commit SHA just as with a Git push. Do not expand account permissions to bypass these limitations. The expedition authority covers only Elsewhere.

The sandbox created this checkout under a different Windows account. If an authorized shell network operation reports dubious ownership, use `git -c safe.directory=C:/repos/MAGI/elsewhere` for that command. Keep the exception limited to this known checkout; do not change global trust settings.

## Each run

Browser publication must include intended deletions and renames as well as additions. Compare the complete remote diff with the validated local change before merging. Uploading files alone does not remove an obsolete file. GitHub's browser uploads allow 100 files per batch and 25 MiB per file; use an available authenticated Git path when an addition exceeds those limits.

1. **Inspect.** Confirm the checkout and remote are the standalone `AustinPoulson/elsewhere` project, with `main` as the publishing branch. Read the current world, live site, recent changes, and previous run's incomplete work. Finish or repair a useful unfinished expedition or deployment before starting another. Check for an active run and avoid concurrent publication. Preserve unrelated local changes.
2. **Choose.** Pick one small relationship from [next-expeditions.md](next-expeditions.md), or choose another that fits the existing ecosystem. State the visible change, affected modules, budgets, save compatibility, and acceptance evidence. Prefer a satisfying finished interaction over several partial features.
3. **Build.** Start each new addition from current `main` in a fresh `codex/` feature branch and isolated worktree. Resume that expedition's existing branch when repairing incomplete work. Delegate narrow implementation or review tasks where useful, agreeing on shared data contracts first. Keep simulation, rendering, and interface responsibilities clear. Changes stay inside Elsewhere; unrelated MAGI work and secrets are outside the expedition.
4. **Validate.** Add meaningful checks for new behavior and regressions. Run `npm ci` and `npm run validate`, plus appropriate bounded long-run and save compatibility checks. Verify existing browser autosaves and portable snapshots still load. Preserve existing tests and their intent. If the schema changes, support existing saves through a tested migration.
5. **Play.** Inspect the rendered addition in a browser on desktop and portrait layouts. Exercise its interaction, keyboard controls, pause/reset, and save/import paths where affected. Check that the change is visible, coherent, and responsive. Record screenshots and any real-device testing limits.
6. **Review the PR.** Commit and publish the passing expedition to its feature branch, then open a PR against `main`. Review the final remote diff and record its head SHA. Wait for CI to pass on that final PR head and GitHub's tested integration result. If the head or base changes, review again and repeat affected validation and browser checks. Branch and PR workflows validate without deploying.
7. **Merge and deploy.** Merge only the reviewed, passing head SHA through its PR. Recheck both PR head and base immediately before merging and record GitHub's resulting merged commit SHA. Never push scheduled additions directly to `main`. The merge updates `main`, which automatically runs `.github/workflows/pages.yml` and deploys after validation passes. Manual dispatch on `main` remains available to redeploy an already reviewed revision.
8. **Verify and report.** Wait for the merged commit's GitHub workflow and deployment to succeed. Confirm their revision matches that merged SHA and fetch the live `release.json` without using a cached response; its `commit` must match. Then inspect the live site's addition, interactions, and assets. Report what changed, the PR and live links, validation evidence, and any remaining work. Update the expedition notes so the next run can build on it.

## Failure and completion

Failed tests, builds, browser checks, conflicts, or deployment checks stop publication of that candidate. Repair within the current expedition when feasible. Otherwise preserve the isolated work and record the failure, its evidence, and the next concrete step. Do not weaken checks to get a release through or call a failed deployment complete.

Use the project status vocabulary: `in_progress` while working, `completed` when implementation is done, and `verified` only after checks and the live deployment are confirmed. Report `blocked` with the specific dependency when progress cannot continue. If no useful addition is ready, report that outcome without an empty or unverified release.

Normal reports should describe a meaningful addition and link to it. Failures should identify the failed stage and what remains. The development agent can work independently within the authorized Elsewhere scope; a decision outside that scope returns to the Operator.
