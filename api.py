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

# =========================================================
# AIRSPACE DEFINITIONS (SHARED CONSTANTS)
# =========================================================

skyports = [
    {"name": "Kempegowda International Airport", "x": 950, "y": 80},
    {"name": "CSIR-National Aerospace Laboratories", "x": 750, "y": 300},
    {"name": "Hebbal", "x": 500, "y": 80},
    {"name": "Yelahanka", "x": 200, "y": 70},
    {"name": "MG Road", "x": 500, "y": 450},
    {"name": "Indiranagar", "x": 800, "y": 400},
    {"name": "Whitefield", "x": 1050, "y": 350},
    {"name": "Electronic City", "x": 950, "y": 800},
    {"name": "Koramangala", "x": 650, "y": 650},
    {"name": "Marathahalli", "x": 900, "y": 550},
    {"name": "Jayanagar", "x": 250, "y": 700},
]

buildings = [
    {"x": 300, "y": 220, "w": 80, "h": 250},
    {"x": 600, "y": 100, "w": 100, "h": 320},
    {"x": 750, "y": 500, "w": 120, "h": 260},
    {"x": 420, "y": 550, "w": 90, "h": 200},
]

no_fly_zones = [
    {"name": "VIP Security Airspace (NFZ-A)", "x": 350, "y": 450, "radius": 100},
    {"name": "Military Restriction (NFZ-B)", "x": 680, "y": 380, "radius": 75}
]

# =========================================================
# ENDPOINTS
# =========================================================

@app.get("/taxis")
def get_taxis():
    csv_path = "data/flight_data.csv"
    if not os.path.exists(csv_path):
        return []
    
    try:
        # OPTIMIZATION: Only read the last 50KB to keep the API fast
        with open(csv_path, 'rb') as f:
            f.seek(0, os.SEEK_END)
            filesize = f.tell()
            seek_pos = max(0, filesize - 80000)
            f.seek(seek_pos)
            lines = f.readlines()
            
            # Reconstruct CSV with header
            header = "timestamp,taxi_id,latitude,longitude,altitude,speed,pickup,drop,collision,building_alert,battery,status\n"
            content = header + "".join([line.decode('utf-8', errors='ignore') for line in lines[1:]])
            
        data = pd.read_csv(io.StringIO(content))
        
        # Mapping boolean strings/types to integers
        data["collision"] = data["collision"].astype(str).str.lower().map({'true': 1, 'false': 0, '1': 1, '0': 0, '1.0': 1, '0.0': 0})
        data["building_alert"] = data["building_alert"].astype(str).str.lower().map({'true': 1, 'false': 0, '1': 1, '0': 0, '1.0': 1, '0.0': 0})

        # Get latest state for each taxi
        latest_data = data.sort_values('timestamp').groupby('taxi_id').tail(1)
        
        taxis = []
        for _, row in latest_data.iterrows():
            # Respect backend determined status if available, else fall back
            status = str(row.get("status", "Flying"))
            if status == "nan" or not status:
                status = "Flying"
                if row["collision"] == 1: 
                    status = 'Critical'
                elif row["building_alert"] == 1: 
                    status = 'Emerging'
            
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
                "battery": float(row.get("battery", 100.0)),
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
        # OPTIMIZATION: Only read the last 30KB to bypass file scaling bottlenecks
        with open(events_path, 'rb') as f:
            f.seek(0, os.SEEK_END)
            filesize = f.tell()
            seek_pos = max(0, filesize - 30000)
            f.seek(seek_pos)
            lines = f.readlines()
            
            # Reconstruct with static CSV header
            header = "timestamp,event_type,message\n"
            content = header + "".join([line.decode('utf-8', errors='ignore') for line in lines[1:]])
            
        data = pd.read_csv(io.StringIO(content))
        recent_events = data.tail(30).to_dict(orient="records")
        return recent_events
    except Exception as e:
        return {"error": str(e)}

@app.get("/airspace")
def get_airspace():
    """
    Serves static and dynamic airspace configuration.
    Reads dynamic weather cells directly from memory/file if generated by backend.
    """
    weather_cells = [{"name": "Storm Alpha", "x": 550, "y": 450, "radius": 110}] # default fallback
    weather_path = "data/weather.json"
    if os.path.exists(weather_path):
        try:
            with open(weather_path, "r") as f:
                weather_cells = json.load(f)
        except:
            pass
            
    congested_zones = []
    congested_path = "data/congested_zones.json"
    if os.path.exists(congested_path):
        try:
            with open(congested_path, "r") as f:
                congested_zones = json.load(f)
        except:
            pass
            
    return {
        "skyports": skyports,
        "buildings": buildings,
        "no_fly_zones": no_fly_zones,
        "weather_cells": weather_cells,
        "congested_zones": congested_zones
    }

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

@app.get("/obstacles")
def get_obstacles():
    path = "data/obstacles.json"
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r") as f:
            return json.load(f)
    except:
        return []

@app.get("/camera_telemetry")
def get_camera_telemetry():
    path = "data/camera_telemetry.json"
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r") as f:
            return json.load(f)
    except:
        return {}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
