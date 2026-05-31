# ai/camera_sensor.py

import math
import random

# Dynamic list of signatures the AI can classify
OBSTACLE_CLASSES = [
    {
        "class": "Flock of Birds",
        "min_speed": 1.0,
        "max_speed": 3.5,
        "min_size": 2.0,
        "max_size": 8.0,
        "description": "Biological hazard: flock of migrating birds."
    },
    {
        "class": "Unregistered Drone",
        "min_speed": 2.0,
        "max_speed": 6.0,
        "min_size": 1.0,
        "max_size": 4.0,
        "description": "Technological hazard: consumer quadcopter violating corridor restrictions."
    },
    {
        "class": "Helicopter",
        "min_speed": 5.0,
        "max_speed": 12.0,
        "min_size": 12.0,
        "max_size": 25.0,
        "description": "Aviation conflict: low-altitude medical or emergency helicopter."
    },
    {
        "class": "Weather Balloon",
        "min_speed": 0.0,
        "max_speed": 1.0,
        "min_size": 5.0,
        "max_size": 15.0,
        "description": "Meteorological obstacle: drifting weather sensing equipment."
    }
]

def simulate_ai_classification(obstacle):
    """
    Simulates a neural network classifier analyzing the obstacle's radar size,
    estimated speed, and thermal/RF signature.
    """
    size = obstacle.get("size", 2.0)
    speed = obstacle.get("speed", 2.0)
    
    # Simple score matching to classify
    best_match = OBSTACLE_CLASSES[1] # Default to unregistered drone
    highest_score = -1.0
    
    for cls in OBSTACLE_CLASSES:
        # Score matching based on bounds
        speed_score = 1.0 if cls["min_speed"] <= speed <= cls["max_speed"] else 0.2
        size_score = 1.0 if cls["min_size"] <= size <= cls["max_size"] else 0.2
        total_score = (speed_score + size_score) / 2.0
        
        # Add slight randomized sensor noise
        total_score += random.uniform(-0.1, 0.1)
        
        if total_score > highest_score:
            highest_score = total_score
            best_match = cls
            
    return {
        "class": best_match["class"],
        "confidence": min(100, int((highest_score / 1.1) * 100)),
        "description": best_match["description"]
    }

def detect_in_camera_fov(taxi, obstacles, fov_angle=60, fov_range=160):
    """
    Calculates if any obstacles lie inside the UAM's front-facing camera cone.
    Returns the closest detected obstacle along with its AI prediction.
    """
    # Get current heading vector
    active_t_x = taxi.detour_x if getattr(taxi, 'detouring', False) else taxi.target_x
    active_t_y = taxi.detour_y if getattr(taxi, 'detouring', False) else taxi.target_y
    
    dx = active_t_x - taxi.x
    dy = active_t_y - taxi.y
    dist_to_target = math.sqrt(dx**2 + dy**2)
    
    if dist_to_target == 0:
        return None
        
    heading_x = dx / dist_to_target
    heading_y = dy / dist_to_target
    heading_angle = math.atan2(heading_y, heading_x)
    
    closest_detection = None
    min_dist = float('inf')
    
    for obs in obstacles:
        obs_dx = obs["x"] - taxi.x
        obs_dy = obs["y"] - taxi.y
        obs_dist = math.sqrt(obs_dx**2 + obs_dy**2)
        
        # Check range limit
        if obs_dist > fov_range:
            continue
            
        # Check angular limit relative to heading
        obs_angle = math.atan2(obs_dy, obs_dx)
        angle_diff = math.degrees(math.atan2(math.sin(obs_angle - heading_angle), math.cos(obs_angle - heading_angle)))
        
        # If within the cone (e.g. -30 to +30 degrees for 60 FOV)
        if abs(angle_diff) <= (fov_angle / 2.0):
            if obs_dist < min_dist:
                min_dist = obs_dist
                # Classify the object in real-time
                prediction = simulate_ai_classification(obs)
                closest_detection = {
                    "obstacle_id": obs["id"],
                    "x": obs["x"],
                    "y": obs["y"],
                    "distance": round(obs_dist, 1),
                    "bearing": round(angle_diff, 1),
                    "predicted_class": prediction["class"],
                    "confidence": prediction["confidence"],
                    "description": prediction["description"]
                }
                
    return closest_detection
