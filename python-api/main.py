import traceback

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Literal
import uvicorn

import os
from config import PORT, API_SECRET
from services.prediction_service import predict as run_predict
from services.data_service import get_profit_by_period

app = FastAPI(title="TMS Python AI Service", version="1.0.0")


# ── Security middleware ───────────────────────────────────────────────────────

class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Require X-API-Key header on all routes except /health."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)
        api_key = request.headers.get("X-API-Key")
        if not api_key or api_key != API_SECRET:
            raise HTTPException(status_code=401, detail="Unauthorized")
        return await call_next(request)


# Middleware order: CORS first (processed last), then API key check
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("CORS_ORIGIN", "http://localhost:3001")],
    allow_methods=["POST", "GET"],
    allow_headers=["X-API-Key", "Content-Type"],
)
app.add_middleware(ApiKeyMiddleware)


# ── Global error handler ─────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(_request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ── Request / Response models ─────────────────────────────────────────────────

class PredictRequest(BaseModel):
    timeframe: Literal["day", "week", "month"]


class PredictResponse(BaseModel):
    timeframe: str
    labels: list[str]
    historical: list[float]
    predicted: list[float]
    upper_bound: list[float]
    lower_bound: list[float]


class TrainResponse(BaseModel):
    success: bool
    message: str
    samples: int


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "python-api"}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """Return profit forecast for the requested timeframe."""
    result = run_predict(req.timeframe)
    return PredictResponse(**result)


@app.post("/train", response_model=TrainResponse)
def train():
    """Fetch training data and report sample count."""
    try:
        df = get_profit_by_period('month')
        return TrainResponse(
            success=True,
            message=f"Fetched {len(df)} monthly periods from DB",
            samples=len(df),
        )
    except Exception:
        traceback.print_exc()
        return TrainResponse(success=False, message="Internal error during training", samples=0)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
