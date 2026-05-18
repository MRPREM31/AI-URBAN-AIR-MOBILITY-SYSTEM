# ai/predictor.py

import math
import random

# =====================================================
# CALCULATE PREDICTIVE RISK SCORE
# =====================================================

def calculate_risk_score(t1, t2):
    """
    Predicts if two taxis will violate safety bubbles in the near future.
    Uses look-ahead trajectory projection to calculate collision risk.
    """
    # 1. Altitude separation check
    altitude_diff = abs(t1.altitude - t2.altitude)
    if altitude_diff >= 40:
        return 0  # Safe vertical separation maintained

    # 2. Current 2D distance
    dx = t2.x - t1.x
    dy = t2.y - t1.y
    curr_dist = math.sqrt(dx**2 + dy**2)
    
    if curr_dist < 30:
        return 100  # Imminent physical collision threat
        
    # 3. Trajectory Projection (Look-ahead over next 120 frames / 2 seconds)
    # Get vector heading for t1
    t1_dx = t1.target_x - t1.x
    t1_dy = t1.target_y - t1.y
    t1_dist = math.sqrt(t1_dx**2 + t1_dy**2)
    
    # Get vector heading for t2
    t2_dx = t2.target_x - t2.x
    t2_dy = t2.target_y - t2.y
    t2_dist = math.sqrt(t2_dx**2 + t2_dy**2)
    
    if t1_dist == 0 or t2_dist == 0:
        return 0
        
    # Current velocity components (speed factored)
    t1_vx = (t1_dx / t1_dist) * t1.speed
    t1_vy = (t1_dy / t1_dist) * t1.speed
    
    t2_vx = (t2_dx / t2_dist) * t2.speed
    t2_vy = (t2_dy / t2_dist) * t2.speed
    
    min_predicted_dist = curr_dist
    
    # Check 12 steps ahead (each step = 10 frames, approx 2 seconds lookahead)
    for step in range(1, 120, 10):
        p1_x = t1.x + t1_vx * step
        p1_y = t1.y + t1_vy * step
        p2_x = t2.x + t2_vx * step
        p2_y = t2.y + t2_vy * step
        
        pred_dist = math.sqrt((p2_x - p1_x)**2 + (p2_y - p1_y)**2)
        if pred_dist < min_predicted_dist:
            min_predicted_dist = pred_dist
            
    # 4. Scale risk score based on closest approach
    risk = 0
    if min_predicted_dist < 40:
        risk = 90 + (40 - min_predicted_dist) / 40 * 10
    elif min_predicted_dist < 80:
        risk = 60 + (80 - min_predicted_dist) / 40 * 30
    elif min_predicted_dist < 120:
        risk = 20 + (120 - min_predicted_dist) / 40 * 40
        
    # Scale risk based on vertical proximity factor
    alt_factor = max(0, 1 - (altitude_diff / 40))
    risk = int(risk * alt_factor)
    
    return min(risk, 100)

# =====================================================
# AI DECISION
# =====================================================

def ai_decision(t1, t2, risk):
    """
    Executes collaborative active maneuvers when risk exceeds critical levels.
    """
    if risk > 80:
        # Critical Threat: Divergent vertical maneuvers to resolve immediate conflict
        if t1.altitude >= t2.altitude:
            t1.target_altitude = min(t1.target_altitude + 40, 750)
            t2.target_altitude = max(t2.target_altitude - 40, 450)
        else:
            t1.target_altitude = max(t1.target_altitude - 40, 450)
            t2.target_altitude = min(t2.target_altitude + 40, 750)
            
        return "COLLISION RESOLUTION IN PROGRESS"
        
    elif risk > 50:
        # Medium Threat: Initiate early advisory separation adjustments
        if t1.altitude >= t2.altitude:
            t1.target_altitude = min(t1.target_altitude + 20, 750)
            t2.target_altitude = max(t2.target_altitude - 25, 450)
        else:
            t1.target_altitude = max(t1.target_altitude - 25, 450)
            t2.target_altitude = min(t2.target_altitude + 20, 750)
            
        return "ADVISORY LAYER SPLIT"
        
    else:
        return "SAFE"