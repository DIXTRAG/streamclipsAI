# StreamClips AI — Source Audit

**Scope:** static review of the source tree. This is not certification of a production build, live API behavior, or full security review.

## Executive summary

The repository contains a Next.js 15 / React 19 / TypeScript application with Clerk authentication, tRPC, Prisma/PostgreSQL models, chat analysis, FFmpeg video processing, storage adapters, Lemon Squeezy subscription handling, and tests.

The previous audit contained incorrect schema findings. The current `prisma/schema.prisma` confirms:
- `ProcessingJobStatus` exists.
- `ClipStatus` exists.
- `ProcessingJob.parameters`, `priority`, and `attempts` exist.
- `UserAnalytics.lastActiveAt` exists.
- `Clip.status` exists.

Do not apply the previous report's proposed schema additions; they duplicate existing definitions.

## Confirmed implementation

| Area | Source-backed status |
| --- | --- |
| Web app | Next.js 15, React 19, TypeScript |
| Auth/API | Clerk and tRPC routes are present; runtime configuration not verified |
| Database | PostgreSQL/Prisma schema present; migrations not verified |
| Chat analysis | Heuristic chat activity, emote, and sentiment scoring; not proof of an LLM-powered model |
| Video | FFmpeg extraction, thumbnails, and vertical format presets in source; runtime not verified |
| Storage | Vercel Blob and AWS S3 adapters present; credentials/runtime not verified |
| Billing | Lemon Squeezy integration and webhook route present; live billing not verified |
| Twitch | Partial Helix VOD/user/clip API integration plus chat replay adapter |
| Kick | No dedicated Kick API client or complete ingestion flow found in inspected source |
| Publishing | Format conversion exists; no verified automated publishing workflow in reviewed pipeline |

## High-priority findings

1. **Unofficial Twitch chat replay dependency.** `lib/twitch-api.ts` calls a third-party TwitchRecover endpoint and includes a deprecated Twitch v5 fallback. Treat this as experimental. Replace it with an authorized, supportable source or disable chat replay where no compliant source exists.
2. **Twitch VOD playback URL approach.** `getVODDownloadUrl` constructs a Twitch GraphQL playback-token request and HLS URL. This is not a documented public VOD-download API. Do not promise it as stable production functionality; review against current Twitch terms and documented APIs, and process only content the account is authorized to use.
3. **Unsupported marketing claims.** `app/page.tsx` claims GPT-4/Claude, 50K+ clips, 10M+ hours, 95% accuracy, under two minutes, GPU infrastructure, SOC 2, real-time analysis, and thousands of users. No supporting implementation or metrics were found in the inspected files. Remove or substantiate these claims.
4. **In-process job queue.** `lib/job-queue.ts` uses an in-memory processing lock and interval. Multiple app instances can process the same job, and a crash can leave jobs stuck in PROCESSING. Add atomic claiming/leases and stale-job recovery before horizontal scaling.
5. **Webhook idempotency fallback.** Lemon Squeezy webhook processing continues if insertion into `WebhookDedup` fails, allowing duplicate events. Use a durable idempotency strategy and avoid silently continuing on dedup storage failure.
6. **Webhook signature input validation.** `crypto.timingSafeEqual` throws for unequal buffer lengths. Validate signature encoding/length before comparison and add malformed-signature tests.

## Medium-priority findings

1. `getVODs(userId, accessToken, limit)` accepts an access token but calls a helper that uses the client's stored token. Clarify and correct the authentication contract.
2. `getVODs` returns an empty pagination object; implement cursor pagination if needed.
3. `app/dashboard/analyzer/page.tsx` is a sample/pasted-CSV chat analyzer, not a connected end-to-end VOD ingestion workflow. Label it accordingly until integration is complete.
4. `README.md` was the generic create-next-app template. `create-env-file.md` includes an absolute local path and references Stripe/Pusher/Redis despite Lemon Squeezy and other actual dependencies. Reconcile setup documentation with `lib/config.ts`.
5. The prior `TEST_FIXES_SUMMARY.md` records skipped tests and outstanding gaps. Run current CI checks; do not treat that historical summary as proof tests pass.

## Platform scope

- **Twitch:** partial integration; chat replay and media retrieval need a supportable, authorized design.
- **Kick:** not implemented in the inspected source; add through official APIs, OAuth, and explicit authorization.
- **TikTok LIVE:** excluded from this development phase.
- **Destinations:** TikTok, Instagram Reels, and YouTube Shorts appear as FFmpeg format presets only, not verified auto-publishing.

## Recommended order

1. Remove unsupported marketing claims and correct product metadata.
2. Replace the starter README and reconcile environment docs.
3. Add CI for type-check, lint, tests, and production build.
4. Harden queue claiming, leases, retries, and stale-job recovery.
5. Harden webhook signature validation and idempotency.
6. Redesign Twitch chat/VOD ingestion around documented, authorized mechanisms.
7. Implement Kick only after the authorization and ingestion architecture is stable.

## Verification status

This is a static source audit. No production build, full test suite, live Twitch/Kick API call, deployed database migration, or production security review has been certified.
