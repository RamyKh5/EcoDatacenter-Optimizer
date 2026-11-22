
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import pandas as pd
import joblib
import os


BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

MODEL_PATH = PROJECT_DIR / "models" / "lightgbm_60m.joblib"

TEST_DATA_PATH = Path(
    os.getenv(
        "TEST_DATA_PATH",
        str(PROJECT_DIR / "data" / "processed" / "test_data.csv")
    )
)

features = [
    "power_1", "power_2", "power_3",
    "hour", "minute", "regime",
    "temp_lag_1m", "temp_lag_5m",
    "temp_lag_15m", "temp_lag_60m",
    "power_1_lag_1m", "power_1_lag_5m",
    "temp_rolling_mean_15m"
]

# Load the final 60-minute model if available
model = None

if MODEL_PATH.exists():
    try:
        model = joblib.load(MODEL_PATH)
    except Exception as error:
        print(f"Could not load model: {error}")
else:
    print("Final 60-minute model is not available yet.")


app = FastAPI(
    title="EcoDataCenter API",
    description="Backend for temperature forecasting and energy optimization",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://regal-griffin-0eb8cf.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictionInput(BaseModel):
    power_1: float
    power_2: float
    power_3: float
    hour: int
    minute: int
    regime: int
    temp_lag_1m: float
    temp_lag_5m: float
    temp_lag_15m: float
    temp_lag_60m: float
    power_1_lag_1m: float
    power_1_lag_5m: float
    temp_rolling_mean_15m: float


@app.get("/")
def home():
    return {
        "message": "Welcome to EcoDataCenter API!",
        "status": "Backend is running"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/model-info")
def model_info():
    return {
        "model": "LightGBM",
        "dataset": "AAU",
        "prediction": "Average room temperature",
        "horizon": "60 minutes",
        "features_count": len(features),
        "status": "loaded" if model is not None else "pending"
    }


@app.post("/predict")
def predict_temperature(data: PredictionInput):

    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Final 60-minute model is not available yet."
        )

    input_data = pd.DataFrame(
        [data.model_dump()],
        columns=features
    )

    prediction = model.predict(input_data)[0]

    return {
        "predicted_temperature": round(float(prediction), 3),
        "unit": "°C",
        "horizon": "60 minutes"
    }


@app.get("/actual-vs-predicted")
def actual_vs_predicted(limit: int = 100):

    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Final 60-minute model is not available yet."
        )

    if limit < 1:
        raise HTTPException(
            status_code=400,
            detail="Limit must be greater than 0"
        )

    limit = min(limit, 500)

    if not TEST_DATA_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Test dataset not found"
        )

    df = pd.read_csv(TEST_DATA_PATH)

    required_columns = features + ["time", "temp_target_60m"]

    missing_columns = [
        col for col in required_columns
        if col not in df.columns
    ]

    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Missing columns: {missing_columns}"
        )

    sample = df[required_columns].dropna().head(limit)

    if sample.empty:
        raise HTTPException(
            status_code=404,
            detail="No valid test data found"
        )

    predictions = model.predict(sample[features])

    results = []

    for timestamp, actual, predicted in zip(
        sample["time"],
        sample["temp_target_60m"],
        predictions
    ):
        results.append({
            "time": str(timestamp),
            "actual_temperature": round(float(actual), 3),
            "predicted_temperature": round(float(predicted), 3)
        })

    return {
        "unit": "°C",
        "horizon": "60 minutes",
        "count": len(results),
        "data": results
    }
