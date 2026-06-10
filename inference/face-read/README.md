# Face-read inference (OpenCV DNN, CPU)

FastAPI service matching the legacy teamkelly contract:

- `GET /health`
- `POST /v1/face-read` — multipart field `image`

## Local

```bash
npm run start:face-read-inference
curl -s http://127.0.0.1:8765/health
```

## Cloud Run

```bash
npm run deploy:face-read-inference
```

Then wire middleware:

```bash
FACE_READ_INFERENCE_BASE_URL=https://YOUR-SERVICE-URL npm run configure:face-read-inference
```

See [docs/runbooks/FACE_READ_INFERENCE.md](../../docs/runbooks/FACE_READ_INFERENCE.md).
