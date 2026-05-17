import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

# =====================================================
# AI TRAINING ENGINE v2.0
# =====================================================

def train_ai():
    csv_file = "data/flight_data.csv"
    model_file = "ai/risk_model.pkl"

    if not os.path.exists(csv_file):
        print("❌ ERROR: No flight data found. Run simulation first.")
        return

    print("\n[AI_TRAINER] Loading flight telemetry data...")
    data = pd.read_csv(csv_file)

    # Clean data
    data = data.dropna()
    data["collision"] = data["collision"].map({True: 1, False: 0, "True": 1, "False": 0, 1: 1, 0: 0})
    data["building_alert"] = data["building_alert"].map({True: 1, False: 0, "True": 1, "False": 0, 1: 1, 0: 0})

    # Feature Engineering
    # We can add more features here like rate of change in altitude
    
    X = data[[
        "latitude",
        "longitude",
        "altitude",
        "speed",
        "building_alert"
    ]]

    y = data["collision"]

    if len(X) < 100:
        print(f"⚠️ WARNING: Small dataset ({len(X)} rows). Results may be inaccurate.")

    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Model: optimized Random Forest
    print("[AI_TRAINER] Training Neural-Net-Equivalent Random Forest...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        random_state=42
    )

    model.fit(X_train, y_train)

    # Eval
    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"DONE: TRAINING COMPLETE. Accuracy: {accuracy * 100:.2f}%")

    # Save
    print(f"[AI_TRAINER] Saving model to {model_file}")
    joblib.dump(model, model_file)
    
    # Save feature names for reference in API
    joblib.dump(list(X.columns), "ai/features.pkl")

if __name__ == "__main__":
    train_ai()