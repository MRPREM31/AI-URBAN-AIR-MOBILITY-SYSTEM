# ai/traffic_ai.py

import math

# =====================================================
# TRAFFIC CONGESTION & CORRIDOR COORDINATOR
# =====================================================

def congestion_control(taxi, taxis):
    """
    Monitors surrounding traffic density. Performs two main functions:
    1. Regulates velocity (slowing down to 60% cruise) in high-density corridors to prevent queuing.
    2. Applies strong proactive 3D separation forces (horizontal steering and cooperative vertical splits)
       when aircraft enter a 120m safe distance bubble at similar altitudes.
    """
    nearby = 0
    separation_x = 0.0
    separation_y = 0.0
    in_conflict = False
    
    for other in taxis:
        if other != taxi:
            dx = taxi.x - other.x
            dy = taxi.y - other.y
            dist = math.sqrt(dx**2 + dy**2)
            
            # Monitor density within a 160m radar radius
            if dist < 160:
                nearby += 1
                
            # If aircraft are within the 120m safe distance bubble at similar altitudes (within 45m vertical block)
            if dist < 120 and abs(other.altitude - taxi.altitude) < 45:
                in_conflict = True
                
                # Strong exponential repulsion (higher authority the closer they get)
                push_factor = ((120 - dist) / 120) ** 1.5
                
                # Unit repulsion vector
                push_x = dx / dist if dist > 0 else 1.0
                push_y = dy / dist if dist > 0 else 0.0
                
                # Accumulate proactive lateral steering separation forces
                separation_x += push_x * push_factor * 8.5
                separation_y += push_y * push_factor * 8.5
                
                # Proactive Cooperative Vertical Split:
                # Nudge target altitudes in opposite directions to ensure vertical layering separation
                if taxi.id < other.id:
                    # Climb profile
                    taxi.target_altitude = min(750, taxi.target_altitude + 55)
                else:
                    # Descend profile
                    taxi.target_altitude = max(450, taxi.target_altitude - 55)
                
    # Lock/Unlock cooperative avoidance target altitude overrides
    taxi.cooperative_avoidance = in_conflict

    # Accumulate forces into the taxi's active steering buffer
    if not hasattr(taxi, 'steering_x'):
        taxi.steering_x = 0.0
        taxi.steering_y = 0.0
        
    taxi.steering_x += separation_x
    taxi.steering_y += separation_y
    
    # Speed regulation based on density
    base_speed = getattr(taxi, 'base_speed', 2.0)
    if nearby >= 3:
        # High traffic congestion: decelerate to coordinate arrival queuing
        target_speed = base_speed * 0.6
        taxi.speed += (target_speed - taxi.speed) * 0.1
    else:
        # Low traffic: allow standard cruise speed adjustments in route optimizer
        pass