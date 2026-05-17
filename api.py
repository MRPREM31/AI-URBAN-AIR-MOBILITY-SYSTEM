from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import os
import joblib
import io
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "ai/risk_model.pkl"
model = None
if os.path.exists(MODEL_PATH):
    try:
        model = joblib.load(MODEL_PATH)
        print("DONE: AI MODEL LOADED")
    except:
        print("ERROR: MODEL LOAD FAILED")

@app.get("/taxis")
def get_taxis():
    csv_path = "data/flight_data.csv"
    if not os.path.exists(csv_path):
        return []
    
    try:
        # OPTIMIZATION: Only read the last 1000 lines to keep the API fast
        with open(csv_path, 'rb') as f:
            f.seek(0, os.SEEK_END)
            filesize = f.tell()
            # Seek back 50KB (enough for last 500-1000 lines)
            seek_pos = max(0, filesize - 50000)
            f.seek(seek_pos)
            lines = f.readlines()
            
            # Reconstruct CSV with header
            header = "timestamp,taxi_id,latitude,longitude,altitude,speed,pickup,drop,collision,building_alert\n"
            content = header + "".join([line.decode('utf-8', errors='ignore') for line in lines[1:]])
            
        data = pd.read_csv(io.StringIO(content))
        
        # Mapping boolean strings/types to integers
        data["collision"] = data["collision"].astype(str).str.lower().map({'true': 1, 'false': 0, '1': 1, '0': 0, '1.0': 1, '0.0': 0})
        data["building_alert"] = data["building_alert"].astype(str).str.lower().map({'true': 1, 'false': 0, '1': 1, '0': 0, '1.0': 1, '0.0': 0})

        # Get latest state for each taxi
        latest_data = data.sort_values('timestamp').groupby('taxi_id').tail(1)
        
        taxis = []
        for _, row in latest_data.iterrows():
            status = 'Flying'
            if row["collision"] == 1: status = 'Critical'
            elif row["building_alert"] == 1: status = 'Emerging'
            
            risk_score = 15
            if model:
                try:
                    features = pd.DataFrame([[
                        row["latitude"], row["longitude"], row["altitude"], row["speed"], row["building_alert"]
                    ]], columns=["latitude", "longitude", "altitude", "speed", "building_alert"])
                    risk_prob = model.predict_proba(features)[0][1]
                    risk_score = int(risk_prob * 100)
                except: pass

            taxis.append({
                "id": str(row["taxi_id"]),
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "altitude": int(row["altitude"]),
                "speed": float(row["speed"]),
                "route": f"{row['pickup']} -> {row['drop']}",
                "status": status,
                "risk": risk_score,
                "lastSeen": "LIVE"
            })
        return taxis
    except Exception as e:
        return {"error": str(e)}

@app.get("/events")
def get_events():
    events_path = "data/events.csv"
    if not os.path.exists(events_path):
        return []
    
    try:
        data = pd.read_csv(events_path)
        # Get the last 30 events to keep the command console responsive
        recent_events = data.tail(30).to_dict(orient="records")
        return recent_events
    except Exception as e:
        return {"error": str(e)}

class Settings(BaseModel):
    slow_down: bool

SETTINGS_PATH = "data/settings.json"

def get_settings_data():
    if not os.path.exists(SETTINGS_PATH):
        return {"slow_down": False}
    try:
        with open(SETTINGS_PATH, "r") as f:
            return json.load(f)
    except:
        return {"slow_down": False}

@app.get("/settings")
def get_settings():
    return get_settings_data()

@app.post("/settings")
def update_settings(settings: Settings):
    try:
        os.makedirs("data", exist_ok=True)
        with open(SETTINGS_PATH, "w") as f:
            json.dump({"slow_down": settings.slow_down}, f)
        return {"status": "success", "slow_down": settings.slow_down}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
