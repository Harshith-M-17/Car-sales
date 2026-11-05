# CarBazaar — used-car marketplace

A marketplace where **independent used-car dealers** list their stock and **buyers** discover cars
and contact the dealer directly. Individual owners can't sell here. The platform doesn't own or
sell cars — it connects people.

In the code a dealer is the `seller` role with a `sellerProfile`, and `/sellers/:id` in the API;
users only ever see the word "dealer".

| Part | Stack |
| --- | --- |
| `backend/` | NestJS 11 · MongoDB (Atlas) via Mongoose 8 · optional Redis · sharp image pipeline |
| `web-next/` | Next.js 16 (App Router) · React 19 · TanStack Query 5 · Tailwind CSS 4 |

The REST API is client-agnostic: a future mobile app uses the same endpoints and the same bearer
tokens.

---

## Quick start (local)

**Prerequisites:** Node.js ≥ 20.19, a MongoDB Atlas connection string. Redis is optional.

```bash
# 1. API
cd backend
npm install
# edit .env -> set MONGODB_URI to your Atlas URI (a JWT secret is already generated)
npm run start:dev                 # http://localhost:4000  ·  docs: http://localhost:4000/api/docs

# optional, in another terminal (after `npm run build`):
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' ADMIN_PHONE=98xxxxxxxx npm run seed:admin
npm run seed:demo                 # 150 demo listings; demo-buyer@carsales.local / Demo@12345

# 2. Web
cd ../web-next
npm install
npm run dev                       # http://localhost:3100 (proxies /api and /uploads to :4000)
# or a production build: npm run build && npm run start
```

In Atlas, allow your machine's IP under **Network Access**.

## Website (`web-next/`)

Home, search, car and dealer pages are rendered on the server, so search engines and link previews
get the full content. Pages behind sign-in only ever load their data in the browser.

- **Server pages are anonymous.** The login is kept in the browser's local storage, so the server
  can't see who's viewing. `HydratePublicData` passes its data to the browser, and signed-in viewers
  fetch their own copy, with saved cars. A car that isn't live is a 404 for the public, while its
  dealer and admins can still open it at the same link.
- **The API being down doesn't break pages.** Server reads never throw, so the page still renders
  and the browser fetches the data itself. Builds don't need the API either.
- **Automatic link prefetching is off**, through `@/components/Link`. Next's default made 36
  background requests on the home page and one API call per car on the dealer dashboard.

### Production settings

| Setting | Where | Value |
| --- | --- | --- |
| `API_ORIGIN` | `web-next`, at build and at run time | The API's URL as this server reaches it |
| `NEXT_PUBLIC_API_URL` | `web-next`, at build time | The API's public URL, e.g. `https://api.example.com/api/v1` |
| `WEB_APP_URL`, `CORS_ORIGINS` | `backend` | This site's URL. Password reset emails link to `WEB_APP_URL`. |
| `INTERNAL_API_KEY` | `backend` and `web-next` | The same random value in both, at least 32 characters |
| `TRUST_PROXY` | `backend` | The number of proxies in front of the API |

**Don't send production traffic through the built-in `/api` rewrites.** Next doesn't pass on
`x-forwarded-for`, so the API would see one IP for all visitors, and everyone would share one rate
limit (10 logins a minute across the whole site). They're there for local development. In
production use `NEXT_PUBLIC_API_URL` as above, or have a reverse proxy send `/api` and `/uploads`
straight to the API.

Server-rendered reads also reach the API from one IP. Set `INTERNAL_API_KEY` so they skip the rate
limit. Without it they count against the limit of 300 anonymous requests a minute, and past that,
pages still work but crawlers get a loading state instead of content.

## Features

- **Buyers:** search with filters (city, brand/model, budget, fuel, transmission, body type, year,
  km, previous owners), free-text search, sort, infinite scroll, saved cars, see which branch a car
  is at, contact the dealer (reveals the branch's phone → call / WhatsApp), inquiry history.
- **Dealers:** sign up with a dealership name and address (or upgrade a buyer account), manage
  branches (each with its own address and optional phone), create/edit listings at a branch with
  photo upload (client-side resize, reorder, cover photo), drafts, pause/re-publish, mark sold,
  delete, stats (views, inquiries, saves), inquiry inbox with status + private notes.
- **Admins:** moderation queue (approve/reject with reason), user search, suspend/reactivate,
  verified-dealer badge, platform stats.
- **Listing lifecycle:** draft → (pending review) → active → paused / sold / expired (auto, after
  `LISTING_TTL_DAYS`) / rejected. Set `LISTING_MODERATION=true` to require admin approval.

## Production notes

| Concern | What to do |
| --- | --- |
| Database | Atlas cluster; `MONGODB_MAX_POOL_SIZE` per instance. For big collections set `MONGODB_AUTO_INDEX=false` and run `npm run db:indexes` during deploys. |
| Scaling out | Set `REDIS_URL` (e.g. ElastiCache / Upstash). Cache, rate limits, view counters and cron locks then work across instances. Without it, in-process fallbacks are used (single instance only). |
| Images | `STORAGE_DRIVER=s3` with any S3-compatible bucket (AWS S3, Cloudflare R2, DO Spaces) and `PUBLIC_MEDIA_BASE_URL` pointing at a CDN. Objects are immutable and served with 1-year cache headers. |
| Behind a proxy / LB | `TRUST_PROXY=1` so rate limiting sees real client IPs. |
| Website | `npm run build`, then `npm run start` on a Node server (`PORT` overrides 3100). See the [website's production settings](#production-settings). |
| Email | `MAIL_DRIVER=smtp` with `MAIL_FROM` and `SMTP_*` from any SMTP service, and `WEB_APP_URL` set to the public site. The API refuses to start in production without these, because reset links would otherwise go to the logs. |
| Health checks | Liveness `GET /api/health/live`, readiness `GET /api/health/ready` (Mongo + Redis). |
| Logs | Structured JSON (pino) with `x-request-id` correlation; auth headers redacted. |

## How performance is handled

- **No N+1 queries.** Seller info is denormalised onto listings (kept in sync with one
  `updateMany` on profile change), so search renders with one query. The "is this saved?" hearts
  for a page of results are one index-covered `$in` lookup. Favourites/leads pages are two queries
  regardless of size. An e2e test counts MongoDB commands and fails if a page of 30 issues more
  queries than a page of 2.
- **Indexes designed for the queries.** Search indexes are *partial* on `status: active` (sold or
  expired cars don't bloat them) and follow Equality → Sort → Range. A test runs `explain()` on
  common searches and asserts index scans with no in-memory sort.
- **Keyset (cursor) pagination** everywhere, never `skip`, so page 500 costs the same as page 1.
- **Projections:** list endpoints load only card fields; detail pages load the rest.
- **Counting is capped and cached.** Totals are computed on the first page only, capped at 10,000
  ("10,000+ cars") and cached for 60s; facet counts are cached for 5 minutes.
- **Caching:** listing detail, similar cars, seller profiles and facets go through a read-through
  cache with single-flight (no stampede). Writes invalidate. Public GETs send `Cache-Control` for
  browser/CDN caching; the catalog uses ETags.
- **View counting without write amplification:** views are de-duplicated per viewer for 6h,
  buffered in Redis/memory, and flushed every 30s as one `bulkWrite`. Views come from an explicit
  beacon, so prefetching and CDN caching never skew them.
- **Images:** resized in the browser before upload, then normalised server-side to WebP (1600px
  and a 480×360 thumbnail) with EXIF/GPS stripped. Orphaned uploads are garbage-collected hourly.
- **Web:** route-level code splitting (forms libraries load only on form pages), lazy images with
  fixed dimensions (no layout shift), hover-intent prefetch, optimistic favourite toggles,
  URL-synced filters that update results without a server round trip.

## Security

argon2id password hashing (timing-safe login), 15-minute JWT access tokens and rotating refresh
tokens with reuse detection (a replayed token revokes the whole session family), both kept in the
browser's local storage with no cookies, session revocation on password change and suspension, single-use password reset links (1 hour,
stored hashed, rate limited, and the response never reveals whether an email has an account), per-route rate limits
(per user when signed in, per IP otherwise), strict DTO validation that rejects unknown fields,
`strictQuery`, Helmet headers, CORS allow-list, upload type/size limits and decompression-bomb
protection, and phone numbers revealed only to signed-in buyers who send an inquiry.

## API overview (`/api/v1`)

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/session` · `/auth/logout` · `/auth/logout-all` · `/auth/password/forgot` · `/auth/password/reset` |
| Me | `GET/PATCH /me` · `POST /me/seller-profile` · `PATCH /me/password` · `POST /me/branches` · `PUT/DELETE /me/branches/:id` |
| Catalog | `GET /catalog` (makes/models, cities, states, features) |
| Listings | `GET /listings` (search) · `GET /listings/facets` · `GET /listings/:id` · `POST /listings/:id/views` · `GET /listings/:id/similar` |
| Seller | `GET /listings/mine` · `GET /listings/mine/stats` · `GET /listings/mine/:id` · `POST /listings` · `PATCH /listings/:id` · `POST /listings/:id/{publish,deactivate,mark-sold}` · `DELETE /listings/:id` · `POST /media/images` |
| Sellers | `GET /sellers/:id` · `GET /sellers/:id/listings` |
| Favourites | `GET /favorites` · `PUT/DELETE /favorites/:listingId` |
| Leads | `POST /leads` · `GET /leads/sent` · `GET /leads/received` · `GET /leads/received/new-count` · `PATCH /leads/:id` |
| Admin | `GET /admin/stats` · `GET /admin/listings` · `POST /admin/listings/:id/{approve,reject}` · `GET /admin/users` · `PATCH /admin/users/:id/{status,verification}` |

Full interactive docs: `/api/docs` (disable with `SWAGGER_ENABLED=false`).

## Testing

```bash
cd backend
npm test                                                # unit tests
npm run test:e2e                                        # full API against a throwaway mongod
TEST_REDIS_URL=redis://127.0.0.1:6379/15 npm run test:e2e   # same suite with Redis-backed paths
cd ../web-next && npm run typecheck && npm run lint && npm run build
```

The e2e suite boots the real app (same middleware as production) against an in-memory MongoDB
(no Docker), covering auth flows, uploads, the listing lifecycle, favourites, leads, admin
moderation, pagination correctness, the N+1 guard and index usage.

## Roadmap (next phases)

1. **SEO:** `web-next/` renders public pages on the server. Still to add: a sitemap and structured
   data for cars.
2. **Email verification** at sign-up. Addresses aren't checked today, so whoever owns a mistyped
   address could use a reset link on that account. Admin accounts are excluded from reset links
   for this reason, so an admin must keep their password.
3. **Notifications:** SMS/WhatsApp/email to sellers on new leads (the `lead.created` event is already emitted).
4. **Mobile app** (React Native / Expo) on the same API.
5. **Atlas Search** for typo-tolerant search and faster facets at large scale.
6. Monetisation: featured/boosted listings, dealer subscriptions.
