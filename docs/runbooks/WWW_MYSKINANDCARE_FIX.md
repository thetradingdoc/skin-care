# www.myskinandcare.com — legacy Somo fix

**Symptom:** `myskinandcare.com` shows Skin & Care; `www.myskinandcare.com` shows legacy Somo B2B.

**Cause:** `www` custom domain is still bound to old Firebase project `doctor-little-c688d`, not site `myskinandcare` in `somo-4ddf6`.

## Fast fix (IONOS)

1. IONOS → **myskinandcare.com** → **Redirect** / domain forwarding
2. Redirect `www.myskinandcare.com` → `https://myskinandcare.com` (301, preserve path)

## Permanent fix (Firebase)

1. Old project (if you still have access): remove `www.myskinandcare.com` custom domain
2. [Firebase `myskinandcare` site](https://console.firebase.google.com/project/somo-4ddf6/hosting/sites/myskinandcare) → add `www.myskinandcare.com`
3. IONOS: `www` CNAME → `myskinandcare.web.app`

## Verify

```bash
npm run check:live-consumer-hosts
LIVE_BASE_URL=https://www.myskinandcare.com npm run test:e2e:live-consumer
```

Expected: redirect to apex or Skin & Care hero on www.
