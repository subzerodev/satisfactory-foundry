# Post-mortem: the Pages "deploy failures" of 2026-08-06 (#95)

**Outcome:** no deployment ever actually failed. Every red ✗ was
`actions/deploy-pages` giving up at its hard-capped 10-minute wait while
GitHub Pages kept processing in the background and published anyway. The
Stage 19 build went live despite four "failed" runs. The fix (PR #97) makes
the workflow's verdict come from observed reality instead of the action's
patience.

## Timeline (UTC)

| Time | Event | What was really happening |
|---|---|---|
| 10:00 | First-ever deploy (Stage 18, a87440b) — ✅ in 6m56s | Pages processed it just inside the action's 10-min cap |
| 11:47 | Stage 19 deploy (4ed5e16) — ✗ "Timeout reached" | Deployment sat `deployment_queued`; the action gave up at 10:05 and issued a cancel; **Pages processing had slowed past the cap** |
| 12:03 | Retry with `timeout: 1800000` (PR #94) — ✗ at 10:07 | **The bump was a no-op**: deploy-pages clamps to `MAX_TIMEOUT = 600000` (its source, `deployment.js`) — verified later from the run's echoed inputs |
| 13:04 | Manual rerun — ✗ at ~10 min | Same slow-backend stall |
| 13:23 + 13:33 | Push with retry job (PR #96) — deploy ✗, retry ✗ in 6s | Retry re-deployed the same SHA 15 s after the first attempt's cancel; the in-flight cancel killed it (Pages deployments are keyed by build version) |
| 13:42 + 13:47 | "Bisect" redeploys of the morning SHA — ✗ in 1-2s | **Invalid experiment**: re-deploying an already-succeeded build version is rejected as bookkeeping; discriminated nothing |
| ~14:00-14:20 | — | The 13:23/13:33 deployment (4c97b0b) **completed server-side** (`status: succeed`); live site began serving the Stage 19 bundle, byte-identical to the "failed" run's artifact |
| 15:35 | Fix (PR #97) deploys — ✅ | Advisory deploy-pages step timed out AGAIN (backend still slow); verify step: `expecting: assets/index-B6UG7fA7.js → LIVE after 15s` → truthful green |

## Root cause

`actions/deploy-pages` polls the deployment for at most 10 minutes — a hard
ceiling (`MAX_TIMEOUT` clamp; larger `timeout` inputs are ignored with a
warning). On a day when Pages processed this site's deployments slower than
that, the action reported failure and attempted a cancel while the backend
finished the job regardless. The workflow's verdict and reality diverged;
everything else that day was chasing that divergence.

## What went wrong in the response (owned)

- Michael identified the timeout as the problem at the outset; that read was
  functionally correct and was argued with instead of tested. Simply watching
  the site for ~20 minutes after the first ✗ would have ended the incident
  at 12:10.
- The `timeout: 1800000` fix (PR #94) shipped without discovering the clamp
  (it lives in the action's implementation, not its documented `action.yml`);
  it was a reviewed, approved no-op.
- The retry job (PR #96) added a second failure mode (cancel race) instead
  of fixing anything.
- The bisect redeploys were an invalid experiment (terminal build versions
  are rejected) but were initially presented as exonerating content.
- Intermediate hypotheses ("GitHub backend congestion", "rate limiting",
  "wedged Pages site") were stated with more confidence than the evidence
  held. The tell that they were wrong: the Pages deployment status API
  eventually showed `succeed` for a "failed" run.

## The fix (PR #97, live and demonstrated)

- `deploy-pages` step is **advisory** (`continue-on-error: true`) — it still
  performs the deploy, but cannot fail the job.
- The **build fingerprints itself** (hashed bundle filename from
  `dist/index.html`; build fails loudly if the fingerprint is empty).
- A **verify step owns the verdict**: polls the live site for the
  fingerprint, up to 25 min on our own clock, value passed via `env`,
  fail-closed on empty. **Green ⇔ the public site serves the exact build
  the run produced.**
- The broken retry job and the bisect branch were removed.

## Lessons

1. **A CI verdict is a claim, not a fact.** When a deploy "fails", check
   what the target system actually serves before reacting.
2. **A tool's documented inputs are not its behavior.** The clamp was in the
   source, not the schema; the gate reviewed the schema.
3. **Rapid retries against an opaque backend add failure modes** (the cancel
   race) and destroy the evidential value of timing patterns.
4. **Verification belongs at the boundary you care about** — the public URL —
   not inside any vendor's client library.
