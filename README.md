# Elsewhere

An imaginary ecosystem that grows through new forms of life. Our current direction (2026-10-20) is one genuinely new organism type per daily addition, with a distinct ecological role, funded resource relationships and meaningful autonomous behavior. Habitat and resources shape which types establish and survive; not every type in the catalog needs to coexist. Visitor interactions are very secondary to watching the world grow and adapt. Existing pause, save and accessible controls remain available.

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
- Use **Carry light** (M) to drag existing light to a new feeding ground without adding energy. With the keyboard, Enter picks up and sets down; Escape cancels.
- Use **Stir water** (S) to draw a short directional stroke. An eight-world-second current carries lucents, grazers and loose pigment; light and nests stay anchored. Up to three currents can overlap. With the keyboard: Enter marks the start, arrows shape the stroke, Enter commits, Escape cancels.
- Pause to study a moment; resume to let the ecosystem continue.
- Watch the weather countdown: a 38-second rain spreads light every three minutes, beginning at 00:30. **Call rain** (R) invites a thirty-second shower now, followed by rest until sixty world seconds after the call. Rain widens existing feeding light; it adds no energy. Pause and snapshots preserve both rain and rest.
- Reset asks for confirmation, then returns to the opening tidepool with the same seed.
- **Pocket this world** exports a snapshot to keep an era or transfer it. Opening a snapshot replaces the current pool; save the current one first if you want to keep both.

The interface includes keyboard controls and a visible shortcut reference. Saves belong to this browser and site address. A local development save and a GitHub Pages save are separate. The world advances while the page is running; it does not simulate the time you spend away.

With the habitat focused, arrow keys move an interaction cursor and **Enter** applies the selected tool there. **L** selects Light, **O** selects Observe, **M** selects Carry light, **S** selects Stir water, **R** calls rain, **Space** pauses or resumes, and **Escape** cancels carrying or stirring, or clears the inspection. Global shortcuts yield to focused form controls and dialogs. The habitat starts paused when the browser requests reduced motion; resume when you want to explore it.

The pigment readout measures the combined strength of sediment in the water. The second line shows the grazer population and color stored in nests. These are resource amounts rather than counts of individual marks. Lucents become dimmer when light is scarce and persist so there is always a population to feed when you return. Open the Field guide and choose **Follow a grazer** to inspect its cargo and nest, or touch its amber shell with Observe. Earlier snapshots and browser saves migrate into the expanded ecosystem.

Prism skimmers may emerge naturally from well-fed nests. Look for translucent diamonds gathering pigment, then releasing a small feeding light. They compete with grazers, spend stored color to live, and return their remaining material when they starve or reach eight minutes. Empty nests support none; existing saves receive no free arrivals. Observe a diamond to inspect its reserve. Lucent pigment deposits are now funded by actual light intake, so this recycling loop cannot amplify tiny light remnants into large grains. Reproduction remains a later expedition.

Reedwell plants can root in wet pockets that can pay 0.6 loose pigment. Their five-leaf crowns gather external daylight and release little lights for lucents; night stops gathering. Roots retire after fifteen world minutes and return their pigment. They may be absent, and old saves receive no free plants or energy. Observe a crown to inspect its store; no planting control is needed.

Rainbell polyps can anchor in wet pockets funded by 0.6 loose pigment. They spend stored pigment to pump ordinary currents toward their fixed roots, drawing distant grains into feeding reach. They only gain pigment when a grain actually arrives; pumping and upkeep both cost pigment. Dry, sparse and full-current pools can have no active polyp, and old saves receive none for free. A polyp ends after ten world minutes or a minute without reserve and returns its remaining body and store. Observe its cup to inspect it; no new control is needed.

Siltstitchers may emerge from pigment-rich nests. Watch their forked bodies carry a visible bundle from the nest to a food-poor fringe, leave a real grain, and let a grazer gather that pigment again. Nest pigment pays for each new body, its upkeep, and every carried load. Sparse nests support none; an old save gains no free population. A siltstitcher that cannot keep its reserve or reaches eight world minutes returns its remaining pigment through the pool's bounded return rule. Observe one to inspect its cargo and reserve; no new control is needed.

Glass limpets may settle in suitable shoreline pockets after loose pigment pays for a small fixed shell and reserve. They filter coarse grains only when a real current carries them within reach, holding that pigment where a downstream grazer cannot gather it yet. Their catch basin brightens as it fills. Calm water brings no meal, but upkeep still costs reserve. The shell returns its body, reserve and catch to ordinary loose pigment after eight world minutes or a minute without reserve. Some pools support none, and imported worlds receive no free shells. Observe a shell to inspect its catch; no new control is needed.

## Publish on GitHub Pages

The project lives at `C:\repos\MAGI\elsewhere` in its own Git checkout, connected to `https://github.com/AustinPoulson/elsewhere.git`. GitHub Pages uses GitHub Actions. Use the existing authenticated local Git connection where available; connector tree writes have returned HTTP 403.

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
