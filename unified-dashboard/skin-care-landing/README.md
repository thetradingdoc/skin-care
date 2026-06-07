# Skin & Care landing

Minimal consumer marketing SPA for **Skin & Care** — served at `http://localhost:4000/` and production consumer hosts.

## Build

```bash
cd unified-dashboard/skin-care-landing && npm install && npm run build
```

Or from repo root:

```bash
npm run build:skin-care-landing
```

## Dev (Vite only, port 5180)

```bash
npm run dev
```

For full stack on `:4000`, start middleware after building:

```bash
cd middleware-platform && npm run start:landing
```

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_IOS_APP_URL` | empty | TestFlight or App Store link when available |
| `VITE_API_PROXY` | `http://127.0.0.1:4000` | Vite dev proxy target |
