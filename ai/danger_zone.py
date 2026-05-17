# ai/danger_zone.py

import pygame

RED = (255, 0, 0)
ORANGE = (255, 140, 0)

# =====================================================
# DANGER ZONE DISPLAY
# =====================================================

def draw_danger_zone(screen, taxi):

    pygame.draw.circle(
        screen,
        ORANGE,
        (int(taxi.x), int(taxi.y)),
        60,
        2
    )

# =====================================================
# CHECK HIGH DENSITY AREA
# =====================================================

def check_danger(taxi, taxis):

    nearby = 0

    for other in taxis:

        if other != taxi:

            dx = other.x - taxi.x
            dy = other.y - taxi.y

            distance = (dx**2 + dy**2) ** 0.5

            if distance < 120:
                nearby += 1

    if nearby >= 3:
        return True

    return False