# ai/route_optimizer.py

import random

# =====================================================
# SMART ROUTE OPTIMIZATION
# =====================================================

def optimize_route(taxi):

    # Random AI optimization
    taxi.target_x += random.randint(-20, 20)
    taxi.target_y += random.randint(-20, 20)

# =====================================================
# BUILDING AVOIDANCE
# =====================================================

def avoid_building(taxi, building):

    bx = building["x"]
    by = building["y"]
    bw = building["w"]
    bh = building["h"]

    if (
        taxi.x > bx - 60 and
        taxi.x < bx + bw + 60 and
        taxi.y > by - 60 and
        taxi.y < by + bh + 60
    ):

        taxi.target_x += random.randint(-100, 100)
        taxi.target_y += random.randint(-100, 100)

        taxi.altitude += 10