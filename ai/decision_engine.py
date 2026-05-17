# ai/decision_engine.py

# =====================================================
# AI SAFETY DECISION ENGINE
# =====================================================

def emergency_decision(taxi):

    if taxi.altitude < 150:

        taxi.altitude += 50

    elif taxi.altitude > 500:

        taxi.altitude -= 30

# =====================================================
# AUTO STABILIZATION
# =====================================================

def stabilize_taxi(taxi):

    if taxi.speed > 3:

        taxi.speed = 3

    if taxi.speed < 1:

        taxi.speed = 1