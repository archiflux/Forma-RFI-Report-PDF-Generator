# Forma Dashboards

A read-only web app for **Bailey Partnership**. Project teams sign in to
Autodesk Forma (formerly Autodesk Construction Cloud / ACC) with their own
account and get dashboards across any set of projects they can access:
**Issues** (the BCF issue workflow), **RFIs**, **Forms** and **Reviews**.
Every dashboard can be filtered, exported as a branded **PDF** or a **CSV**
register, and shared as a link that opens without a Forma sign-in.

---

## What it does (and, deliberately, doesn't)

**Does:**
- Sign users in with their own Autodesk account (OAuth 3-legged + PKCE, no
  shared credentials).
- Let each user pick projects (alphabetical) and save named project sets.
- Load each module's records for the selected projects and show KPIs,
  monthly trends, breakdowns (click to filter) and a register that links
  every record back to Forma.
- Export the filtered view as a PDF report or the register as CSV, in the
  browser.
- Publish hosted snapshots for people without Forma access, redacted or
  not, with an expiry.

**Does NOT:**
- Write, edit, create, delete, or transition anything in Forma. The fetch
  client and the `/api/aps` proxy block every HTTP verb except `GET` and
  the documented read-style `POST .../search:rfis`.
- Store secrets in the repository or in `localStorage`. See
  [Security](#security).
- Send Forma data to any server we run, **except** when a user explicitly
  publishes a shared link (stored in a private Vercel Blob store; see
  below).

## Dashboards

After choosing a hub, the app opens a **template catalogue** modelled on
Forma Insight's Power BI templates.

| Dashboard | Route | Data (all GET unless noted) |
|---|---|---|
| Issues | `/dashboard` | `/construction/issues/v1/.../issues`, issue types, root causes, custom attribute definitions, locations |
| RFIs | `/rfis-dashboard` | `POST .../search:rfis` (read-shaped), project members |
| Forms | `/forms-dashboard` | `/construction/forms/v1/.../forms`, form templates |
| Reviews | `/reviews-dashboard` | `/construction/reviews/v1/.../reviews`, workflows |
| Submittals | `/submittals-dashboard` | `/construction/submittals/v2/.../items`, item types, metadata (not yet tested against live data) |

- The project selection is in the URL (`?hubId=…&p=<ids>`), so colleagues
  with Forma access can open the same view.
- **Project sets** are stored in `localStorage` keyed by the signed-in
  Autodesk user id: they persist on that browser only and hold project ids
  and names, no Forma data.
- Projects where a tool isn't switched on (the API returns 404) are listed
  as skipped, not as errors.
- **Data probe** (`/probe`): calls read-only APS endpoints for one project
  (plus the account-wide project list and Data Connector) and reports
  status, record counts and which fields carry data. "Copy summary" copies
  field names and counts only, never values.
- **Data availability scan** (on `/probe`): counts records per tool
  (Issues, RFIs, Forms, Reviews, Submittals) in every project you belong
  to, one `limit=1` request per tool per project.
- **Shared links** (`/view?s=<id>`): publish the current data as a hosted
  snapshot that opens without a Forma sign-in. The publisher chooses whether
  to redact (people's names become Person 1, Person 2; issue descriptions
  and custom fields are dropped) and an expiry of 7, 30 or 90 days. "My
  shared links" lists, copies and deletes them. Snapshots don't refresh.

### Setting up shared links (Vercel)

Shared links are the one feature that stores data on a server.

1. In Vercel, open the project, go to **Storage** and create a **Blob**
   store: access **Private**, environment variable prefix left as `BLOB`,
   and tick **Add a read-write token env var**. That gives the project
   `BLOB_READ_WRITE_TOKEN`, which the app looks for.
2. Optional: set `SHARE_ALLOWED_EMAIL_DOMAINS` to change who can publish.
   By default only Autodesk accounts at `bailey-p.net` or `baileyp.co.uk`
   can. Separate several domains with commas.
3. Redeploy.

Publishing checks the user's Autodesk token against
`/userprofile/v1/users/@me` on the server. Viewing needs only the link,
whose id is 144 random bits, and stops at expiry. Locally, snapshots are
written to `.data/share/` instead of Blob.

Issues data comes from `GET /construction/issues/v1/projects/:p/issues`
plus `issue-types?include=subtypes` and
`issue-root-cause-categories?include=rootcauses` for labels. All GET.

## Autodesk Forma vs Autodesk Construction Cloud — naming note

On **17 February 2026**, Autodesk announced that **Autodesk Construction Cloud
(ACC)** would be rebranded to **Autodesk Forma**, with the change taking effect
on **24 March 2026**. Autodesk has publicly confirmed that:

> "No URL, login, API, or integration changes — everything continues to function
> as it does today."

Translation for this repo: users say **"Forma"**, but the APIs still live
under **Autodesk Platform Services (APS)** at
`https://developer.api.autodesk.com` and the endpoint paths are unchanged
(`/construction/rfis/v3/...`, `/project/v1/hubs/...`, etc.). Don't confuse it
with the older product also called "Forma" (the conceptual-design tool), which
has been renamed **Forma Site Design** — that is *not* what we integrate with.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Data fetching / cache | TanStack Query v5 |
| Auth | Autodesk Platform Services 3LO with PKCE |
| PDF | `@react-pdf/renderer` |
| CSV | small built-in writer (UTF-8 BOM, CRLF) |
| Forms / validation | react-hook-form + zod |
| Testing | Vitest + Playwright |
| Hosting | Vercel or Cloudflare Pages (static + optional edge BFF) |

Rationale for each pick lives in `SKILL.md` §3.

## Security

- **Public OAuth client with PKCE.** There is no `client_secret` anywhere —
  PKCE was designed for exactly this case (browser apps). The `client_id`
  is public by design (same model as any other SPA OAuth app) and is exposed
  via `NEXT_PUBLIC_APS_CLIENT_ID`.
- **User's own token.** Every call is made with the signed-in user's
  3-legged access token. If Forma doesn't give them a project, this app
  can't either.
- **Memory-resident access token.** The access token is held in a React/Zustand
  store — never in `localStorage`. The refresh token lives in `sessionStorage`
  (tab lifetime) and is wiped on sign-out.
- **Read-only at the request layer.** Three layers of defence enforce that
  only `GET` and the documented `POST .../search:rfis` ever leave the app:
  the `ApsClient` verb allow-list, the `/api/aps` proxy's matching server-side
  allow-list, and a CI test that fails any PR weakening either. The token
  itself carries `data:read data:write data:create account:read viewables:read
  user-profile:read` — the write/create scopes are required by APS to GET the
  custom-attribute schema (`/construction/rfis/v3/.../attributes`), but the
  code can't actually write because the verb allow-list blocks every non-GET.
  `*:delete` and `*:destroy` scopes remain explicitly forbidden.
- **No data leaves the browser.** PDFs and CSVs are built client-side and
  downloaded via `Blob` URLs. Nothing we host ever sees an RFI.
- **CSP** locked down to `connect-src https://developer.api.autodesk.com`
  plus our own origin.
- **"Remember me" across tab close is a conscious later-phase decision** that
  would require a small backend-for-frontend (BFF) to hold refresh tokens in
  an httpOnly cookie. We don't do this in Phase 1.

If you ever spot a code change that would weaken any of the above, block the
PR.

## Getting started — the plain-English version

You need three things: (1) Node.js installed, (2) a free Autodesk APS developer
app (this takes ~5 minutes), and (3) this repo cloned. You already have (3)
via GitHub Desktop.

### Step 1 — Install Node.js and pnpm (one time)

- Download and install **Node.js 20 or newer**: <https://nodejs.org> (pick the
  "LTS" button).
- Open **Terminal** (macOS) or **PowerShell** (Windows) and run:
  ```bash
  npm install -g pnpm
  ```
  That installs the package manager this project uses.

### Step 2 — Register a free Autodesk APS developer app

APS (Autodesk Platform Services) is Autodesk's developer portal. Creating an
app there gives you a **Client ID** — a non-secret string the app uses to
politely identify itself to Autodesk when a user signs in. You will sign in
to your **own** Autodesk account that already has Forma access.

1. Go to <https://aps.autodesk.com/myapps> and sign in with your Autodesk
   account.
2. Click **Create Application**.
3. **Application type — pick "Desktop, Mobile, Single-Page App"**. This is the
   critical choice. Do **NOT** pick "Traditional Web App" or "Server-to-Server"
   — those are confidential clients that require a `client_secret`, and this
   app is deliberately built as a **public** client with PKCE so no secret ever
   needs to live in the codebase or anywhere else. If you pick the wrong type,
   sign-in will get past the Autodesk consent screen and then fail at the
   token exchange with `401 invalid_credentials: "The client credentials are
   invalid."` — that's the tell-tale sign of the wrong app type.
4. Give it a name (e.g. *"Bailey Partnership RFI Reports — dev"*) and
   description.
5. Under **APIs**, tick:
   - Authentication
   - Data Management API
   - Autodesk Construction Cloud API (this is where RFIs live, regardless of
     the "Forma" rebrand)
6. Set the **Callback URL**. You will add one or two:
   - For local development: `http://localhost:3000/auth/callback`
   - For Vercel hosting: `https://<your-project>.vercel.app/auth/callback`
   - For GitHub Pages hosting (optional, see below):
     `https://<your-github-org>.github.io/Forma-RFI-Report-PDF-Generator/auth/callback/`
     (note the trailing slash — it matters)

   You can add multiple callback URLs on the same app; click **Add URL** to
   add a second one.
7. Click **Create**. On the app's page, copy the **Client ID**. If the portal
   also shows a Client Secret, **ignore it** — public clients don't use one.
   If you don't see a Client Secret at all, that's correct and expected.

### Step 3 — Run it on your machine

Open Terminal/PowerShell, navigate to the folder you cloned
(e.g. `cd ~/Documents/GitHub/Forma-RFI-Report-PDF-Generator`), and:

```bash
pnpm install
cp .env.example .env.local
```

(On Windows PowerShell use `copy .env.example .env.local` instead.)

Open `.env.local` in a text editor and paste your Client ID:

```
NEXT_PUBLIC_APS_CLIENT_ID=paste-your-client-id-here
NEXT_PUBLIC_APS_SCOPES=data:read data:write data:create account:read viewables:read user-profile:read
NEXT_PUBLIC_APS_REDIRECT_URI=http://localhost:3000/auth/callback
```

Then:

```bash
pnpm dev
```

Open <http://localhost:3000> in your browser, click **Sign in with Autodesk**,
approve the permissions, and you'll land on the hub/project picker.

### Step 4 — Where does this actually run when deployed?

You have three choices, in increasing order of "it just works":

| Option | Cost | Custom domain | Setup effort |
|---|---|---|---|
| **GitHub Pages** | Free | Yes, but extra config | Built-in workflow, takes ~10 min |
| **Vercel** | Free for personal / small | Yes, trivial | `git push` and it's live |
| **Cloudflare Pages** | Free | Yes, trivial | Connect repo in dashboard |

**Vercel and Cloudflare Pages work out of the box.** GitHub Pages has a caveat
worth knowing up front: the Forma RFI endpoints don't send CORS headers, so
the app routes them through a tiny same-origin proxy at `/api/aps/*`. That
proxy is a Next.js route handler — it needs a host that can run server code.
**Vercel runs it automatically; Cloudflare Pages runs it via Pages Functions;
GitHub Pages cannot run it at all.** If you deploy to GitHub Pages, sign-in
and the hub/project pickers will work, but the RFI list will fail with a
network error. For production hosting, pick Vercel or Cloudflare Pages.

#### Deploying to GitHub Pages (recommended for a no-extra-accounts setup)

1. Register a **second** callback URL on your APS app:
   `https://<your-org>.github.io/Forma-RFI-Report-PDF-Generator/auth/callback/`
   (mind the trailing slash). Replace `<your-org>` with the GitHub org or user
   that owns the repo — e.g. `archiflux`.
2. In the repo on GitHub, go to **Settings → Pages** and set
   **"Build and deployment → Source"** to **"GitHub Actions"**.
3. In **Settings → Secrets and variables → Actions**, click **New repository
   secret** and add:
   - Name: `NEXT_PUBLIC_APS_CLIENT_ID`
   - Value: the same Client ID you used locally
4. Push a commit to the `main` branch (or run the **"Deploy to GitHub Pages"**
   workflow manually from the Actions tab). The included workflow
   (`.github/workflows/pages.yml`) will build a static export and publish it.
5. Visit `https://<your-org>.github.io/Forma-RFI-Report-PDF-Generator/`.

> **Note on private repos.** GitHub Pages for private repos requires a
> **GitHub Enterprise** plan. If the repo stays private on a normal plan,
> deploy to **Vercel** or **Cloudflare Pages** instead — both support private
> GitHub repos on free tiers.

#### Deploying to Vercel (simplest)

1. Sign up at <https://vercel.com> with your GitHub account.
2. Click **Add New → Project**, pick the repo, and click **Import**.
3. Under **Environment Variables**, add `NEXT_PUBLIC_APS_CLIENT_ID` with your
   Client ID.
4. Click **Deploy**. Register the Vercel URL
   (`https://<project>.vercel.app/auth/callback`) as another callback on
   your APS app.

### Troubleshooting

- **"Token exchange failed: 401 invalid_credentials — The client credentials
  are invalid"** (shown AFTER you successfully click "Allow" on the Autodesk
  consent screen) — your APS app was registered as a confidential client
  (Traditional Web App / Server-to-Server) which requires a client secret.
  This app is public-client/PKCE and doesn't send one. **Fix**: create a new
  APS app with type **"Desktop, Mobile, Single-Page App"** and put the new
  Client ID into `.env.local` (or Vercel env vars) — see Step 2.
- **"Autodesk declined sign-in: invalid_redirect_uri"** — the callback URL
  the app is sending does not exactly match one registered on your APS app.
  Common culprits: missing/extra trailing slash, `http` vs `https`, mismatched
  port.
- **"No projects in this hub that you have access to"** — your Autodesk
  account isn't a member of any projects in that hub. Ask a hub admin to add
  you, or pick a different hub.
- **CORS errors in the browser console** — very occasionally an APS endpoint
  returns a CORS preflight failure; the fix is a small proxy route, not
  disabling CORS. Open an issue and we'll add a proxy for that endpoint only.

## Project structure

```
src/
├── app/(app)/            signed-in pages: hubs, templates, dashboards, probe
├── app/view/             public shared-link viewer (no sign-in)
├── app/api/aps/          read-only APS proxy
├── app/api/share/        shared-link publish / fetch / delete
├── components/dashboard/ shared UI: picker, charts, PDF/CSV, share panel
├── components/generic/   config-driven dashboard (RFIs, Reviews)
├── lib/aps/              APS clients (GET-only) and the probe
├── lib/dashboard/        Issues dataset, aggregation, project sets
├── lib/{forms,reviews,rfis-dash}/  per-module normalisers and configs
├── lib/report/dashboard/ report model, PDF renderer, CSV
└── lib/share/            shared-link storage and handlers
tests/                    includes the read-only contract test
```

## Contributing

1. Read [`SKILL.md`](./.claude/skills/forma-rfi-report/SKILL.md) end-to-end —
   it captures the non-obvious constraints (rebrand trap, read-only contract,
   `POST /search:rfis` quirk, token storage rules).
2. Branch off `main` as `feat/<short-description>` or `fix/<short-description>`.
3. Before opening a PR, confirm:
   - The read-only contract test still passes.
   - No new OAuth scope with `write`, `create`, or `delete` in its name.
   - No secret committed (`git diff` + `gitleaks` if available).
   - `pnpm lint && pnpm typecheck && pnpm test` are green.
4. PR description should name the APS endpoint(s) added and the scope(s)
   required.

## References

- Autodesk Platform Services docs: <https://aps.autodesk.com/en/docs/>
- Autodesk Build RFI v3 API release notes:
  <https://aps.autodesk.com/blog/autodesk-build-rfi-v3-api-released>
- ACC API overview: <https://aps.autodesk.com/en/docs/acc/v1/overview/>
- 3-Legged OAuth with PKCE:
  <https://aps.autodesk.com/en/docs/oauth/v2/tutorials/get-3-legged-token-pkce>
- PKCE SPA sample: <https://github.com/autodesk-platform-services/aps-pkce-webapp>
- Forma rebrand announcement (Feb 2026):
  <https://adsknews.autodesk.com/en/news/autodesk-construction-cloud-is-now-autodesk-forma/>

## Licence

Internal — Bailey Partnership. Licence file to follow.
