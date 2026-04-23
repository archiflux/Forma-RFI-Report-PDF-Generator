---
name: forma-rfi-report
description: Guidance for building the Forma (ACC) RFI Report Generator — a read-only web app that signs users in with their own Autodesk account via 3LO PKCE, scrapes RFIs with custom attributes from the Autodesk Platform Services (APS) RFI v3 API, and renders branded PDF / CSV reports with user-selected fields, sorting, and filtering. Use when working on authentication, API clients, data model, report templates, PDF/CSV export, or UI for this repo.
---

# Forma RFI Report Generator — Contributor Skill

This skill is the single source of truth for how this project is architected and
why. Follow it whenever you add features, refactor, or review code in this repo.

## 1. Product context (important — don't get this wrong)

- **The product was rebranded**: "Autodesk Construction Cloud (ACC)" became
  **"Autodesk Forma"** on **March 24, 2026**. Externally, Bailey Partnership
  staff now see "Forma" in the web UI. Internally (APIs, URLs, logins), nothing
  changed — Autodesk has publicly confirmed the rebrand is cosmetic.
- **APIs still live under "Autodesk Platform Services (APS)"** at
  `https://developer.api.autodesk.com`. Endpoint paths still use
  `/construction/...`, `/project/v1/...`, `/authentication/v2/...`.
- In user-facing copy, say **"Forma"**. In code comments and API-client names,
  use **"APS"** (the stable, product-neutral identifier). Do not rename modules
  every time Autodesk shuffles marketing.
- ACC Build RFIs and Autodesk Docs / Data Management are the relevant surfaces.
  The old "Forma" (the site-design tool) is now "Forma Site Design" — it is
  **not** what we integrate with. We integrate with the RFIs module of what
  users used to call "ACC Build".

## 2. Hard constraints (non-negotiable)

1. **Read-only.** The app MUST NOT write to Forma/APS. Enforce this three ways:
   - Only request read scopes: `data:read account:read viewables:read user-profile:read`.
     Never add `*:create`, `*:write`, or `*:delete`.
   - Only call `GET` and the specific `POST .../search:rfis` endpoint
     (which is a read-shaped POST — APS uses POST because the filter body is
     large). No other POST/PATCH/DELETE calls are allowed.
   - Add a lint rule / code-review checklist item forbidding any other non-GET
     HTTP verb against `developer.api.autodesk.com`.
2. **No secrets in the repo.** The app is a public client using **3-legged
   OAuth with PKCE**. There is **no `client_secret`**. The APS `client_id` is
   public by design (same model as every SPA OAuth app) and lives in
   `NEXT_PUBLIC_APS_CLIENT_ID`. If we ever need a backend-for-frontend (BFF)
   for long-lived refresh tokens, secrets go in the hosting platform's secret
   store (Vercel / Cloudflare env), never in `.env` files committed to git.
3. **User's own credentials.** Every API call is made with the signed-in
   user's 3LO access token. Authorisation is therefore delegated entirely to
   Forma — if the user can't see a project in Forma, they can't see it here.
   We never use 2-legged (service account) tokens.
4. **Multi-project, multi-hub.** A user at Bailey Partnership may belong to
   several hubs (accounts). The UI must let them pick hub → project before
   running a report.
5. **Branding is a late-stage concern.** Get the data pipeline and export
   working first with a clean neutral theme. Bailey Partnership colours, logos,
   and cover pages plug into the report template system via a `Brand` object
   — do not hardcode them into components.

## 3. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | SSR-optional, static-exportable, first-class streaming, good PDF story |
| Styling | **Tailwind CSS + shadcn/ui** | Modern, accessible, themeable, fast to build |
| Data fetching | **TanStack Query v5** | Handles caching, retries, pagination, background refetch cleanly |
| Auth | **APS 3LO PKCE** (`oauth4webapi` or hand-rolled) | No client secret; browser-only |
| PDF | **@react-pdf/renderer** | Declarative React components → PDF; good typography control; easy branding |
| CSV | **papaparse** (`unparse`) | Robust quoting/escaping, streaming for large datasets |
| Forms / filter builder | **react-hook-form + zod** | Type-safe filter schemas |
| State | TanStack Query + small Zustand store for UI (selected fields, filter draft) | Keep server state out of Zustand |
| Deploy | **Vercel** (or Cloudflare Pages) | Static + edge routes for optional BFF |

Avoid: `jspdf` (poor typography), `pdfkit` in the browser (bloated), Redux
(overkill for this scope).

## 4. Architecture at a glance

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser (Next.js SPA)                                             │
│                                                                    │
│  [Sign in] ── 3LO PKCE ──▶ APS /authentication/v2/authorize        │
│      │                                                             │
│      ▼                                                             │
│  access_token in memory (+ refresh_token in httpOnly cookie IF BFF)│
│      │                                                             │
│      ▼                                                             │
│  ApsClient ─── GET /project/v1/hubs ───▶ pick hub                  │
│           ─── GET /project/v1/hubs/:h/projects ─▶ pick project     │
│           ─── GET /construction/rfis/v3/projects/:p/rfi-types      │
│           ─── GET /construction/rfis/v3/projects/:p/attributes     │
│           ─── POST /construction/rfis/v3/projects/:p/search:rfis   │
│                   (paginated, filtered, sorted)                    │
│      │                                                             │
│      ▼                                                             │
│  Report Builder UI → Template + Brand → @react-pdf/renderer        │
│                                       → papaparse (CSV branch)     │
│      │                                                             │
│      ▼                                                             │
│  Blob download (PDF or CSV) — nothing leaves the browser           │
└────────────────────────────────────────────────────────────────────┘
```

Everything after sign-in runs in the browser. Generated reports are produced
client-side and never hit our servers, which means:

- Zero data-at-rest liability for us.
- Works offline once data is loaded.
- Trivially horizontally scalable (static hosting).

## 5. Authentication — 3LO PKCE, step by step

Reference: <https://aps.autodesk.com/en/docs/oauth/v2/tutorials/get-3-legged-token-pkce>.

1. **Register a PKCE app** in the APS developer portal (Application Type:
   *Traditional Web App* with PKCE, or *Desktop/Mobile/Single-Page App*). Set
   callback URL to `https://<our-domain>/auth/callback` plus a
   `http://localhost:3000/auth/callback` for dev.
2. On "Sign in" click:
   - Generate a cryptographically random `code_verifier` (43–128 chars).
   - `code_challenge = BASE64URL(SHA256(code_verifier))`.
   - Store `code_verifier` and a `state` nonce in `sessionStorage`.
   - Redirect to
     `https://developer.api.autodesk.com/authentication/v2/authorize`
     with `response_type=code`, `client_id`, `redirect_uri`, `scope`,
     `code_challenge`, `code_challenge_method=S256`, `state`, `prompt=login`.
3. On callback, verify `state`, then POST to
   `/authentication/v2/token` with `grant_type=authorization_code`,
   `code`, `code_verifier`, `redirect_uri`, `client_id`. **No client_secret.**
4. Store `access_token` **in memory only** (Zustand / React context). Store
   `refresh_token` in `sessionStorage` — acceptable for a public client, and
   it dies on tab close.
5. Schedule a silent refresh ~60s before expiry using
   `grant_type=refresh_token`.

**If we later need persistence across sessions** (e.g. "remember me" across
tab close), do NOT put refresh tokens in `localStorage`. Instead, add a tiny
BFF (Next.js route handler) that:
- Holds the `client_secret` in a hosting-platform secret.
- Exchanges codes and stores refresh tokens in an httpOnly, `SameSite=Lax`,
  `Secure` cookie bound to the user's session.
- Proxies API calls so the access token never hits JS.
That's a later-phase decision; start with pure PKCE.

## 6. APS API surface we consume

All requests include `Authorization: Bearer <access_token>`.

### Hubs / projects (Data Management)
- `GET /project/v1/hubs` — lists hubs (accounts) the user belongs to.
  Filter to ACC/Forma hubs where `attributes.extension.type` contains `"bim360"`
  (still the legacy discriminator despite the rebrand).
- `GET /project/v1/hubs/{hub_id}/projects` — projects in a hub.

### RFI schema (per project)
- `GET /construction/rfis/v3/projects/{projectId}/rfi-types` — type catalogue.
- `GET /construction/rfis/v3/projects/{projectId}/attributes` — custom
  attribute **definitions**. This is the key endpoint that powers the "pick
  which fields to include" UI — every custom field Bailey Partnership has added
  shows up here with its `id`, `name`, `dataType`, and (for choices) its
  `values[]`.
- `GET /construction/rfis/v3/projects/{projectId}/workflow` — workflow states.
- `GET /construction/rfis/v3/projects/{projectId}/users/me` — current user's
  roles / permissions; use to gate UI (e.g. hide "assigned to me" filter if
  the user isn't a reviewer).

### RFI data
- `POST /construction/rfis/v3/projects/{projectId}/search:rfis` — the workhorse.
  Body shape (documented in the APS v3 blog post):
  ```json
  {
    "filter": {
      "status": ["open", "answered"],
      "assignee": ["<userId>"],
      "dueDate": { "gte": "2026-01-01", "lte": "2026-12-31" },
      "customAttributes": [
        { "id": "<attrId>", "values": ["<choiceId>"] }
      ]
    },
    "sort": [{ "field": "dueDate", "order": "asc" }],
    "limit": 200,
    "offset": 0
  }
  ```
  Paginate by incrementing `offset` until `results.length < limit`. **Cap
  in-memory RFI count per report at ~5000** with a progress UI; beyond that,
  stream straight to PDF/CSV instead of buffering.

### Attachments
- `GET /construction/rfis/v3/projects/{projectId}/rfis/{rfiId}/attachments` —
  metadata only. Actual file bytes come from the Data Management API's signed
  URLs. For v1, **list attachment names in the report but don't embed files**.
  Embedding PDFs of drawings blows up report size and latency.

### Endpoints we must NOT call
Anything that creates, modifies, or transitions RFIs. The client should fail a
unit test if any method other than `GET` or `POST .../search:rfis` is sent to
`developer.api.autodesk.com`.

## 7. Data model (internal)

```ts
// src/lib/aps/types.ts
export interface Hub { id: string; name: string; region: string; }
export interface Project { id: string; hubId: string; name: string; }

export interface CustomAttributeDef {
  id: string;
  name: string;
  dataType: "text" | "numeric" | "singleChoice" | "multiChoice";
  values?: { id: string; label: string }[]; // for choice types
}

export interface Rfi {
  id: string;
  number: string;          // human-readable, e.g. "RFI-0123"
  title: string;
  status: string;          // raw workflow state id
  statusLabel: string;     // resolved against /workflow
  createdAt: string;
  dueDate?: string;
  assignee?: { id: string; name: string };
  manager?: { id: string; name: string };
  question?: string;
  officialResponse?: string;
  customAttributes: Record<string /* attrId */, unknown>;
  attachmentCount: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  fields: FieldId[];       // ordered list of built-in + custom fields
  filters: FilterSpec;
  sort: SortSpec[];
  grouping?: FieldId;      // optional group-by, e.g. by status or assignee
  brand: BrandId;          // references /brands/<id>.json
  output: "pdf" | "csv";
  pageSize?: "A4" | "Letter";
  orientation?: "portrait" | "landscape";
}
```

Templates are stored in `localStorage` keyed by hub+project so a user's
"Monthly QS Report" travels with them across sessions. Export/import templates
as JSON so teams can share them.

## 8. Report output

### PDF (`@react-pdf/renderer`)
- Components live in `src/reports/pdf/`.
- One `<ReportDocument>` composed of `<CoverPage>`, `<RfiTable>` (paginated),
  optional `<RfiDetailPage>` per RFI for "full detail" mode, `<Footer>`.
- Brand tokens (`logo`, `primary`, `accent`, `fontFamily`) injected via React
  context. Register fonts with `Font.register` at module load.
- Long tables paginate automatically; use `wrap` and `break` props carefully
  — test with 500+ RFIs.
- Never inline untrusted HTML from RFI `question` / `response` fields.
  Render as plain text or a tightly-allowed markdown subset.

### CSV (`papaparse`)
- Column order matches the selected field order.
- Custom-attribute columns named `"<attrName> (custom)"` to disambiguate from
  built-ins that share a label.
- Multi-choice values joined with `" | "`.
- Dates emitted as ISO 8601 (`YYYY-MM-DD`) in UTC — Excel-friendly and
  unambiguous across locales.
- Encoding: UTF-8 with BOM (so Excel on Windows opens it correctly).

## 9. Security & privacy

- All HTTPS. CSP with `connect-src https://developer.api.autodesk.com`.
- No third-party analytics on authenticated pages (no Google Analytics, no
  Sentry replay) — RFI text is often commercially sensitive.
- Access token lives in memory only. Refresh token in `sessionStorage` (tab
  lifetime). Sign-out clears both and calls APS's `/revoke` endpoint.
- No RFI data is sent to any server we control. The app is effectively a
  "zero-knowledge" client.
- If Sentry/error tracking is added, scrub URLs and bodies — never log
  Autodesk responses.

## 10. Folder layout

```
/
├── README.md
├── .claude/skills/forma-rfi-report/SKILL.md   ← this file
├── .env.example                               ← NEXT_PUBLIC_APS_CLIENT_ID only
├── .gitignore
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 ← landing / sign-in
│   │   ├── auth/callback/page.tsx   ← PKCE token exchange
│   │   ├── (app)/
│   │   │   ├── hubs/page.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── builder/page.tsx     ← pick fields, filters, sort, brand
│   │   │   └── preview/page.tsx     ← live PDF preview before download
│   │   └── api/ (empty unless BFF)
│   ├── lib/
│   │   ├── aps/
│   │   │   ├── client.ts            ← fetch wrapper, GET-only guard
│   │   │   ├── auth.ts              ← PKCE helpers, token store
│   │   │   ├── hubs.ts
│   │   │   ├── projects.ts
│   │   │   ├── rfis.ts              ← search:rfis + pagination
│   │   │   ├── attributes.ts
│   │   │   └── types.ts
│   │   ├── brands/
│   │   │   ├── default.ts
│   │   │   └── bailey-partnership.ts
│   │   └── templates/store.ts
│   ├── components/
│   │   ├── ui/                      ← shadcn primitives
│   │   ├── field-picker.tsx
│   │   ├── filter-builder.tsx
│   │   └── report-preview.tsx
│   └── reports/
│       ├── pdf/
│       │   ├── report-document.tsx
│       │   ├── cover-page.tsx
│       │   ├── rfi-table.tsx
│       │   └── rfi-detail.tsx
│       └── csv/
│           └── build-csv.ts
└── tests/
    ├── aps-client.readonly.test.ts  ← asserts no write verbs
    ├── pkce.test.ts
    ├── pdf.snapshot.test.ts
    └── csv.test.ts
```

## 11. Coding conventions

- TypeScript strict mode on. No `any` without an adjacent `// reason:` comment.
- API response shapes live in `src/lib/aps/types.ts`. Parse with `zod` at the
  boundary — Autodesk has been known to silently add fields.
- Dates: ISO strings on the wire; `Date` objects only inside components.
- Never swallow errors from `ApsClient`; surface them with actionable UI
  ("Your session expired — sign in again" vs a generic toast).
- Keep React components < 200 LOC. Extract `useXyz` hooks for data fetching.
- No inline brand colours in components — always via `useBrand()`.

## 12. Testing priorities

1. **Read-only contract test.** `ApsClient` wrapped with a fetch mock that
   throws if it sees `PUT | PATCH | DELETE` or any `POST` whose path isn't
   `/search:rfis`. This test must run in CI and block merges.
2. **PKCE round-trip.** Mock `authorize` / `token` and verify verifier/challenge
   handling, state validation, refresh flow.
3. **Pagination.** `search:rfis` returning partial pages must be walked until
   exhausted.
4. **PDF snapshot.** Render a 50-RFI fixture and snapshot the PDF byte length
   + page count. Full-pixel snapshots are brittle.
5. **CSV.** Commas, quotes, newlines, unicode, multi-choice in a cell.

## 13. Known gotchas (learn from others' pain)

- `GET /rfis` collection **does not exist** in v3 — you must use
  `POST /search:rfis`. This tripped up our first prototype.
- Hub `id`s are prefixed (`b.<guid>`) for BIM 360 / Forma hubs. Strip or keep
  the prefix consistently — mismatches cause 404s against some endpoints.
- Some custom attributes have `values` only visible when you call
  `GET /attributes` with an `include=values` parameter (check the current
  docs — this behaviour has changed at least once).
- Autodesk token responses occasionally return `expires_in` of 3600 but revoke
  earlier under load. Always handle a 401 mid-session by kicking the refresh
  flow, not by showing "something went wrong".
- CORS: the APS auth endpoints support CORS from browsers for PKCE, but some
  older Data Management endpoints historically required a proxy. If you hit a
  CORS error, don't disable CORS — add a Next.js route handler that proxies
  just that call with the user's bearer token.
- The Feb 2026 rebrand changed some hub display names (`ACC` → `Forma`) but
  the underlying `attributes.extension.type` values are unchanged. Don't filter
  on display names.

## 14. Roadmap phases (match the README)

- **Phase 0 — Scaffold**: Next.js app, Tailwind, shadcn, lint, CI, read-only
  contract test.
- **Phase 1 — Auth**: PKCE sign-in, hub + project picker.
- **Phase 2 — Scrape**: RFI search with pagination, custom-attributes resolver,
  a raw table view.
- **Phase 3 — Builder**: field picker, filter builder, sort, grouping,
  template save/load (localStorage).
- **Phase 4 — Export**: PDF via `@react-pdf/renderer`, CSV via papaparse.
- **Phase 5 — Branding**: Brand context, Bailey Partnership brand pack, cover
  pages.
- **Phase 6 — Polish**: multi-project batch reports, shareable template JSON,
  optional BFF for long-lived sessions, Sentry-free error reporting.

## 15. When adding a feature, do this

1. Confirm it's read-only.
2. Sketch the APS endpoint + scope change (if any) in the PR description.
3. Add a type + zod schema in `src/lib/aps/`.
4. Add a TanStack Query hook.
5. Build the UI.
6. Update report templates if it exposes a new field.
7. Add a test fixture.
8. Update this SKILL.md under §13 if you discover a new gotcha.
