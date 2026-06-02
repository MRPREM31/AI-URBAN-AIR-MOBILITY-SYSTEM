from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import os
import joblib
import io
import json
import urllib.request
import urllib.error
import time
import math

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
# REAL WEATHER & Nominatim APIs (WITH OFFLINE FALLBACKS)
# =========================================================

WEATHER_CACHE = {}
LOCATION_CACHE = {}

def fetch_json(url: str, headers: dict = None, timeout: float = 2.0):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Network error fetching {url}: {e}")
    return None

def get_real_weather(lat: float, lon: float):
    now = time.time()
    cache_key = (round(lat, 2), round(lon, 2))
    if cache_key in WEATHER_CACHE:
        cache_time, data = WEATHER_CACHE[cache_key]
        if now - cache_time < 300: # 5 minutes cache
            return data

    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,wind_speed_10m,weather_code,visibility&timezone=auto"
        headers = {"User-Agent": "UrbanAirTaxiSimulation/1.0"}
        res = fetch_json(url, headers=headers, timeout=2.5)
        if res and "current" in res:
            curr = res["current"]
            code = curr.get("weather_code", 0)
            
            # Weather Code mapping
            cond = "Clear"
            if code in [1, 2, 3]: cond = "Partly Cloudy"
            elif code in [45, 48]: cond = "Foggy"
            elif code in [51, 53, 55, 61, 63, 65]: cond = "Rainy"
            elif code in [80, 81, 82]: cond = "Showers"
            elif code in [95, 96, 99]: cond = "Thunderstorm"
            
            wind = curr.get("wind_speed_10m", 10.0)
            wdata = {
                "temperature": curr.get("temperature_2m", 25.0),
                "wind_speed": wind,
                "weather_condition": cond,
                "visibility": curr.get("visibility", 10000.0),
                "is_safe": wind <= 40.0 and cond not in ["Thunderstorm", "Rainy"]
            }
            WEATHER_CACHE[cache_key] = (now, wdata)
            
            # Save weather info to disk for simulator consumption
            try:
                with open("data/weather_info.json", "w") as wf:
                    json.dump(wdata, wf)
            except: pass
            
            return wdata
    except Exception as e:
        print(f"Weather API error: {e}")
        
    # Fallback to local offline file
    try:
        with open("data/offline_weather.json", "r") as f:
            wdata = json.load(f)
            # Ensure it is written to shared weather_info
            with open("data/weather_info.json", "w") as wf:
                json.dump(wdata, wf)
            return wdata
    except:
        default_weather = {
            "temperature": 28.5,
            "wind_speed": 15.0,
            "weather_condition": "Partly Cloudy",
            "visibility": 10000.0,
            "is_safe": True
        }
        try:
            with open("data/weather_info.json", "w") as wf:
                json.dump(default_weather, wf)
        except: pass
        return default_weather

def get_place_name(lat: float, lon: float):
    # High-performance instant local reverse-geocoding to prevent rate limiting (HTTP 429)
    try:
        with open("data/offline_locations.json", "r") as f:
            locs = json.load(f)
        best_loc = None
        min_d = float('inf')
        for loc in locs:
            d = math.sqrt((loc["lat"] - lat)**2 + (loc["lon"] - lon)**2)
            if d < min_d:
                min_d = d
                best_loc = loc
        if best_loc:
            # Add short relative neighborhood suffix
            return best_loc["name"]
    except Exception as e:
        print(f"Offline location fallback error: {e}")
        
    return f"Bengaluru Sector ({lat:.4f}, {lon:.4f})"


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
        global_weather = get_real_weather(12.9716, 77.5946)
        
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

            taxi_lat = float(row["latitude"])
            taxi_lon = float(row["longitude"])
            
            # Calculate nearest skyport
            nearest_port_name = "Unknown"
            min_dist = float('inf')
            for p in skyports:
                plat = 12.8500 + (p["y"] / 900.0) * (13.1500 - 12.8500)
                plon = 77.4000 + (p["x"] / 1100.0) * (77.8500 - 77.4000)
                d = math.sqrt((plat - taxi_lat)**2 + (plon - taxi_lon)**2)
                if d < min_dist:
                    min_dist = d
                    nearest_port_name = p["name"]
            
            place = get_place_name(taxi_lat, taxi_lon)

            taxis.append({
                "id": str(row["taxi_id"]),
                "latitude": taxi_lat,
                "longitude": taxi_lon,
                "altitude": int(row["altitude"]),
                "speed": float(row["speed"]),
                "route": f"{row['pickup']} -> {row['drop']}",
                "status": status,
                "risk": risk_score,
                "battery": float(row.get("battery", 100.0)),
                "lastSeen": "LIVE",
                "place_name": place,
                "weather_condition": global_weather.get("weather_condition", "Clear"),
                "wind_speed": global_weather.get("wind_speed", 10.0),
                "temperature": global_weather.get("temperature", 25.0),
                "visibility": global_weather.get("visibility", 10000.0),
                "nearest_skyport": nearest_port_name
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
            
    # Decorate skyports with latitude/longitude
    decorated_skyports = []
    for port in skyports:
        lat = 12.8500 + (port["y"] / 900.0) * (13.1500 - 12.8500)
        lon = 77.4000 + (port["x"] / 1100.0) * (77.8500 - 77.4000)
        decorated_skyports.append({
            "name": port["name"],
            "x": port["x"],
            "y": port["y"],
            "latitude": round(lat, 5),
            "longitude": round(lon, 5)
        })

    # Decorate congested zones with latitude/longitude
    decorated_congested_zones = []
    for cz in congested_zones:
        lat = 12.8500 + (cz["y"] / 900.0) * (13.1500 - 12.8500)
        lon = 77.4000 + (cz["x"] / 1100.0) * (77.8500 - 77.4000)
        decorated_congested_zones.append({
            "x": cz["x"],
            "y": cz["y"],
            "radius": cz["radius"],
            "density": cz["density"],
            "latitude": round(lat, 5),
            "longitude": round(lon, 5)
        })

    # Get overall weather for Bengaluru center
    blr_weather = get_real_weather(12.9716, 77.5946)
            
    return {
        "skyports": decorated_skyports,
        "buildings": buildings,
        "no_fly_zones": no_fly_zones,
        "weather_cells": weather_cells,
        "congested_zones": decorated_congested_zones,
        "weather": blr_weather
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

# =========================================================
# DYNAMIC SIMULATION CONTROL RUNTIME ENDPOINTS
# =========================================================

import subprocess
import signal

sim_process = None

@app.get("/simulation/status")
def get_simulation_status():
    global sim_process
    if sim_process is not None:
        poll = sim_process.poll()
        if poll is None:
            return {"status": "active", "pid": sim_process.pid}
        else:
            sim_process = None
    return {"status": "inactive"}

@app.post("/simulation/start")
def start_simulation():
    global sim_process
    if sim_process is not None and sim_process.poll() is None:
        return {"status": "active", "pid": sim_process.pid}
    
    try:
        # Run main.py using .venv python interpreter headlessly
        python_exe = os.path.join(".venv", "Scripts", "python.exe")
        if not os.path.exists(python_exe):
            python_exe = "python"
            
        sim_process = subprocess.Popen(
            [python_exe, "main.py"],
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        )
        return {"status": "success", "pid": sim_process.pid}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/simulation/stop")
def stop_simulation():
    global sim_process
    if sim_process is None or sim_process.poll() is not None:
        sim_process = None
        return {"status": "inactive"}
    
    try:
        pid = sim_process.pid
        if os.name == 'nt':
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
        else:
            sim_process.terminate()
            sim_process.wait(timeout=2)
            
        sim_process = None
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
