# ai/route_optimizer.py

import math

# =====================================================
# SMART ROUTE OPTIMIZATION & GLIDE-SLOPE SPEED
# =====================================================

def optimize_route(taxi):
    """
    Optimizes speed based on distance to the target skyport.
    Simulates smooth acceleration after takeoff and safe deceleration (glide-slope) before landing.
    """
    dx = taxi.target_x - taxi.x
    dy = taxi.target_y - taxi.y
    dist = math.sqrt(dx**2 + dy**2)
    
    # Get base cruise speed (default to 2.0 if not defined)
    base_speed = getattr(taxi, 'base_speed', 2.0)
    
    if dist < 120:
        # Glide-slope landing phase: decelerate smoothly
        target_speed = max(0.6, (dist / 120) * base_speed)
        taxi.speed += (target_speed - taxi.speed) * 0.1
    else:
        # Cruise phase: accelerate smoothly to base speed
        taxi.speed += (base_speed - taxi.speed) * 0.05

# =====================================================
# VECTOR-BASED BUILDING AVOIDANCE
# =====================================================

def avoid_building(taxi, building):
    """
    Computes a lateral steering repulsion vector pushing the aircraft around tall buildings.
    Triggers an autopilot climb command to clear structures vertically if proximity limits are breached.
    """
    # 1. Center of the rectangular building structure
    bx = building["x"] + building["w"] / 2
    by = building["y"] + building["h"] / 2
    
    # 2. Distance from taxi to building center
    dx = taxi.x - bx
    dy = taxi.y - by
    dist = math.sqrt(dx**2 + dy**2)
    
    # 3. Dynamic bounding radius (diagonal size + safety buffer zone)
    radius = math.sqrt((building["w"]/2)**2 + (building["h"]/2)**2) + 60
    
    # If inside the building buffer area, apply steering forces
    if dist < radius:
        # Calculate push force factor (stronger force the closer we get)
        push_factor = (radius - dist) / radius
        
        # Pushing unit vector
        push_x = dx / dist if dist > 0 else 1.0
        push_y = dy / dist if dist > 0 else 0.0
        
        # Initialize taxi's active steering accumulators if not present
        if not hasattr(taxi, 'steering_x'):
            taxi.steering_x = 0.0
            taxi.steering_y = 0.0
            
        # Inject lateral steering forces into autopilot
        taxi.steering_x += push_x * push_factor * 4.5
        taxi.steering_y += push_y * push_factor * 4.5
        
        # Vertical obstacle clearance climb (750m override)
        taxi.target_altitude = 750
        taxi.building_alert = True