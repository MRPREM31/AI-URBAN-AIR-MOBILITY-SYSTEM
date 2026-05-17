# ai/predictor.py

import math
import random

# =====================================================
# CALCULATE RISK SCORE
# =====================================================

def calculate_risk_score(t1, t2):

    dx = t2.x - t1.x
    dy = t2.y - t1.y

    distance = math.sqrt(dx**2 + dy**2)

    altitude_diff = abs(t1.altitude - t2.altitude)

    speed_factor = (t1.speed + t2.speed) / 2

    risk = 0

    # Distance Risk
    if distance < 50:
        risk += 70

    elif distance < 100:
        risk += 40

    elif distance < 150:
        risk += 20

    # Altitude Risk
    if altitude_diff < 20:
        risk += 20

    # Speed Risk
    if speed_factor > 2.0:
        risk += 10

    return min(risk, 100)

# =====================================================
# AI DECISION
# =====================================================

def ai_decision(t1, t2, risk):

    if risk > 80:

        # Emergency avoidance
        t1.altitude += 40
        t2.altitude -= 40

        t1.target_x += random.randint(-150, 150)
        t1.target_y += random.randint(-150, 150)

        t2.target_x += random.randint(-150, 150)
        t2.target_y += random.randint(-150, 150)

        return "HIGH RISK"

    elif risk > 50:

        t1.altitude += 20
        t2.altitude -= 20

        return "MEDIUM RISK"

    else:

        return "SAFE"