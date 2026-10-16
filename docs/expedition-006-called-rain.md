# Expedition 006: call a passing shower

2026-10-16. Ticket: https://trello.com/c/Ecc3UD8y

## New capability

Call rain, or R while the pool is focused, invites a thirty-second shower. Existing light patches widen over six world seconds and lucents can feed farther from the same sources. The water rests for sixty simulated seconds between invitations. Natural rain remains on its original cycle; overlap uses maximum intensity rather than addition. Rain does not grant energy or revive spent light.

A paused invitation shows steady first ringlets and a waiting message immediately, while feeding reach and cooldown wait for resumed time. The active control and its own remaining-shower timer make the touch legible. The rain action sits beside the observations, separate from spatial tools; its portrait touch target is44px high. Cooldown refusals announce remaining world time on demand rather than ticking a live region.

## State, migrations and budgets

One effective weather contract feeds simulation, renderer and interface. World version3/schemaRevision1 stores weatherCall {startedAt,nextAllowedAt}. Ordered pure v1-to-v2-to-v3 migrations preserve old ecology and add inactive weather; current saves strictly require valid fields and exact start+60 cooldown consistency. Hybrid downgrade saves, malformed present fields and future revisions reject rather than silently reset cooldown. Save/load resumes deterministically. The original shower-study JSON is immutable; tests normalize its stored ecology and metadata instead of regenerating historical provenance under new rules.

No entity/particle budget or dependency changes. Renderer reuses48 ring slots and existing light patches. Ghost/carry behavior, all ecological transfers, fixed30Hz steps, caps and storage limits remain unchanged. Preview worlds retain separate weather state and cannot autosave over a held personal pool.

## Validation

- Locked npm ci passed with registry access after the isolated sandbox install could not finish. The final npm run validate passed55 tests in9 files, TypeScript and production build; diff whitespace checks pass. No package or lockfile edits.
- Six new behavior/migration tests cover atomic ecology/time/ID/PRNG preservation, smooth boundaries and max overlap, a lucent actually feeding90 units from existing light during called rain but not calm (with light loss and consumed/energy accounting), cooldown save/reload and deterministic continuation, genuine immutable v2 migration, and malformed/current/future/hybrid rejection. Existing v1 migration, carry, grazer, nest, weather, session, reset and bounds regressions retain their intent under the new normalized schema.
- Independent full-diff source review passed. Review identified a misleading called timer at natural-rain boundaries; it now tracks its own30-second end and has a24-to30-second overlap regression.
- Desktop1280x800: R creates a paused call at00:00, displays waiting status and immediate ringlets, then visibly broadens golden feeding patches when resumed. R during pause refuses with exactly60 remaining world seconds; at00:04 the held cooldown remains56. Reset confirmation restores inactive weather and makes the button available; the visible button calls rain positively.
- Portrait390x844: document width390, all tools fit, rain target44px high. Reload retains the active call and refuses early re-invitation. A shower study can call its own rain while the disposable original remains held; Return restores the complete identical observations, including its prior called-shower timer. Reset cancellation preserves that world.
- Physical touchscreen/multi-touch and OS-level reduced-motion preferences are not device-tested. Browser file upload/download capture retain the previously recorded extension/tool limitation; no permissions were expanded and no unrelated picker contents read. Strict serializer/import/session and old-save migrations are tested; browser reload exercises the actual autosave restore path.

## Side work and publication

The existing dev-only test-toolchain audit card remains separate: https://trello.com/c/9r37KlNj . No unrelated dependency upgrade is bundled. There was no outstanding deployment/claim to recover. The PR/card receipt will record the final reviewed head/base, tested integration, merged SHA, Pages workflow/deployment, uncached matching release marker and live rain acceptance before Completed.
