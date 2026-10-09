# Elsewhere

An imaginary ecosystem that grows through our creative experiments. Every new addition should interact with something already living here.

Phase 1 is **The Luminous Tidepool**: a small overhead world inhabited by lucents. Place light in the water, watch them gather and feed, then discover the pigment they leave behind. Pigment grazers gather those traces and carry their colors into woven nests. Passing rain widens light patches and the floor where lucents can feed. There is no score or win condition. Playing means shaping the conditions and observing what follows.

Phase 1 is live at [austinpoulson.github.io/elsewhere](https://austinpoulson.github.io/elsewhere/) in the public [AustinPoulson/elsewhere repository](https://github.com/AustinPoulson/elsewhere). Daily development at 9 AM Central uses feature branches and reviewed PRs before deployment. See [the acceptance report](docs/phase-1.md) for local and live checks and their limits, and [scheduled expeditions](docs/automation.md) for the recurring workflow.

## Run locally

Use Node.js 22.12 or newer. From this directory:

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:4173/`. Keep the terminal running while exploring.

```powershell
npm run validate
npm run build
npm run preview
```

`validate` runs the simulation tests, TypeScript checks, and production build. `build` writes the static site to `dist/`. `preview` serves that build locally. The site needs a web server; opening `index.html` directly from disk is not a supported way to run it.

## Explore

- Use **Light** to place nourishment in the pool with a pointer or touch.
- Use **Observe** to inspect an organism and open its field notes.
- Pause to study a moment; resume to let the ecosystem continue.
- Watch the weather countdown: a 38-second rain spreads light every three minutes, beginning at 00:30. Pause and snapshots preserve its place in the cycle.
- Reset asks for confirmation, then returns to the opening tidepool with the same seed.
- **Pocket this world** exports a snapshot to keep an era or transfer it. Opening a snapshot replaces the current pool; save the current one first if you want to keep both.

The interface includes keyboard controls and a visible shortcut reference. Saves belong to this browser and site address. A local development save and a GitHub Pages save are separate. The world advances while the page is running; it does not simulate the time you spend away.

With the habitat focused, arrow keys move an interaction cursor and **Enter** applies the selected tool there. **L** selects Light, **O** selects Observe, **Space** pauses or resumes, and **Escape** clears the inspection. Global shortcuts yield to focused form controls and dialogs. The habitat starts paused when the browser requests reduced motion; resume when you want to explore it.

The pigment readout measures the combined strength of sediment in the water. The second line shows the grazer population and color stored in nests. These are resource amounts rather than counts of individual marks. Lucents become dimmer when light is scarce and persist so there is always a population to feed when you return. Open the Field guide and choose **Follow a grazer** to inspect its cargo and nest, or touch its amber shell with Observe. Earlier snapshots and browser saves migrate into the expanded ecosystem.

## Publish on GitHub Pages

The project lives at `C:\repos\MAGI\elsewhere` in its own Git checkout, connected to `https://github.com/AustinPoulson/elsewhere.git`. GitHub Pages uses GitHub Actions. Local Git authentication is unavailable and connector tree writes return HTTP 403; the signed-in GitHub browser is a supported publication fallback without changing account permissions.

The included `.github/workflows/pages.yml` is intended for that standalone root. GitHub does not discover a workflow nested inside `elsewhere/.github/` in the surrounding MAGI repository.

For each addition:

1. Create a fresh `codex/` feature branch from current `main` and build the addition in isolation.
2. Run local tests and browser QA, then push or upload to that feature branch and open a PR against `main`.
3. Review the final PR diff and wait for passing CI on its final head and tested integration result. Recheck after any changes.
4. Merge that reviewed head through the PR; do not push scheduled additions directly to `main`. The resulting `main` workflow tests, builds, and deploys after passing checks.
5. Visit the deployment URL shown by the `github-pages` environment and confirm the live `release.json` commit matches GitHub's merged commit SHA. Inspect the live addition before calling publication verified.

Pages is configured with **GitHub Actions** as its publishing source. To redeploy an already reviewed `main` revision manually, use **Actions → Elsewhere checks and Pages → Run workflow** and select `main`. PRs, other branch pushes, and manual runs on other branches validate without deploying.

The workflow computes the asset base from the repository name: `/` for `<owner>.github.io`, otherwise `/<repository>/`. Local builds default to relative asset paths. To test an explicit project path in PowerShell:

```powershell
$env:PAGES_BASE_PATH = '/elsewhere/'
npm run build
Remove-Item Env:PAGES_BASE_PATH
```

The initial release was merged through PR #1 and its live deployment was verified. GitHub Pages setup follows [GitHub's custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Every production build includes `release.json`. In GitHub Actions, its `commit` records the workflow's `GITHUB_SHA`; local builds record `null`. The daily task compares the live release commit with the intended deployed revision before reporting publication as verified.

## Continue the collaboration

Start with [the architecture](docs/architecture.md), [Phase 1 acceptance](docs/phase-1.md), and [possible next expeditions](docs/next-expeditions.md). A useful brief names a new relationship, the behavior we want to see, its limits, and the evidence that will make it reviewable.

We can keep adding species, weather, habitats, and artifacts without turning the opening pool into a large game engine first.
