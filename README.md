# Forma RFI Report Generator

A read-only web app for **Bailey Partnership** that lets our project teams log
into Autodesk Forma (formerly Autodesk Construction Cloud / ACC) with their
own account and generate **branded, fine-tuned RFI reports** as **PDF** or
**CSV** — filtered, sorted, and grouped by any built-in or custom RFI field
across any project we have access to.

> **Status:** Planning / scaffolding. Nothing to run yet. See
> [Roadmap](#roadmap).

---

## Why this exists

Forma's built-in RFI report publisher forces a bad trade-off:

- **Detailed reports** include every custom field but cap out at **50 RFIs**.
- **Summary reports** raise the cap to ~1000 but strip out the custom fields
  Bailey Partnership has added — which is exactly the data the reports need.
- Neither path supports **fine-grained filtering/sorting by multiple custom
  fields at once**, and neither produces a branded deliverable we can hand to
  a client.

This app closes that gap by talking to the Forma REST APIs directly, pulling
the RFIs the user can already see, and rendering them into a report **we**
design.

## What it does (and, deliberately, doesn't)

**Does:**
- Sign users in with their own Autodesk account (OAuth 3-legged + PKCE — no
  shared credentials, no API keys to manage).
- List hubs and projects the signed-in user belongs to.
- Scrape all RFIs from the chosen project, including every custom attribute.
- Let the user pick which fields to include, filter on any combination of
  fields (including custom ones), sort, and group.
- Save report "templates" locally and reuse them across projects.
- Export as **PDF** (primary, branded) or **CSV** (data-first).
- Apply Bailey Partnership branding (logo, colours, cover pages) — or any
  other brand pack — via a swappable `Brand` object.

**Does NOT:**
- Write, edit, create, delete, or transition anything in Forma. Ever.
  The app requests **only read scopes** and the fetch client blocks every
  HTTP verb except `GET` and the single documented read-style
  `POST .../search:rfis` request.
- Store any API keys or client secrets in the repository, in `.env` files,
  in `localStorage`, or anywhere else sketchy. See [Security](#security).
- Ship RFI data through any server we run. Reports are generated
  **entirely in the browser**.

## How it works

```
 User ──▶ Sign in with Autodesk ──▶ APS 3LO PKCE ──▶ access_token (in memory)
                                                         │
                                                         ▼
                                          Hubs → Projects → RFI search
                                             (APS RFI v3 API)
                                                         │
                                                         ▼
                              Field picker · Filters · Sort · Grouping · Brand
                                                         │
                                                         ▼
                                        @react-pdf/renderer   ·   papaparse
                                                 │                    │
                                                 ▼                    ▼
                                             PDF file             CSV file
                                           (download)           (download)
```

A more detailed architecture lives in
[`.claude/skills/forma-rfi-report/SKILL.md`](./.claude/skills/forma-rfi-report/SKILL.md).

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
| CSV | `papaparse` |
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
- **Read-only scopes only.** `data:read account:read viewables:read
  user-profile:read`. No `*:write`, `*:create`, or `*:delete` scope is ever
  requested; adding one would be a blocking code review comment.
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
3. Choose application type **"Traditional Web App"** (PKCE). If the portal
   only offers "Server-to-Server" and "Desktop, Mobile, Single-Page App",
   pick the latter — both support PKCE.
4. Give it a name (e.g. *"Bailey Partnership RFI Reports — dev"*) and
   description.
5. Under **APIs**, tick:
   - Authentication
   - Data Management API
   - Autodesk Construction Cloud API (this is where RFIs live, regardless of
     the "Forma" rebrand)
6. Set the **Callback URL**. You will add one or two:
   - For local development: `http://localhost:3000/auth/callback`
   - For GitHub Pages hosting (optional, see below):
     `https://<your-github-org>.github.io/Forma-RFI-Report-PDF-Generator/auth/callback/`
     (note the trailing slash — it matters)

   You can add multiple callback URLs on the same app; click **Add URL** to
   add a second one.
7. Click **Create**. On the app's page, copy the **Client ID**. Ignore the
   Client Secret — this app doesn't use one (that's the whole point of PKCE).

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
NEXT_PUBLIC_APS_SCOPES=data:read account:read viewables:read user-profile:read
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

**All three work** — the app is 100% client-side once signed in, so anywhere
that serves static files is fine. GitHub Pages is the simplest "our repo hosts
itself" option, so that's what the repo is pre-configured for.

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

## Roadmap

| Phase | Goal | Status |
|---|---|---|
| **0. Scaffold** | Next.js + Tailwind + TS strict + CI + read-only contract test | ✅ done |
| **1. Auth** | Sign in with Autodesk (PKCE), sign out, silent refresh, hub + project picker | ✅ done |
| **2. Scrape** | RFI list with full pagination, custom-attribute resolver, raw table view with text filter | ✅ done |
| **3. Builder** | Field picker, multi-field filter builder, sort, group-by, save/load templates in localStorage, import/export as JSON | ✅ done |
| **4. Export** | PDF (`@react-pdf/renderer`) and CSV (`papaparse`) — branded cover, grouped sections, A4/Letter, portrait/landscape, BOM'd UTF-8 CSV with RFC 4180 CRLF | ✅ done |
| **5. Brand** | Logo upload, additional brand packs, brand switcher in the builder | 🔜 next |
| **6. Polish** | Multi-project batch reports, shareable template JSON, optional BFF for long-lived sessions, better empty/error states | pending |

We'll cut a release at the end of each phase and dogfood it on a real project
before starting the next one.

## Project structure (target)

```
.
├── README.md                         ← this file
├── .claude/skills/forma-rfi-report/
│   └── SKILL.md                      ← contributor / architecture guide
├── .env.example                      ← NEXT_PUBLIC_APS_CLIENT_ID only
├── src/
│   ├── app/                          ← Next.js routes
│   ├── lib/aps/                      ← APS API client (GET-only)
│   ├── lib/brands/                   ← brand packs (default, bailey-partnership)
│   ├── lib/templates/                ← report template store
│   ├── components/                   ← UI (field picker, filter builder, ...)
│   └── reports/                      ← pdf/ + csv/ renderers
└── tests/                            ← including the read-only contract test
```

See `SKILL.md` §10 for the full, annotated layout.

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
