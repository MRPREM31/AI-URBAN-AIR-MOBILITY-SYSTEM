# =========================================================
# AI URBAN AIR TAXI MANAGEMENT SYSTEM
# FULL main.py
# =========================================================

import pygame
import random
import math
import csv
import os
import json

from datetime import datetime

from ai.predictor import *
from ai.danger_zone import *
from ai.traffic_ai import *
from ai.decision_engine import *
from ai.route_optimizer import *

# =========================================================
# INITIALIZE
# =========================================================

pygame.init()

# =========================================================
# SCREEN SETTINGS
# =========================================================

WIDTH = 1500
HEIGHT = 900

screen = pygame.display.set_mode((WIDTH, HEIGHT))

pygame.display.set_caption(
    "AI Urban Air Taxi Simulation"
)

clock = pygame.time.Clock()

# =========================================================
# COLORS
# =========================================================

BLACK = (8, 8, 15)
WHITE = (255, 255, 255)
BLUE = (0, 170, 255)
GREEN = (0, 255, 120)
RED = (255, 70, 70)
YELLOW = (255, 255, 0)
GRAY = (60, 60, 60)
DARK_PANEL = (25, 25, 35)
ORANGE = (255, 165, 0)
PURPLE = (180, 0, 255)

# =========================================================
# MAP SETTINGS
# =========================================================

SIMULATION_WIDTH = 1100

SAFE_DISTANCE = 90

LAT_MIN = 17.0000
LAT_MAX = 18.0000

LON_MIN = 78.0000
LON_MAX = 79.0000

# =========================================================
# FONTS
# =========================================================

font = pygame.font.SysFont("Arial", 16)
big_font = pygame.font.SysFont("Arial", 24)

# =========================================================
# CSV STORAGE
# =========================================================

csv_file = "data/flight_data.csv"
events_file = "data/events.csv"

if not os.path.exists("data"):
    os.makedirs("data")

with open(csv_file, mode="w", newline="") as file:

    writer = csv.writer(file)

    writer.writerow([
        "timestamp",
        "taxi_id",
        "latitude",
        "longitude",
        "altitude",
        "speed",
        "pickup",
        "drop",
        "collision",
        "building_alert"
    ])

with open(events_file, mode="w", newline="") as file:

    writer = csv.writer(file)

    writer.writerow(["timestamp", "event_type", "message"])

def log_event(event_type, message):

    with open(events_file, mode="a", newline="") as file:

        writer = csv.writer(file)

        writer.writerow([
            datetime.now().strftime("%H:%M:%S"),
            event_type,
            message
        ])


# =========================================================
# SKYPORTS
# =========================================================

skyports = [

    {"name": "Hebbal", "x": 500, "y": 80},
    {"name": "Malleshwaram", "x": 150, "y": 180},
    {"name": "Indiranagar", "x": 800, "y": 250},
    {"name": "Whitefield", "x": 1000, "y": 450},
    {"name": "Koramangala", "x": 800, "y": 550},
    {"name": "HSR Layout", "x": 650, "y": 720},
    {"name": "Electronic City", "x": 950, "y": 800},
    {"name": "Jayanagar", "x": 250, "y": 700},

]

# =========================================================
# BUILDINGS
# =========================================================

buildings = [

    {"x": 300, "y": 220, "w": 80, "h": 250},
    {"x": 600, "y": 100, "w": 100, "h": 320},
    {"x": 750, "y": 500, "w": 120, "h": 260},
    {"x": 420, "y": 550, "w": 90, "h": 200},

]

# =========================================================
# BIRDS
# =========================================================

birds = []

for i in range(12):

    birds.append({

        "x": random.randint(0, 1000),
        "y": random.randint(0, 800),
        "speed": random.uniform(1, 3)

    })

# =========================================================
# AIR TAXI CLASS
# =========================================================

class AirTaxi:

    def __init__(self, taxi_id):

        self.id = taxi_id

        start_port = random.choice(skyports)
        end_port = random.choice(skyports)

        self.x = start_port["x"]
        self.y = start_port["y"]

        self.target_x = end_port["x"]
        self.target_y = end_port["y"]

        self.pickup = start_port["name"]
        self.drop = end_port["name"]

        self.speed = random.uniform(1.5, 2.5)

        self.altitude = random.randint(180, 350)

        self.color = BLUE

        self.collision = False
        self.building_alert = False

    # =====================================================
    # GPS
    # =====================================================

    def get_gps(self):

        latitude = LAT_MIN + (
            self.y / HEIGHT
        ) * (LAT_MAX - LAT_MIN)

        longitude = LON_MIN + (
            self.x / SIMULATION_WIDTH
        ) * (LON_MAX - LON_MIN)

        return round(latitude, 5), round(longitude, 5)

    # =====================================================
    # MOVE
    # =====================================================

    def move(self):

        dx = self.target_x - self.x
        dy = self.target_y - self.y

        distance = math.sqrt(dx ** 2 + dy ** 2)

        if distance != 0:

            current_speed = self.speed * speed_factor
            self.x += (dx / distance) * current_speed
            self.y += (dy / distance) * current_speed

        # Reached destination
        if distance < 10:

            new_target = random.choice(skyports)
            while new_target["name"] == self.drop:
                new_target = random.choice(skyports)

            old_pickup = self.pickup
            old_drop = self.drop

            self.pickup = self.drop
            self.drop = new_target["name"]

            self.target_x = new_target["x"]
            self.target_y = new_target["y"]

            log_event("ROUTE", f"{self.id} safely landed at {old_drop}.")
            log_event("ROUTE", f"{self.id} took off from {old_drop} heading to {self.drop}.")

    # =====================================================
    # BUILDING DETECTION
    # =====================================================

    def detect_buildings(self):

        self.building_alert = False

        for building in buildings:

            bx = building["x"]
            by = building["y"]
            bw = building["w"]
            bh = building["h"]

            if (

                self.x > bx - 40 and
                self.x < bx + bw + 40 and
                self.y > by - 40 and
                self.y < by + bh + 40

            ):

                self.building_alert = True

                self.altitude += 2

                if self.altitude > 550:
                    self.altitude = 550

                if not getattr(self, 'has_building_alert_logged', False):
                    log_event("BUILDING", f"{self.id} entered tall building proximity. Initiating climb to {int(self.altitude)}m.")
                    self.has_building_alert_logged = True
                return

        self.has_building_alert_logged = False

    # =====================================================
    # DRAW
    # =====================================================

    def draw(self):

        latitude, longitude = self.get_gps()

        pygame.draw.line(

            screen,
            GRAY,
            (self.x, self.y),
            (self.target_x, self.target_y),
            1

        )

        pygame.draw.circle(

            screen,
            self.color,
            (int(self.x), int(self.y)),
            12

        )

        id_text = font.render(
            self.id,
            True,
            WHITE
        )

        screen.blit(
            id_text,
            (self.x + 15, self.y - 35)
        )

        gps_text = font.render(

            f"Lat:{latitude} Lon:{longitude}",
            True,
            WHITE

        )

        screen.blit(
            gps_text,
            (self.x + 15, self.y - 15)
        )

        alt_text = font.render(

            f"Alt:{int(self.altitude)}m",
            True,
            GREEN

        )

        screen.blit(
            alt_text,
            (self.x + 15, self.y + 5)
        )

        route_text = font.render(

            f"{self.pickup} → {self.drop}",
            True,
            YELLOW

        )

        screen.blit(
            route_text,
            (self.x + 15, self.y + 25)
        )

# =========================================================
# DISTANCE FUNCTION
# =========================================================

def calculate_distance(t1, t2):

    return math.sqrt(

        (t2.x - t1.x) ** 2 +
        (t2.y - t1.y) ** 2

    )

# =========================================================
# SAVE DATA
# =========================================================

def save_data(taxi, collision, building_alert):

    latitude, longitude = taxi.get_gps()

    with open(csv_file, mode="a", newline="") as file:

        writer = csv.writer(file)

        writer.writerow([

            datetime.now().strftime("%H:%M:%S"),
            taxi.id,
            latitude,
            longitude,
            int(taxi.altitude),
            round(taxi.speed, 2),
            taxi.pickup,
            taxi.drop,
            collision,
            building_alert

        ])

# =========================================================
# CREATE TAXIS
# =========================================================

taxis = []

for i in range(8):

    taxis.append(
        AirTaxi(f"TX{i+1}")
    )

# =========================================================
# MAIN LOOP
# =========================================================

logged_collisions = set()

speed_factor = 1.0
last_slow_down = False

running = True

frame = 0
while running:

    if frame % 30 == 0:
        settings_path = "data/settings.json"
        slow_down = False
        if os.path.exists(settings_path):
            try:
                with open(settings_path, "r") as f:
                    settings = json.load(f)
                    slow_down = settings.get("slow_down", False)
            except:
                pass
        
        speed_factor = 0.4 if slow_down else 1.0
        
        if slow_down != last_slow_down:
            if slow_down:
                log_event("SYSTEM", "Air Traffic Control issued system-wide SPEED RESTRICTION. All UAM velocities reduced to 40%.")
            else:
                log_event("SYSTEM", "Air Traffic Control lifted speed restriction. All UAM units resumed standard flight velocities.")
            last_slow_down = slow_down

    clock.tick(60)

    screen.fill(BLACK)

    # =====================================================
    # EVENTS
    # =====================================================

    for event in pygame.event.get():

        if event.type == pygame.QUIT:
            running = False

    # =====================================================
    # DRAW SECTORS
    # =====================================================

    pygame.draw.line(
        screen,
        GRAY,
        (550, 0),
        (550, HEIGHT),
        2
    )

    pygame.draw.line(
        screen,
        GRAY,
        (0, HEIGHT // 2),
        (SIMULATION_WIDTH, HEIGHT // 2),
        2
    )

    sectors = [

        ("Sector A", 20, 20),
        ("Sector B", 570, 20),
        ("Sector C", 20, 470),
        ("Sector D", 570, 470),

    ]

    for text, x, y in sectors:

        label = big_font.render(
            text,
            True,
            GREEN
        )

        screen.blit(label, (x, y))

    # =====================================================
    # DRAW SKYPORTS
    # =====================================================

    for port in skyports:

        pygame.draw.circle(

            screen,
            GREEN,
            (port["x"], port["y"]),
            10

        )

        text = font.render(
            port["name"],
            True,
            WHITE
        )

        screen.blit(
            text,
            (port["x"] + 15, port["y"] - 10)
        )

    # =====================================================
    # DRAW BUILDINGS
    # =====================================================

    for building in buildings:

        pygame.draw.rect(

            screen,
            PURPLE,
            (

                building["x"],
                building["y"],
                building["w"],
                building["h"]

            )

        )

        height_text = font.render(

            "Tall Building",
            True,
            WHITE

        )

        screen.blit(

            height_text,
            (
                building["x"],
                building["y"] - 20
            )

        )

    # =====================================================
    # DRAW BIRDS
    # =====================================================

    for bird in birds:

        bird["x"] += bird["speed"]

        if bird["x"] > 1050:
            bird["x"] = 0

        pygame.draw.circle(

            screen,
            WHITE,
            (
                int(bird["x"]),
                int(bird["y"])
            ),
            3

        )

    # =====================================================
    # DASHBOARD
    # =====================================================

    pygame.draw.rect(

        screen,
        DARK_PANEL,
        (1100, 0, 400, HEIGHT)

    )

    dashboard = big_font.render(

        "AIR TRAFFIC DASHBOARD",
        True,
        WHITE

    )

    screen.blit(dashboard, (1150, 20))

    # =====================================================
    # MOVE TAXIS
    # =====================================================

    for taxi in taxis:

        taxi.move()

        taxi.detect_buildings()

        # AI BUILDING AVOIDANCE
        for building in buildings:

            avoid_building(taxi, building)

        # TRAFFIC AI
        congestion_control(taxi, taxis)

        # DECISION ENGINE
        emergency_decision(taxi)

        stabilize_taxi(taxi)

        optimize_route(taxi)

        # DANGER ZONE
        if check_danger(taxi, taxis):

            draw_danger_zone(screen, taxi)

        taxi.color = BLUE

        taxi.collision = False

        taxi.draw()

    # =====================================================
    # COLLISION DETECTION
    # =====================================================

    collision_count = 0
    active_collisions_this_frame = set()

    for i in range(len(taxis)):

        for j in range(i + 1, len(taxis)):

            t1 = taxis[i]
            t2 = taxis[j]

            risk = calculate_risk_score(t1, t2)

            decision = ai_decision(
                t1,
                t2,
                risk
            )

            if risk > 50:

                collision_count += 1

                t1.color = RED
                t2.color = RED

                t1.collision = True
                t2.collision = True

                pair_key = tuple(sorted([t1.id, t2.id]))
                active_collisions_this_frame.add(pair_key)

                if pair_key not in logged_collisions:
                    action_taken = "Initiating active avoidance maneuvering."
                    log_event("COLLISION", f"Collision threat detected between {t1.id} & {t2.id} (Risk: {risk}%). {action_taken}")
                    logged_collisions.add(pair_key)

                pygame.draw.line(

                    screen,
                    YELLOW,
                    (t1.x, t1.y),
                    (t2.x, t2.y),
                    3

                )

                warning = font.render(

                    f"{decision}",
                    True,
                    RED

                )

                screen.blit(

                    warning,
                    (
                        (t1.x + t2.x) // 2,
                        (t1.y + t2.y) // 2
                    )

                )

    for pair in list(logged_collisions):
        if pair not in active_collisions_this_frame:
            logged_collisions.remove(pair)

    # =====================================================
    # SAVE DATA (EVERY 10 FRAMES FOR PERFORMANCE)
    # =====================================================

    if frame % 10 == 0:
        for taxi in taxis:
            save_data(
                taxi,
                taxi.collision,
                taxi.building_alert
            )
    frame += 1

    # =====================================================
    # DASHBOARD DATA
    # =====================================================

    active_text = big_font.render(

        f"Active Taxis: {len(taxis)}",
        True,
        GREEN

    )

    screen.blit(active_text, (1150, 80))

    collision_text = big_font.render(

        f"Collision Alerts: {collision_count}",
        True,
        RED

    )

    screen.blit(collision_text, (1150, 120))

    y_dashboard = 180

    for taxi in taxis:

        info = font.render(

            f"{taxi.id} | "
            f"Alt:{int(taxi.altitude)}m | "
            f"{taxi.pickup}->{taxi.drop}",

            True,
            WHITE

        )

        screen.blit(
            info,
            (1120, y_dashboard)
        )

        y_dashboard += 35

    # =====================================================
    # UPDATE SCREEN
    # =====================================================

    pygame.display.update()

# =========================================================
# QUIT
# =========================================================

pygame.quit()