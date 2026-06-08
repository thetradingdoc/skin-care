# myskinandcare.com — IONOS DNS (Somo GCP, Option B)

Consumer UI and API on the **existing Somo stack** (`richard@callsomo.com`). Same public URLs as a future GCP migration — only DNS targets change later.

| Host | Target | GCP service |
|------|--------|-------------|
| `myskinandcare.com` + `www` | Firebase Hosting | Project **`somo-4ddf6`** |
| `api.myskinandcare.com` | Cloud Run | Service **`somo-middleware`** in **`somo-callsomo`** |

Deploy commands: [`SKIN_AND_CARE_REPO.md`](../Brand/SKIN_AND_CARE_REPO.md).

---

## Prerequisites (operator)

1. `gcloud auth login` and `firebase login` as **richard@callsomo.com**
2. Run once: `npm run setup:myskinandcare:somo` (creates Hosting site `myskinandcare`, Cloud Run mapping, prints DNS)
3. Firebase Console → **`somo-4ddf6`** → Hosting → site **`myskinandcare`** → add custom domains `myskinandcare.com` and `www.myskinandcare.com` (keeps `callsomo.com` on the default site)

---

## Step 1 — Firebase custom domain (website)

1. [Firebase Console](https://console.firebase.google.com/project/somo-4ddf6/hosting/sites/myskinandcare) → site **`myskinandcare`**
2. **Add custom domain** → `myskinandcare.com`
3. **Add custom domain** → `www.myskinandcare.com`
4. Copy DNS records from the setup panel (use these if Firebase matches `callsomo.com` on the same project):

| Type | Host | Value |
|------|------|-------|
| A | `@` | `199.36.158.100` |
| TXT | `@` | `hosting-site=myskinandcare` (Firebase site ID — confirm in Hosting console) |
| CNAME | `www` | `myskinandcare.web.app` |

---

## Step 2 — IONOS DNS (website)

**Where:** [IONOS](https://www.ionos.com) → Domains → **myskinandcare.com** → **DNS**

### Remove conflicts

- Squarespace parking A/CNAME on `@` or `www`
- Domain **forward/redirect** rules for `myskinandcare.com` (except the www→apex redirect below)
- **`www` CNAME** pointing at old hosts (e.g. `doctor-little-c688d.web.app`) — must be **`myskinandcare.web.app`**
- Stray apex **A** records not matching Firebase

Leave **MX** records unless you intentionally change email.

### Fix `www` still showing legacy Somo

If apex (`myskinandcare.com`) is Skin & Care but **`www` shows Somo**, the `www` custom domain is still bound to an old Firebase project (`doctor-little-c688d`).

**Fastest fix (IONOS):** Domain settings → **Redirect** `www.myskinandcare.com` → `https://myskinandcare.com` (301).

**Permanent fix (Firebase):** Remove `www.myskinandcare.com` from the old Firebase project, then add it to site **`myskinandcare`** in `somo-4ddf6`.

### Add / fix records

| Type | Host name | Points to / Value |
|------|-----------|-------------------|
| A | `@` | `199.36.158.100` (add all A rows Firebase lists) |
| TXT | `@` | `hosting-site=myskinandcare` |
| CNAME | `www` | `myskinandcare.web.app` |

IONOS host is `@` or blank for apex, `www` for www — not the full FQDN.

Save and wait for Firebase **Connected** + TLS **Active** (15 min–48 h).

---

## Step 3 — Verify domain with Google (required for API mapping)

Cloud Run will reject `api.myskinandcare.com` until the root domain is verified:

```bash
gcloud domains verify myskinandcare.com
```

1. Browser opens **Google Search Console**
2. Choose **Domain** verification
3. Copy the **TXT** record Google gives you
4. Add it in **IONOS** (host `@`, type TXT)
5. Wait for verification (minutes–hours)

## Step 4 — Cloud Run API domain

```bash
npm run setup:myskinandcare:somo
```

Or manually:

```bash
gcloud config set project somo-callsomo
gcloud beta run domain-mappings create \
  --service=somo-middleware \
  --domain=api.myskinandcare.com \
  --region=us-central1 \
  --project=somo-callsomo
```

---

## Step 5 — IONOS DNS (API)

| Type | Host name | Points to |
|------|-----------|-----------|
| CNAME | `api` | `ghs.googlehosted.com` (confirm via `gcloud beta run domain-mappings describe`) |

**Note:** A CNAME alone is not enough — Cloud Run must have the domain mapping (Step 3). Symptom if missing: `503` on `https://api.myskinandcare.com/health/live` while `api.callsomo.com` works.

---

## Step 6 — Deploy consumer site

```bash
npm run deploy:consumer-hosting
```

Builds `hosting-dist-consumer/` with `VITE_API_BASE=https://api.myskinandcare.com` and deploys to **`somo-4ddf6`**.

---

## Step 7 — Verify

```bash
# DNS
dig +short myskinandcare.com A
dig +short www.myskinandcare.com CNAME
dig +short api.myskinandcare.com CNAME

# HTTP
npm run gcp:skin-care:check
node scripts/verify-consumer-hosting.cjs --live https://myskinandcare.com
curl -sS https://api.myskinandcare.com/health/live
```

Expected:

- Apex A → `199.36.158.100`
- www CNAME → `myskinandcare.web.app.`
- api CNAME → `ghs.googlehosted.com.`
- API health → `{"alive":true}`

---

## Rollback

1. IONOS: restore previous A/CNAME records
2. `callsomo.com` / `api.callsomo.com` remain available

---

## Stripe webhooks

After API is live, add or update Stripe webhook URLs to `https://api.myskinandcare.com/...` in the Stripe Dashboard.

---

## Future migration (doctorjay254@gmail.com / skin-and-care-prod)

Keep **`myskinandcare.com`** and **`api.myskinandcare.com`** as consumer URLs. Repoint IONOS to the new Firebase + Cloud Run projects; app and TestFlight builds do not need URL changes.

See [`bootstrap-skin-care-gcp.sh`](../../scripts/bootstrap-skin-care-gcp.sh) for the alternate full-migration path.
