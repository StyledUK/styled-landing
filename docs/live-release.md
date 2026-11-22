# Releasing styleduk.com

The StyledUK/styled-landing repository deploys its main branch to the styled-landing Vercel project. Both styleduk.com and www.styleduk.com use this project. The production database is Wedding Planner (yfwqcidkfjzpwbylgnug). Feature development continues in styledukprodprogress with its own database.

1. Bring only the approved change across on a branch. Open a pull request. Record the previous Ready deployment URL and the commit being replaced.
2. Review the diff and the GitHub Live release checks, including the isolated SQL fixtures, TypeScript, build and both sign-in forms. Inspect the Vercel preview. Keep private keys in the relevant provider settings.
3. Obtain the domain owner's release approval. Merge the tested revision. Vercel repeats the fixture tests before building. Follow the manual promotion procedure below. After promotion, verify both live aliases, check /api/health, and exercise the changed customer or supplier journey with an authorised test account. Health only indicates that the app responds.
4. If the customer journey fails, stop further releases. In the live Vercel project's Deployments view roll back to the recorded working deployment, check both aliases and the affected journey, then revert the change by pull request before the next deployment.
5. Review database migrations separately. Prefer backwards-compatible additions, verify a restorable backup before destructive changes, and rehearse in development. Rolling back Vercel does not restore database rows or Storage images.

## Operating limits

Require a pull request and the GitHub Actions verify check on main, including for administrators. Keep the branch up to date before merging. Ask another founder to review; assign a mandatory independent reviewer once a second maintainer has accepted write access. Repository owners can edit protections. Before changing repository visibility or ownership, verify both the GitHub protection plan and Vercel integration. This repository and its history are public.

Assign a primary and backup incident owner. Before relying on supplier bookings, test external downtime alerts, an actual supplier inbox delivery, and recovery of both a hosted database backup and its associated Storage images in isolation. Record the evidence and the last drill date. Keep a known working deployment and review support/email queue delays after each release.

The Domain health workflow checks both hostnames twice daily (07:17 and 19:17 UTC), on successful GitHub Production deployment events and on manual dispatch. Review failed Actions notifications and verify both founders receive alerts. This lightweight check does not exercise database operations or replace independent uptime monitoring.

### Staff-led catalogue enquiries, 18 November 2026

Staff can prepare an initial supplier range and record publishing permission in
the private review before approving it. For enquiry-only products, the price
unit is `price on request`. The catalogue shows the label and links customers to
the supplier’s inbox. The order server rejects these products before calculating
a basket total. Enquiry-only products stay out of the priced visualiser look.
Approval of a public photo remains separate from permission to use it in AI
renders. No payment feature or database migration is included.

19 November 2026. Repository ownership moved to StyledUK. The original styled-landing Vercel project now connects to StyledUK/styled-landing and deploys main. Project settings, domain mappings and environment mappings were compared before and after reconnection. This documentation-only release verifies the automatic main deployment trigger. Application code, payments and database are unchanged.

19 November staff login repair. The live main branch still redirected /admin/login to the public homepage and used the customer session for staff pages and APIs. Ported the existing tested development staff login to live, including rate-limited sign-in, HttpOnly staff cookies with chunk-safe names, independent local staff sign-out, existing membership verification, staff-only middleware refresh and safe admin return links. Removed the legacy customer-account admin shortcut. This is an application repair with no password, staff membership, database, payment or catalogue changes. Local automated verification and hosted checks are recorded separately.

## Deployment gate (added 20 November 2026)

Three layers now stand between a merge and styleduk.com:

1. **Pull request checks** (`.github/workflows/live-checks.yml`, unchanged): TypeScript, the fixture test suite, a production build and the sign-in forms on the built app. Required on main by branch protection.
2. **Vercel build** (`scripts/vercel-build.sh`): `scripts/deploy-env-guard.mjs` runs first. A production build fails if `NEXT_PUBLIC_SUPABASE_URL` is not the live Wedding Planner database, the Supabase keys are missing, placeholder or swapped, `NEXT_PUBLIC_SITE_URL` is not styleduk.com, or a feature flag is not exactly `true`/`false`. Missing `CRON_SECRET` or email keys only print warnings. The fixture tests then run again before `next build`.
3. **Deployment smoke test** (`.github/workflows/deployment-smoke.yml`, `scripts/smoke-deployment.mjs`): Vercel sends `vercel.deployment.ready` before promotion. The initial installation also accepted the success event to register the check. Once registered, only the ready event runs the test, so promotion cannot trigger a second status for the same release. Production and preview use distinct commit statuses. The runner comes from protected main and only sends its Vercel credential to this project’s immutable hostname. The job makes read-only GET requests to that exact deployment: health, every public page and both sign-in forms, sign-in redirects, anonymous refusal of admin, supplier and cron APIs, the catalogue and venues loading from the database, 404 handling, robots.txt, the sitemap host and the Supabase project in the browser bundle. It never signs in or writes data. In Vercel > Settings > Deployment Checks, add "Deployment smoke test" as a required check. GitHub commit statuses alone cannot hold a rebuild of an already-tested revision.

Run the smoke test by hand at any time: `node scripts/smoke-deployment.mjs https://styleduk.com --production`. New branch previews must use Wedding Planner Dev. The build and browser checks reject a preview wired to production. Existing immutable previews retain the settings they were built with. Scheduled production jobs stay paused pending queue review. For a protected, immutable deployment URL, set `VERCEL_AUTOMATION_BYPASS_SECRET` first.

### What to do when a release is held

Open the candidate deployment in Vercel and follow **Deployment smoke test** to the GitHub Actions log. Match the deployment URL and commit before inspecting a failure. A preview result is a different check. If the candidate fails, leave the current domain assignment in place, fix the cause by pull request and check the new candidate. After promotion, confirm both public domains resolve to the successful deployment.

The first rehearsal used live PR 15. On the isolated preview, all 31 hosted checks passed, including the browser’s connection to Wedding Planner Dev. GitHub and Vercel each passed the 506-test suite. The rollback address before installation was `styled-landing-geoyk7fhr-valorax-ai-s-projects.vercel.app`. The environment and deployment record is maintained in the [Styled knowledge base](https://github.com/StyledUK/styledukprodprogress/blob/main/docs/knowledge/current-state.md).

### Releasing an already-tested commit again

Each Vercel build has its own deployment ID, including builds made from the same commit. Keep **Auto-assign Custom Production Domains** off under the live project's Production environment. Stage Git and dashboard releases and avoid domain-assignment overrides. Keep the original commit check enabled as a second check.

### Manual promotion checklist

1. In the live project's **Deployments**, select the newest Ready production build from main. Record the URL of the currently serving build for rollback.
2. Open **Deployment smoke test** in GitHub Actions. In its successful run summary, match the immutable URL and deployment ID to the Vercel candidate. Confirm the revision is still the tip of main. Two builds of one revision have different IDs. A green commit badge alone is insufficient.
3. If checks are missing or failed, keep serving the current release. Rerun that candidate's test if its configuration permits recovery, or test a replacement. A newer candidate needs its own result.
4. A maintainer selects **Promote to Production** for the matched candidate in Vercel. GitHub only reports the result and has no promotion credential.
5. Verify that both styleduk.com and www.styleduk.com resolve to the promoted deployment ID. Run the public smoke suite and confirm automatic domain assignment is still off. If needed, roll back to the recorded working deployment and verify both domains.

For a same-revision rehearsal, record both domain IDs before rebuilding. Check them again after the staged build is Ready and after its smoke run. Both should still point to the previous deployment until a maintainer promotes the new ID.

## Test notifications

Every branch push runs the source suite. Open the [live test results](https://github.com/StyledUK/styled-landing/issues/19) to see the outcome and run link. Use the [shared release flow](https://github.com/StyledUK/styledukprodprogress/blob/main/docs/knowledge/push-to-release.md) to distinguish branch tests, pull-request checks, hosted checks and manual promotion.
