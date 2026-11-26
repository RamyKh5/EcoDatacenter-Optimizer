
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path
import pandas as pd
import joblib
import os


# ==================================================
# 1. PATHS AND CONFIGURATION
# ==================================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

MODEL_PATH = Path(
    os.getenv(
        "MODEL_PATH",
        str(PROJECT_DIR / "models" / "lightgbm_60m_optuna.joblib")
    )
)

TEST_DATA_PATH = Path(
    os.getenv(
        "TEST_DATA_PATH",
        str(PROJECT_DIR / "data" / "processed" / "test_data.csv")
    )
)


# ==================================================
# 2. MODEL CONFIGURATION - NOTEBOOK 08
# ==================================================

FEATURES = [
    "power_1",
    "power_2",
    "power_3",
    "hour",
    "minute",
    "temp_lag_1m",
    "temp_lag_5m",
    "temp_lag_15m",
    "temp_lag_60m",
    "power_1_lag_1m",
    "power_1_lag_5m",
    "temp_rolling_mean_15m"
]

MODEL_NAME = "LightGBM Optimized with Optuna"
MODEL_SOURCE = "Notebook 08"
FORECAST_HORIZON = "60 minutes"
TARGET = "temp_target_60m"


# Final metrics are pending confirmation from the ML teammate.
METRICS_STATUS = "validated"


# ==================================================
# 3. ENERGY SIMULATION CONFIGURATION
# ==================================================

COOLING_BASELINE_TARGET = 22.0
COOLING_RELAXED_TARGET = 22.5

BASE_FAN_POWER = 1.5
COMPRESSOR_COEFFICIENT = 0.8


# ==================================================
# 4. SAFE MODEL LOADING
# ==================================================

model = None
model_status = "missing"
model_error = None


def get_model_feature_count(loaded_model):

    count = getattr(loaded_model, "n_features_in_", None)

    if count is not None:
        return int(count)

    booster = getattr(loaded_model, "booster_", None)

    if booster is None:
        booster = getattr(loaded_model, "_Booster", None)

    if booster is not None:
        return int(booster.num_feature())

    return None


def get_model_feature_names(loaded_model):

    names = getattr(loaded_model, "feature_name_", None)

    if names is not None:
        return list(names)

    booster = getattr(loaded_model, "booster_", None)

    if booster is None:
        booster = getattr(loaded_model, "_Booster", None)

    if booster is not None:
        return list(booster.feature_name())

    return None


def load_model():

    global model, model_status, model_error

    if not MODEL_PATH.exists():

        model = None
        model_status = "missing"
        model_error = f"Model file not found: {MODEL_PATH}"

        print(model_error)
        return

    try:

        loaded_model = joblib.load(MODEL_PATH)

        actual_count = get_model_feature_count(loaded_model)
        actual_names = get_model_feature_names(loaded_model)

        if actual_count != len(FEATURES):

            raise ValueError(
                f"Feature count mismatch: expected {len(FEATURES)}, "
                f"got {actual_count}"
            )

        if actual_names is not None and actual_names != FEATURES:

            raise ValueError(
                "Model feature names or order do not match the API."
            )

        model = loaded_model
        model_status = "loaded"
        model_error = None

        print("Notebook 08 model loaded successfully.")

    except Exception as error:

        model = None
        model_status = "error"
        model_error = str(error)

        print(f"Model loading failed: {model_error}")


load_model()


# ==================================================
# 5. FASTAPI APPLICATION
# ==================================================

app = FastAPI(
    title="EcoDataCenter API",
    description=(
        "Backend for 60-minute average room temperature "
        "forecasting and illustrative energy simulation."
    ),
    version="2.2.0"
)


# ==================================================
# 6. CORS CONFIGURATION
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://regal-griffin-0eb8cf.netlify.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ==================================================
# 7. PREDICTION INPUT - 12 FEATURES
# ==================================================

class PredictionInput(BaseModel):

    power_1: float
    power_2: float
    power_3: float

    hour: int = Field(ge=0, le=23)
    minute: int = Field(ge=0, le=59)

    temp_lag_1m: float
    temp_lag_5m: float
    temp_lag_15m: float
    temp_lag_60m: float

    power_1_lag_1m: float
    power_1_lag_5m: float

    temp_rolling_mean_15m: float


# ==================================================
# 8. HELPER FUNCTIONS
# ==================================================

def require_model():

    if model is None:

        raise HTTPException(
            status_code=503,
            detail={
                "message": "The compatible 60-minute model is unavailable.",
                "model_status": model_status,
                "error": model_error
            }
        )


def load_test_data():

    if not TEST_DATA_PATH.exists():

        raise HTTPException(
            status_code=404,
            detail=(
                "Test dataset is not available yet. "
                "Expected file: data/processed/test_data.csv"
            )
        )

    try:

        df = pd.read_csv(TEST_DATA_PATH)

        if df.empty:

            raise HTTPException(
                status_code=404,
                detail="The test dataset is empty."
            )

        return df

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Could not read test dataset: {str(error)}"
        )


def validate_columns(df, required_columns):

    missing_columns = [
        column for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:

        raise HTTPException(
            status_code=400,
            detail=f"Missing columns in test dataset: {missing_columns}"
        )


def get_valid_test_data(required_columns):

    df = load_test_data()

    validate_columns(df, required_columns)

    df = df[required_columns].copy()

    df = df.dropna()

    if df.empty:

        raise HTTPException(
            status_code=404,
            detail="No valid test data found."
        )

    return df


# ==================================================
# 9. HOME ENDPOINT
# ==================================================

@app.get("/")
def home():

    return {
        "message": "Welcome to EcoDataCenter API!",
        "status": "Backend is running",
        "version": "2.2.0"
    }


# ==================================================
# 10. HEALTH ENDPOINT
# ==================================================

@app.get("/health")
def health_check():

    return {
        "status": "healthy",
        "model_status": model_status,
        "model_available": model is not None
    }


# ==================================================
# 11. MODEL INFORMATION
# ==================================================

@app.get("/model-info")
def model_info():

    return {
        "model": MODEL_NAME,
        "model_source": MODEL_SOURCE,
        "dataset": "AAU Temperature and Power Use",
        "prediction": "Average room temperature",
        "target": TARGET,
        "horizon": FORECAST_HORIZON,

        "features_count": len(FEATURES),
        "features": FEATURES,

        "model_filename": MODEL_PATH.name,
        "status": model_status,
        "error": model_error,

        "metrics": {
         "status": METRICS_STATUS,
         "mae": 0.3205,
         "evaluation_count": 6534,
         "unit": "°C",
         "message": (
            "Evaluation metrics from the optimized LightGBM model "
            "using the complete test dataset (Notebook 08)."
        )
        },

        "actual_vs_predicted": {
            "available": TEST_DATA_PATH.exists(),
            "requires_test_dataset": True
        },

        "energy_simulation": {
            "available": TEST_DATA_PATH.exists(),
            "source": "Notebook 07",
            "methods": ["linear", "quadratic"],
            "results_are_simulated": True,
            "real_hvac_measurement": False,
            "validated_savings_available": False
        }
    }


# ==================================================
# 12. TEMPERATURE PREDICTION
# ==================================================

@app.post("/predict")
def predict_temperature(data: PredictionInput):

    require_model()

    input_data = pd.DataFrame(
        [data.model_dump()],
        columns=FEATURES
    )

    try:

        prediction = model.predict(input_data)[0]

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(error)}"
        )

    return {
        "model": MODEL_NAME,
        "predicted_temperature": round(float(prediction), 3),
        "unit": "°C",
        "horizon": FORECAST_HORIZON,
        "input_type": "demo_or_user_provided_features",
        "is_live_sensor_data": False
    }


# ==================================================
# 13. ACTUAL VS PREDICTED
# ==================================================

@app.get("/actual-vs-predicted")
def actual_vs_predicted(limit: int = 100):

    require_model()

    if limit < 1:

        raise HTTPException(
            status_code=400,
            detail="Limit must be greater than 0."
        )

    limit = min(limit, 500)

    required_columns = FEATURES + [
        "time",
        TARGET
    ]

    df = get_valid_test_data(required_columns)

    try:

        predictions = model.predict(df[FEATURES])

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(error)}"
        )

    actual_values = df[TARGET].astype(float).tolist()

    predicted_values = [
        float(value) for value in predictions
    ]

    # MAE calculated on the complete valid test dataset.
    mae = sum(
        abs(actual - predicted)
        for actual, predicted in zip(
            actual_values,
            predicted_values
        )
    ) / len(actual_values)

    # Limit only controls the number of chart points returned.
    sample = df.head(limit)

    results = []

    for index, (_, row) in enumerate(sample.iterrows()):

        results.append({
            "time": str(row["time"]),
            "actual_temperature": round(
                float(row[TARGET]), 3
            ),
            "predicted_temperature": round(
                predicted_values[index], 3
            )
        })

    return {
        "unit": "°C",
        "horizon": FORECAST_HORIZON,
        "mae": round(float(mae), 4),
        "evaluation_count": len(df),
        "count": len(results),
        "data": results
    }


# ==================================================
# 14. ENERGY SIMULATION
# ==================================================

@app.get("/energy-simulation")
def energy_simulation(limit: int = 100):

    require_model()

    if limit < 1:

        raise HTTPException(
            status_code=400,
            detail="Limit must be greater than 0."
        )

    limit = min(limit, 500)

    required_columns = FEATURES + [
        "time",
        "temp",
        TARGET
    ]

    df = get_valid_test_data(required_columns)

    try:

        predictions = model.predict(df[FEATURES])

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Simulation prediction failed: {str(error)}"
        )

    df["predicted_temp"] = predictions

    current = df["temp"].astype(float)
    actual = df[TARGET].astype(float)
    predicted = df["predicted_temp"].astype(float)

    # --------------------------------------------------
    # A. CONTROLLER DECISION
    # --------------------------------------------------

    df["cooling_target"] = [
        COOLING_RELAXED_TARGET if pred < curr
        else COOLING_BASELINE_TARGET
        for curr, pred in zip(current, predicted)
    ]

    # --------------------------------------------------
    # B. LINEAR SIMULATION
    # --------------------------------------------------

    df["linear_baseline_energy"] = (
        actual - COOLING_BASELINE_TARGET
    ).clip(lower=1.0)

    df["linear_smart_energy"] = [
        max(1.0, temp - target)
        for temp, target in zip(
            actual,
            df["cooling_target"]
        )
    ]

    linear_baseline_total = (
        df["linear_baseline_energy"].sum()
    )

    linear_smart_total = (
        df["linear_smart_energy"].sum()
    )

    linear_savings = (
        (
            linear_baseline_total - linear_smart_total
        ) / linear_baseline_total
    ) * 100 if linear_baseline_total else 0.0

    # --------------------------------------------------
    # C. QUADRATIC SIMULATION
    # --------------------------------------------------

    baseline_difference = (
        actual - COOLING_BASELINE_TARGET
    ).clip(lower=0.0)

    smart_difference = (
        actual - df["cooling_target"]
    ).clip(lower=0.0)

    df["quadratic_baseline_energy"] = (
        BASE_FAN_POWER
        + (baseline_difference ** 2)
        * COMPRESSOR_COEFFICIENT
    )

    df["quadratic_smart_energy"] = (
        BASE_FAN_POWER
        + (smart_difference ** 2)
        * COMPRESSOR_COEFFICIENT
    )

    quadratic_baseline_total = (
        df["quadratic_baseline_energy"].sum()
    )

    quadratic_smart_total = (
        df["quadratic_smart_energy"].sum()
    )

    quadratic_savings = (
        (
            quadratic_baseline_total
            - quadratic_smart_total
        ) / quadratic_baseline_total
    ) * 100 if quadratic_baseline_total else 0.0

    # --------------------------------------------------
    # D. CONTROLLER BEHAVIOR
    # --------------------------------------------------

    relaxed_minutes = int(
        (
            df["cooling_target"]
            == COOLING_RELAXED_TARGET
        ).sum()
    )

    total_minutes = len(df)

    relaxed_percentage = (
        relaxed_minutes / total_minutes
    ) * 100 if total_minutes else 0.0

    strict_percentage = 100.0 - relaxed_percentage

    # --------------------------------------------------
    # E. FAN AND COMPRESSOR ANALYSIS
    # --------------------------------------------------

    baseline_fan_total = (
        BASE_FAN_POWER * total_minutes
    )

    baseline_compressor_total = (
        (baseline_difference ** 2).sum()
        * COMPRESSOR_COEFFICIENT
    )

    smart_compressor_total = (
        (smart_difference ** 2).sum()
        * COMPRESSOR_COEFFICIENT
    )

    fan_share = (
        baseline_fan_total / quadratic_baseline_total
    ) * 100 if quadratic_baseline_total else 0.0

    compressor_share = (
        baseline_compressor_total
        / quadratic_baseline_total
    ) * 100 if quadratic_baseline_total else 0.0

    compressor_reduction = (
        (
            baseline_compressor_total
            - smart_compressor_total
        ) / baseline_compressor_total
    ) * 100 if baseline_compressor_total else 0.0

    # --------------------------------------------------
    # F. RESPONSE DATA
    # --------------------------------------------------

    sample = df.head(limit)

    simulation_data = []

    for _, row in sample.iterrows():

        simulation_data.append({

            "time": str(row["time"]),

            "current_temperature": round(
                float(row["temp"]), 3
            ),

            "actual_temperature": round(
                float(row[TARGET]), 3
            ),

            "predicted_temperature": round(
                float(row["predicted_temp"]), 3
            ),

            "cooling_target": float(
                row["cooling_target"]
            ),

            "linear_baseline_energy": round(
                float(row["linear_baseline_energy"]), 3
            ),

            "linear_smart_energy": round(
                float(row["linear_smart_energy"]), 3
            ),

            "quadratic_baseline_energy": round(
                float(row["quadratic_baseline_energy"]), 3
            ),

            "quadratic_smart_energy": round(
                float(row["quadratic_smart_energy"]), 3
            )
        })

    return {

        "source": "Notebook 07",

        "horizon": FORECAST_HORIZON,

        "unit": "simulated energy units",

        "simulation_type": "Illustrative retrospective simulation",

        "is_real_hvac_measurement": False,

        "savings_status": "illustrative_not_validated",

        "linear_simulation": {

            "baseline_total": round(
                float(linear_baseline_total), 3
            ),

            "smart_total": round(
                float(linear_smart_total), 3
            ),

            "simulated_savings_percent": round(
                float(linear_savings), 2
            )
        },

        "quadratic_simulation": {

            "baseline_total": round(
                float(quadratic_baseline_total), 3
            ),

            "smart_total": round(
                float(quadratic_smart_total), 3
            ),

            "simulated_savings_percent": round(
                float(quadratic_savings), 2
            )
        },

        "controller_behavior": {

            "relaxed_target": COOLING_RELAXED_TARGET,

            "strict_target": COOLING_BASELINE_TARGET,

            "relaxed_minutes": relaxed_minutes,

            "total_minutes": total_minutes,

            "relaxed_percentage": round(
                float(relaxed_percentage), 2
            ),

            "strict_percentage": round(
                float(strict_percentage), 2
            )
        },

        "energy_components": {

            "baseline_fan_share_percent": round(
                float(fan_share), 2
            ),

            "baseline_compressor_share_percent": round(
                float(compressor_share), 2
            ),

            "compressor_reduction_percent": round(
                float(compressor_reduction), 2
            )
        },

        "evaluation_count": total_minutes,

        "count_returned": len(simulation_data),

        "data": simulation_data
    }

