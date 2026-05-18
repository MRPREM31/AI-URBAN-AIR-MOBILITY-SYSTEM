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

import os
import json

def detect_congestion_zones(taxis):
    """
    Scans UAM vehicles to find high-traffic clusters (more than 3 vehicles within a 50m radius).
    Computes active congested zone centroids, merges overlapping zones, and saves them
    to data/congested_zones.json for cross-platform sharing.
    """
    raw_zones = []
    
    # 1. Cluster scan: check each taxi as a potential centroid
    for t in taxis:
        cluster = [t]
        for other in taxis:
            if other != t:
                dist = math.sqrt((t.x - other.x)**2 + (t.y - other.y)**2)
                if dist < 50:
                    cluster.append(other)
                    
        # If cluster density strictly exceeds 3 vehicles (meaning >= 4 total)
        if len(cluster) > 3:
            # Calculate centroid coordinates
            cx = sum(item.x for item in cluster) / len(cluster)
            cy = sum(item.y for item in cluster) / len(cluster)
            raw_zones.append({
                "x": round(cx, 1),
                "y": round(cy, 1),
                "radius": 60, # 50m + 10m safety boundary
                "density": len(cluster)
            })
            
    # 2. Merge overlapping congested zones to keep rendering clean
    merged_zones = []
    for zone in raw_zones:
        matched = False
        for mz in merged_zones:
            dist = math.sqrt((zone["x"] - mz["x"])**2 + (zone["y"] - mz["y"])**2)
            if dist < 60:
                # Merge: adjust coordinates to average, take max density
                mz["x"] = round((mz["x"] + zone["x"]) / 2, 1)
                mz["y"] = round((mz["y"] + zone["y"]) / 2, 1)
                mz["density"] = max(mz["density"], zone["density"])
                matched = True
                break
        if not matched:
            merged_zones.append(zone)
            
    # 3. Save active congested zones to shared data/congested_zones.json
    try:
        os.makedirs("data", exist_ok=True)
        with open("data/congested_zones.json", "w") as f:
            json.dump(merged_zones, f)
    except:
        pass
        
    return merged_zones

def apply_congestion_avoidance(taxi, congested_zones):
    """
    Calculates the shortest safe dynamic detour path when a UAM vehicle approaches
    an active high-traffic congested zone, and smoothly clears the override once past.
    """
    # Initialize detour steering attributes if not present
    if not hasattr(taxi, 'detouring'):
        taxi.detouring = False
        taxi.detour_x = 0.0
        taxi.detour_y = 0.0
        
    # If the taxi has reached its current detour waypoint, clear it
    if taxi.detouring:
        w_dx = taxi.detour_x - taxi.x
        w_dy = taxi.detour_y - taxi.y
        if math.sqrt(w_dx**2 + w_dy**2) < 15:
            taxi.detouring = False
            taxi.status = 'Flying'
            
    # Scan congested zones to see if taxi is approaching one
    active_detour = False
    for cz in congested_zones:
        # Distance to congested zone center
        cz_dx = taxi.x - cz["x"]
        cz_dy = taxi.y - cz["y"]
        dist = math.sqrt(cz_dx**2 + cz_dy**2)
        
        # If approaching the safety zone threshold (within 110px / approx 110m)
        if dist < cz["radius"] + 50:
            # Check if this taxi is part of the bottleneck or a "new" approaching vehicle
            # Drones that are already inside the cluster should not detour themselves (otherwise cluster breaks weirdly).
            # Approaching drones whose destination is NOT inside the congested zone will detour around it!
            t_dx = taxi.target_x - cz["x"]
            t_dy = taxi.target_y - cz["y"]
            dest_in_cz = math.sqrt(t_dx**2 + t_dy**2) < cz["radius"] + 15
            
            if dist > 45 and not dest_in_cz:
                active_detour = True
                
                # Calculate shortest detour waypoint perpendicular to the center approach vector
                if dist > 0:
                    # Perpendicular unit vectors (orthogonal lateral directions)
                    cz_dx_norm = cz_dx / dist
                    cz_dy_norm = cz_dy / dist
                    ux = -cz_dy_norm
                    uy = cz_dx_norm
                    
                    # Compute Left vs Right bypass candidates outside the boundary (R + 35px)
                    bypass_r = cz["radius"] + 35
                    wp1_x = cz["x"] + ux * bypass_r
                    wp1_y = cz["y"] + uy * bypass_r
                    
                    wp2_x = cz["x"] - ux * bypass_r
                    wp2_y = cz["y"] - uy * bypass_r
                    
                    # Shortest Path Selection: choose waypoint closest to the final target
                    d1 = math.sqrt((wp1_x - taxi.target_x)**2 + (wp1_y - taxi.target_y)**2)
                    d2 = math.sqrt((wp2_x - taxi.target_x)**2 + (wp2_y - taxi.target_y)**2)
                    
                    if d1 < d2:
                        taxi.detour_x = wp1_x
                        taxi.detour_y = wp1_y
                    else:
                        taxi.detour_x = wp2_x
                        taxi.detour_y = wp2_y
                        
                    taxi.detouring = True
                    taxi.status = 'Detouring'
                    break # prioritize avoiding the closest threat
                    
    # Smoothly release detour flight lock if clear of all zones
    if taxi.detouring and not active_detour:
        # Check if the waypoint is behind us or we are now closer to final target
        t_dx = taxi.target_x - taxi.x
        t_dy = taxi.target_y - taxi.y
        t_dist = math.sqrt(t_dx**2 + t_dy**2)
        
        w_dx = taxi.detour_x - taxi.x
        w_dy = taxi.detour_y - taxi.y
        w_dist = math.sqrt(w_dx**2 + w_dy**2)
        
        if w_dist > t_dist or w_dist < 20:
            taxi.detouring = False
            taxi.status = 'Flying'