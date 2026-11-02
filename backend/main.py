

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import pandas as pd
import joblib

BASE_DIR = Path(__file__).resolve().parent

# Load trained model
model = joblib.load(BASE_DIR / "models" / "lightgbm_15m.joblib")

features = [
    "power_1", "power_2", "power_3",
    "hour", "minute", "regime",
    "temp_lag_1m", "temp_lag_5m",
    "temp_lag_15m", "temp_lag_60m",
    "power_1_lag_1m", "power_1_lag_5m",
    "temp_rolling_mean_15m"
]

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
        "prediction": "Temperature",
        "horizon": "15 minutes",
        "status": "trained and loaded"
    }

@app.post("/predict")
def predict_temperature(data: PredictionInput):
    input_data = pd.DataFrame(
        [data.model_dump()],
        columns=features
    )

    prediction = model.predict(input_data)[0]

    return {
        "predicted_temperature": round(float(prediction), 3),
        "unit": "°C",
        "horizon": "15 minutes"
    }
@app.get("/actual-vs-predicted")
def actual_vs_predicted(limit: int = 100):

    if limit < 1:
        raise HTTPException(
            status_code=400,
            detail="Limit must be greater than 0"
        )

    limit = min(limit, 500)

    data_path = BASE_DIR / "data" / "test_data.csv"

    if not data_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Test dataset not found"
        )

    df = pd.read_csv(data_path)

    required_columns = features + ["time", "temp_target_15m"]

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
        sample["temp_target_15m"],
        predictions
    ):
        results.append({
            "time": str(timestamp),
            "actual_temperature": round(float(actual), 3),
            "predicted_temperature": round(float(predicted), 3)
        })

    return {
        "unit": "°C",
        "horizon": "15 minutes",
        "count": len(results),
        "data": results
    }