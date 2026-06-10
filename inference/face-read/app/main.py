"""Face-read inference API — drop-in for legacy teamkelly on :8765."""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI, File, HTTPException, UploadFile

from app import face_age

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("face-read")

app = FastAPI(title="face-read-inference", version=face_age.MODEL_VERSION)


@app.on_event("startup")
async def startup() -> None:
    face_age.load_models()
    st = face_age.status()
    logger.info(
        "teamkelly face-read: age_model_ready=%s dnn_backend=cpu err=%s",
        st["age_model_ready"],
        st["error"],
    )


@app.get("/health")
async def health() -> dict:
    return face_age.status()


@app.post("/v1/face-read")
async def face_read(image: UploadFile = File(...)) -> dict:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="expected_image")
    data = await image.read()
    try:
        result = face_age.analyze_image(data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    # Gate rejects return 200 with structured payload (no age).
    if result.get("reject_reason"):
        return result

    if result.get("apparent_age_estimate") is None:
        raise HTTPException(status_code=422, detail=result.get("quality_flags", ["no_estimate"]))

    return result


def main() -> None:
    import uvicorn

    host = os.environ.get("TEAMKELLY_UVICORN_HOST", "::")
    port = int(os.environ.get("PORT", os.environ.get("FACE_READ_PORT", "8765")))
    uvicorn.run("app.main:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
