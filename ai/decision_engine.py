# ai/decision_engine.py

import math

# =====================================================
# AI SAFETY & EMERGENCY AUTOPILOT DECISION ENGINE
# =====================================================

def emergency_decision(taxi, skyports):
    """
    Simulates battery consumption and manages emergency flight envelopes.
    If battery level falls below 20%, overrides standard routes to initiate
    an immediate emergency diversion landing at the nearest skyport.
    """
    # 1. Initialize and drain battery (proportional to current velocity)
    if not hasattr(taxi, 'battery'):
        taxi.battery = 100.0
    else:
        taxi.battery = max(0.0, taxi.battery - 0.012 * taxi.speed)
        
    # 2. Check for critical battery charge levels
    if taxi.battery < 20.0 and not getattr(taxi, 'is_emergency_landing', False):
        taxi.is_emergency_landing = True
        taxi.status = 'Critical'
        
        # Calculate the geographically closest skyport for an emergency landing
        closest_port = None
        min_dist = 999999.0
        for port in skyports:
            dx = port["x"] - taxi.x
            dy = port["y"] - taxi.y
            dist = math.sqrt(dx**2 + dy**2)
            if dist < min_dist:
                min_dist = dist
                closest_port = port
                
        if closest_port:
            taxi.pickup = "DIV_EMERGENCY"
            taxi.drop = closest_port["name"]
            taxi.target_x = closest_port["x"]
            taxi.target_y = closest_port["y"]
            
            # Autopilot: drop target flight level to a low approach corridor
            taxi.target_altitude = 480 
            
            # Log the event flag to let main.py write to events.csv
            taxi.should_log_emergency = True

    # 3. Final glide slope descent when close to diversion landing
    if getattr(taxi, 'is_emergency_landing', False):
        dx = taxi.target_x - taxi.x
        dy = taxi.target_y - taxi.y
        dist = math.sqrt(dx**2 + dy**2)
        if dist < 60:
            # Force landing descent profile
            taxi.target_altitude = 0.0

# =====================================================
# AUTOMATED VELOCITY & SPEED STABILIZATION
# =====================================================

def stabilize_taxi(taxi):
    """
    Maintains vehicle speed inside approved aerodynamic/flight safety boundaries.
    """
    # Speed cap restrictions
    if taxi.speed > 3.5:
        taxi.speed = 3.5
    elif taxi.speed < 0.5:
        taxi.speed = 0.5