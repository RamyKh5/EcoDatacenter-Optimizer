
import pandas as pd
from pathlib import Path

# Raw dataset (relative to repository root)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_PATH = PROJECT_ROOT / "data" / "raw" / "AAU_temperature_and_power_use.csv"

# Save inside the current project
OUTPUT_PATH = PROJECT_ROOT / "data" / "processed" / "test_data.csv"

print("Loading raw dataset...")
df = pd.read_csv(RAW_PATH)

# Convert timestamps
df["Time [Date/Time]"] = pd.to_datetime(df["Time [Date/Time]"])

# Average the 48 temperature sensors
temp_columns = [c for c in df.columns if c.startswith("Temperature")]

df["temp"] = df[temp_columns].mean(axis=1)

# Keep time, temperature and power columns
df = df[
    [
        "Time [Date/Time]",
        "temp",
        "Power Ch 1 (W)",
        "Power Ch 2 (W)",
        "Power Ch 3 (W)",
    ]
].copy()

df = df.rename(columns={
    "Time [Date/Time]": "time",
    "Power Ch 1 (W)": "power_1",
    "Power Ch 2 (W)": "power_2",
    "Power Ch 3 (W)": "power_3",
})

# Resample to 1-minute intervals
df = df.set_index("time").resample("1min").mean()

# Create 60-minute prediction target
df["temp_target_60m"] = df["temp"].shift(-60)

# Time features
df["hour"] = df.index.hour
df["minute"] = df.index.minute

# Lag features
df["temp_lag_1m"] = df["temp"].shift(1)
df["temp_lag_5m"] = df["temp"].shift(5)
df["temp_lag_15m"] = df["temp"].shift(15)
df["temp_lag_60m"] = df["temp"].shift(60)

df["power_1_lag_1m"] = df["power_1"].shift(1)
df["power_1_lag_5m"] = df["power_1"].shift(5)

# Rolling feature
df["temp_rolling_mean_15m"] = df["temp"].rolling(15).mean()

# Remove rows with missing values
df = df.dropna().copy()

# Keep the test period used in Notebook 08
df = df[df.index >= "2024-09-28"].copy()

# Restore time as a column
df.index.name = "time"
df = df.reset_index()

# Save test data
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUTPUT_PATH, index=False)

print("\nTest dataset created successfully!")
print("Saved to:", OUTPUT_PATH)
print("Shape:", df.shape)
print("Columns:", df.columns.tolist())
print("First timestamp:", df["time"].min())
print("Last timestamp:", df["time"].max())
