# ai/traffic_ai.py

import random

# =====================================================
# TRAFFIC CONGESTION CONTROL
# =====================================================

def congestion_control(taxi, taxis):

    nearby = 0

    for other in taxis:

        if other != taxi:

            dx = other.x - taxi.x
            dy = other.y - taxi.y

            distance = (dx**2 + dy**2) ** 0.5

            if distance < 150:
                nearby += 1

    # Heavy traffic detected
    if nearby >= 4:

        taxi.speed = 1.2

        taxi.target_x += random.randint(-40, 40)
        taxi.target_y += random.randint(-40, 40)

    else:

        taxi.speed = min(taxi.speed + 0.01, 2.5)