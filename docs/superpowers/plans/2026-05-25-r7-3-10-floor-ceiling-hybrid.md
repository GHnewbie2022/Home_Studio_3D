# R7-3.10 Floor Ceiling Hybrid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move floor and ceiling diffuse packages from full diffuse short-circuit to first-hit hybrid indirect diffuse, with package audits and HTML review evidence.

**Architecture:** Match the existing north/east hybrid pattern. Bake atlas data stores indirect diffuse only; direct light stays live. Edge-border regression owns reviewed edge black coordinates by package hash and fails on new coordinates.

**Tech Stack:** JavaScript, GLSL, Node test scripts, local HTML review.

---

### Task 1: Step B Guardrail Closeout

**Files:**
- Modify: `docs/tools/r7-3-10-edge-border-audit.cjs`
- Modify: `docs/tests/r7-3-10-edge-border-audit.test.js`
- Modify: `docs/data/r7-3-10-edge-border-baseline.json`

- [ ] Add a failing test that corrupts `allowedEdgeBlackCount` while keeping runs unchanged.
- [ ] Update `validateBaselineEntry` so `decompressRunsToCoordinates(...).size` must equal `allowedEdgeBlackCount`.
- [ ] Add fixture notes requiring `createBaselineEntry` output and manual review for changes.
- [ ] Run edge-border audit tests and valid-black regression.

### Task 2: Hybrid Contract Tests

**Files:**
- Create: `docs/tests/r7-3-10-floor-ceiling-hybrid.test.js`
- Modify: `docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js`
- Modify: `docs/tests/r7-3-10-valid-black-boundary-regression.test.js`

- [ ] Add a test for floor pointer fields: scope, slot 0, indirect kind, live direct-light flag, runtime texture, runtime architecture.
- [ ] Add a test for ceiling pointer fields: scope, slot 5, indirect kind, live direct-light flag, runtime texture, runtime architecture.
- [ ] Add shader contract checks for floor/ceiling `HybridActive`, `HybridRadiance`, `IndirectBakeFirstHit`, hybrid first-hit flags, short-circuit exclusion, and indirect bounce continuation.
- [ ] Update full-room contract expectations from short-circuit to first-hit hybrid for target 1001 and 1006.
- [ ] Remove target 1001 and 1006 from the Step 3 pending set after packages are rebuilt and baseline entries exist.

### Task 3: Runtime Code

**Files:**
- Modify: `shaders/Home_Studio_Fragment.glsl`
- Modify: `js/InitCommon.js`
- Modify: `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`

- [ ] Add floor hybrid helpers using `r7310C1BakePastePreviewUv` and atlas slot 0.
- [ ] Add ceiling hybrid helpers using `r7310C1CeilingDiffuseUv` and atlas slot 5.
- [ ] Add floor/ceiling hybrid flags to first-hit detection, accumulation, short-circuit exclusion, diffuse bounce guard, and indirect bounce continuation.
- [ ] Update loader runtimeScope checks and runtimeArchitecture checks.
- [ ] Add pointer fields in report helpers and runner pointer generation.
- [ ] Update runner runtime scope strings.

### Task 4: Rebuild Packages

**Files:**
- Modify: `docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json`
- Modify: `docs/data/r7-3-10-c1-ceiling-full-room-diffuse-runtime-package.json`
- Modify package artifacts under `assets/bakes/r7-3-10/c1-static-diffuse/floor-full-room-1024px-1000spp`
- Modify package artifacts under `assets/bakes/r7-3-10/c1-static-diffuse/ceiling-full-room-1024px-1000spp`
- Modify: `docs/data/r7-3-10-edge-border-baseline.json`

- [ ] Run the bake capture runner for floor at 1000 samples.
- [ ] Create the floor baseline entry with `createBaselineEntry`.
- [ ] Run package tests and inspect edge-border output.
- [ ] Run the bake capture runner for ceiling at 1000 samples.
- [ ] Create the ceiling baseline entry with `createBaselineEntry`.
- [ ] Run package tests and inspect edge-border output.

### Task 5: Verification and Review

**Files:**
- Modify: `docs/html-review/2026-05-25-r7-3-10-floor-ceiling-hybrid-opus/source.md`
- Modify: `docs/html-review/2026-05-25-r7-3-10-floor-ceiling-hybrid-opus/index.html`

- [ ] Run syntax checks and all R7-3.10 tests touched by this work.
- [ ] Open the local app and produce floor/ceiling visual evidence with floor/ceiling toggles.
- [ ] Write §19 with code changes, package hashes, test output, visual notes, and remaining user visual gate.
- [ ] Regenerate HTML review and run its smoke test.
- [ ] Provide the app URL and review URL for user validation.
