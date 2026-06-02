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
from ai.camera_sensor import detect_in_camera_fov

# =========================================================
# INITIALIZE & SCREEN SETTINGS
# =========================================================

WIDTH = 1500
HEIGHT = 900

try:
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
except Exception:
    import os
    os.environ["SDL_VIDEODRIVER"] = "dummy"
    pygame.init()
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
GRAY = (40, 40, 50)
DARK_PANEL = (15, 15, 22)
ORANGE = (255, 165, 0)
PURPLE = (180, 0, 255)

# =========================================================
# MAP SETTINGS
# =========================================================

SIMULATION_WIDTH = 1100

SAFE_DISTANCE = 90

LAT_MIN = 12.8500
LAT_MAX = 13.1500

LON_MIN = 77.4000
LON_MAX = 77.8500

# =========================================================
# FONTS
# =========================================================

font = pygame.font.SysFont("Consolas", 14)
big_font = pygame.font.SysFont("Consolas", 20)

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
        "building_alert",
        "battery",
        "status"
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
    {"name": "Kempegowda International Airport", "x": 950, "y": 80},
    {"name": "CSIR-National Aerospace Laboratories", "x": 750, "y": 300},
    {"name": "Hebbal", "x": 500, "y": 80},
    {"name": "Yelahanka", "x": 200, "y": 70},
    {"name": "MG Road", "x": 500, "y": 450},
    {"name": "Indiranagar", "x": 800, "y": 400},
    {"name": "Whitefield", "x": 1050, "y": 350},
    {"name": "Electronic City", "x": 950, "y": 800},
    {"name": "Koramangala", "x": 650, "y": 650},
    {"name": "Marathahalli", "x": 900, "y": 550},
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
# NO-FLY ZONES & WEATHER STORM CELLS (Aviation Hazards)
# =========================================================

no_fly_zones = [
    {"name": "VIP Security Airspace (NFZ-A)", "x": 350, "y": 450, "radius": 100},
    {"name": "Military Restriction (NFZ-B)", "x": 680, "y": 380, "radius": 75}
]

weather_cells = [
    {"name": "Storm Alpha", "x": 550, "y": 450, "radius": 110, "dx": 0.4, "dy": -0.3}
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
# UNREGISTERED OBSTACLES (DYNAMIC HAZARDS)
# =========================================================

unregistered_obstacles = []
obstacle_types = [
    {"type": "Unregistered Drone", "speed_range": (2.0, 4.0), "size_range": (1.0, 3.0)},
    {"type": "Weather Balloon", "speed_range": (0.3, 0.8), "size_range": (6.0, 10.0)},
    {"type": "Helicopter", "speed_range": (5.0, 8.0), "size_range": (14.0, 20.0)}
]

def spawn_sudden_obstacle():
    ot = random.choice(obstacle_types)
    obs_id = f"OBS-{random.randint(100, 999)}"
    speed = random.uniform(*ot["speed_range"])
    size = random.uniform(*ot["size_range"])
    
    unregistered_obstacles.append({
        "id": obs_id,
        "type": ot["type"],
        "x": random.randint(200, 900),
        "y": random.randint(150, 750),
        "dx": random.choice([-1.0, 1.0]) * random.uniform(0.5, 1.0),
        "dy": random.choice([-1.0, 1.0]) * random.uniform(0.5, 1.0),
        "speed": speed,
        "size": size,
        "timestamp": datetime.now().strftime("%H:%M:%S")
    })
    log_event("AIRSPACE", f"WARNING: Sudden unregistered dynamic hazard {obs_id} ({ot['type']}) detected in aviation corridor.")

# Start with a couple of obstacles initially (Disabled - Obstacles removed from simulation)
# for _ in range(4):
#     spawn_sudden_obstacle()


# =========================================================
# AVIATION ROUTING ALTITUDE CORRIDOR MATRICES
# =========================================================

def get_corridor_altitude(vx, vy):
    """
    Translates movement velocity vector into aviation directional altitude layers.
    Symmetrical separations guarantee safety between opposite directions.
    """
    heading = math.degrees(math.atan2(vy, vx))
    if heading < 0:
        heading += 360
        
    # East (West -> East)
    if heading >= 337.5 or heading < 22.5:
        return 600
    # South-East (North -> East / West -> South)
    elif heading >= 22.5 and heading < 67.5:
        return 550
    # South (North -> South)
    elif heading >= 67.5 and heading < 112.5:
        return 600
    # South-West (North -> West / East -> South)
    elif heading >= 112.5 and heading < 157.5:
        return 550
    # West (East -> West)
    elif heading >= 157.5 and heading < 202.5:
        return 500
    # North-West (East -> North / South -> West)
    elif heading >= 202.5 and heading < 247.5:
        return 650
    # North (South -> North)
    elif heading >= 247.5 and heading < 292.5:
        return 500
    # North-East (West -> North / South -> East)
    elif heading >= 292.5 and heading < 337.5:
        return 650
        
    return 500

def get_altitude_color(alt):
    """
    Maps current altitude deck to signature color.
    """
    if alt >= 700:
        return PURPLE          # Obstacle Avoidance Climb
    elif alt >= 625:
        return (0, 255, 120)   # Green (650m Corridor)
    elif alt >= 575:
        return (255, 0, 255)   # Magenta (600m Corridor)
    elif alt >= 525:
        return (255, 215, 0)   # Yellow (550m Corridor)
    elif alt >= 475:
        return (0, 255, 240)   # Cyan (500m Corridor)
    else:
        return RED             # Emergency Descent / Glide Slope

# =========================================================
# PATH RENDERING W/ ARROWS
# =========================================================

def draw_path_with_arrows(screen, start, end, color, width=1):
    """
    Draws custom flight corridors with directional arrow heads showing vector velocity.
    """
    dash_length = 8
    gap_length = 5
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    dist = math.sqrt(dx**2 + dy**2)
    if dist == 0:
        return
    
    ux = dx / dist
    uy = dy / dist
    
    # Dash pattern
    curr = 0
    while curr < dist:
        step = min(dash_length, dist - curr)
        p1 = (start[0] + ux * curr, start[1] + uy * curr)
        p2 = (start[0] + ux * (curr + step), start[1] + uy * (curr + step))
        pygame.draw.line(screen, color, p1, p2, width)
        curr += dash_length + gap_length
        
    # Draw heading arrowhead halfway along path
    if dist > 60:
        ap = (start[0] + ux * (dist * 0.4), start[1] + uy * (dist * 0.4))
        px = -uy
        py = ux
        v1 = (ap[0] - ux * 8, ap[1] - uy * 8)
        v2 = (v1[0] + px * 5, v1[1] + py * 5)
        v3 = (v1[0] - px * 5, v1[1] - py * 5)
        pygame.draw.polygon(screen, color, [ap, v2, v3])

# =========================================================
# AIR TAXI CLASS
# =========================================================

class AirTaxi:

    def __init__(self, taxi_id):
        self.id = taxi_id

        start_port = random.choice(skyports)
        end_port = random.choice(skyports)
        while end_port["name"] == start_port["name"]:
            end_port = random.choice(skyports)

        self.x = start_port["x"]
        self.y = start_port["y"]

        self.target_x = end_port["x"]
        self.target_y = end_port["y"]

        self.pickup = start_port["name"]
        self.drop = end_port["name"]

        # Vector Autopilot parameters
        self.base_speed = random.uniform(1.8, 2.5)
        self.speed = 0.5  # Start slow for smooth takeoff

        self.target_altitude = 500
        self.altitude = 500

        self.color = BLUE
        self.collision = False
        self.building_alert = False
        self.battery = 100.0
        self.status = 'Flying'

        # Repulsion and separation steering accumulators
        self.steering_x = 0.0
        self.steering_y = 0.0
        self.camera_detection = None

    # =====================================================
    # GPS
    # =====================================================

    def get_gps(self):
        latitude = LAT_MIN + (self.y / HEIGHT) * (LAT_MAX - LAT_MIN)
        longitude = LON_MIN + (self.x / SIMULATION_WIDTH) * (LON_MAX - LON_MIN)
        return round(latitude, 5), round(longitude, 5)

    # =====================================================
    # MOVE
    # =====================================================

    def move(self):
        # 1. Desired velocity toward active flight target (destination or micro-route detour)
        active_target_x = self.detour_x if getattr(self, 'detouring', False) else self.target_x
        active_target_y = self.detour_y if getattr(self, 'detouring', False) else self.target_y

        dx = active_target_x - self.x
        dy = active_target_y - self.y
        distance = math.sqrt(dx ** 2 + dy ** 2)

        if distance != 0:
            desired_vx = (dx / distance) * self.speed
            desired_vy = (dy / distance) * self.speed
        else:
            desired_vx = 0.0
            desired_vy = 0.0

        # Calculate desired heading unit vector for tangential calculations
        if desired_vx != 0.0 or desired_vy != 0.0:
            d_dist = math.sqrt(desired_vx**2 + desired_vy**2)
            hx = desired_vx / d_dist
            hy = desired_vy / d_dist
        else:
            hx, hy = 1.0, 0.0

        # 2. Apply No-Fly Zone repulsion steering forces (tangential sliding)
        in_any_nfz = False
        for nfz in no_fly_zones:
            n_dx = self.x - nfz["x"]
            n_dy = self.y - nfz["y"]
            n_dist = math.sqrt(n_dx**2 + n_dy**2)
            if n_dist < nfz["radius"] + 35:
                in_any_nfz = True
                push_factor = (nfz["radius"] + 35 - n_dist) / (nfz["radius"] + 35)
                
                # Radial push unit vector pointing away from obstacle center
                rx = n_dx / n_dist if n_dist > 0 else 1.0
                ry = n_dy / n_dist if n_dist > 0 else 0.0
                
                # Tangential candidates (perpendicular slide vectors)
                t1_x, t1_y = -ry, rx
                t2_x, t2_y = ry, -rx
                
                # Select the candidate that aligns with the destination heading to avoid backward flight
                dot1 = t1_x * hx + t1_y * hy
                dot2 = t2_x * hx + t2_y * hy
                tx, ty = (t1_x, t1_y) if dot1 >= dot2 else (t2_x, t2_y)
                
                # Combine radial push (40%) and tangential slide (90%) for smooth guidance
                self.steering_x += (rx * 0.4 + tx * 0.9) * push_factor * 6.5
                self.steering_y += (ry * 0.4 + ty * 0.9) * push_factor * 6.5
                self.status = 'Emerging'
                
                if not getattr(self, 'has_nofly_logged', False):
                    log_event("AIRSPACE", f"RESTRICTION: {self.id} entered VIP zone buffer. Initiating boundary deflection turn.")
                    self.has_nofly_logged = True
        
        if not in_any_nfz:
            self.has_nofly_logged = False

        # 3. Apply Weather Storm cell repulsion steering forces (tangential sliding)
        in_any_storm = False
        for storm in weather_cells:
            s_dx = self.x - storm["x"]
            s_dy = self.y - storm["y"]
            s_dist = math.sqrt(s_dx**2 + s_dy**2)
            if s_dist < storm["radius"] + 35:
                in_any_storm = True
                push_factor = (storm["radius"] + 35 - s_dist) / (storm["radius"] + 35)
                
                # Radial push unit vector
                rx = s_dx / s_dist if s_dist > 0 else 1.0
                ry = s_dy / s_dist if s_dist > 0 else 0.0
                
                # Tangential candidates
                t1_x, t1_y = -ry, rx
                t2_x, t2_y = ry, -rx
                
                # Select candidate aligning with destination heading
                dot1 = t1_x * hx + t1_y * hy
                dot2 = t2_x * hx + t2_y * hy
                tx, ty = (t1_x, t1_y) if dot1 >= dot2 else (t2_x, t2_y)
                
                # Combine radial push (40%) and tangential slide (90%)
                self.steering_x += (rx * 0.4 + tx * 0.9) * push_factor * 5.5
                self.steering_y += (ry * 0.4 + ty * 0.9) * push_factor * 5.5
                self.status = 'Emerging'
                
                # Turbulence velocity penalty
                self.speed = max(0.6, self.speed - 0.15)
                
                if not getattr(self, 'has_storm_logged', False):
                    log_event("WEATHER", f"METEOROLOGY: {self.id} hit heavy storm cell. Engaging severe turbulence flight envelope.")
                    self.has_storm_logged = True
                    
        if not in_any_storm:
            self.has_storm_logged = False

        # 4. Sum desired velocity and dynamic steering vectors
        actual_vx = desired_vx + self.steering_x
        actual_vy = desired_vy + self.steering_y

        actual_dist = math.sqrt(actual_vx**2 + actual_vy**2)
        if actual_dist > 0:
            current_speed = self.speed * speed_factor
            self.x += (actual_vx / actual_dist) * current_speed
            self.y += (actual_vy / actual_dist) * current_speed

        # 6. Smooth altitude deck transition
        if not self.building_alert and not getattr(self, 'is_emergency_landing', False) and not getattr(self, 'cooperative_avoidance', False):
            # Proactively select corridor target altitude from actual heading direction
            self.target_altitude = get_corridor_altitude(actual_vx, actual_vy)

        # Apply smooth altitude transition (Easing / LERP)
        self.altitude += (self.target_altitude - self.altitude) * 0.05

        # 7. Check if destination was reached
        t_dx = self.target_x - self.x
        t_dy = self.target_y - self.y
        t_dist = math.sqrt(t_dx**2 + t_dy**2)

        if t_dist < 15:
            if getattr(self, 'is_emergency_landing', False):
                # Diversion landing complete! Recharge battery and lift restrictions
                log_event("ROUTE", f"EMERGENCY: {self.id} safely completed emergency diversion at {self.drop}.")
                self.battery = 100.0
                self.is_emergency_landing = False
                self.status = 'Flying'

            new_target = random.choice(skyports)
            while new_target["name"] == self.drop:
                new_target = random.choice(skyports)

            old_pickup = self.pickup
            old_drop = self.drop

            self.pickup = self.drop
            self.drop = new_target["name"]

            self.target_x = new_target["x"]
            self.target_y = new_target["y"]
            
            # Reset takeoff speed
            self.speed = 0.5

            log_event("ROUTE", f"TRAFFIC: {self.id} landed at {old_drop}. Transitioning routes to {self.drop}.")

    # =====================================================
    # BUILDING DETECTION
    # =====================================================

    def detect_buildings(self):
        self.building_alert = False
        in_any_building = False
        for building in buildings:
            bx = building["x"]
            by = building["y"]
            bw = building["w"]
            bh = building["h"]

            # Broad boundary box check
            if (
                self.x > bx - 40 and
                self.x < bx + bw + 40 and
                self.y > by - 40 and
                self.y < by + bh + 40
            ):
                in_any_building = True
                self.building_alert = True
                self.target_altitude = 750
                
                if not getattr(self, 'has_building_alert_logged', False):
                    log_event("BUILDING", f"OBSTACLE: {self.id} entered tower buffer zones. Activating climb profile (+750m).")
                    self.has_building_alert_logged = True
                break

        if not in_any_building:
            self.has_building_alert_logged = False

    # =====================================================
    # DRAW
    # =====================================================

    def draw(self):
        latitude, longitude = self.get_gps()
        color = get_altitude_color(self.altitude)
        is_detouring = getattr(self, 'detouring', False)

        # 1. Real-time path corridors with direction indicators
        if is_detouring:
            # Draw primary active vector to detour waypoint
            draw_path_with_arrows(screen, (self.x, self.y), (self.detour_x, self.detour_y), ORANGE, width=2)
            # Draw planned path from detour waypoint to final target in thin gold
            draw_path_with_arrows(screen, (self.detour_x, self.detour_y), (self.target_x, self.target_y), (255, 170, 0), width=1)
        else:
            draw_path_with_arrows(screen, (self.x, self.y), (self.target_x, self.target_y), color, width=2)

        # 2. Pulsing safe distance collision circle
        pulse = int(4 * math.sin(frame * 0.12))
        bubble_radius = int(SAFE_DISTANCE // 2) + pulse
        bubble_surf = pygame.Surface((bubble_radius*2, bubble_radius*2), pygame.SRCALPHA)
        
        # Transparent visual layers
        bubble_color = (255, 0, 0, 30) if self.status == 'Critical' else (255, 165, 0, 25) if is_detouring else (color[0], color[1], color[2], 20)
        border_color = (255, 0, 0, 100) if self.status == 'Critical' else (255, 165, 0, 95) if is_detouring else (color[0], color[1], color[2], 80)
        
        pygame.draw.circle(bubble_surf, bubble_color, (bubble_radius, bubble_radius), bubble_radius)
        pygame.draw.circle(bubble_surf, border_color, (bubble_radius, bubble_radius), bubble_radius, 1)
        screen.blit(bubble_surf, (int(self.x) - bubble_radius, int(self.y) - bubble_radius))

        # 3. Aircraft indicator node
        pygame.draw.circle(screen, BLACK, (int(self.x), int(self.y)), 10)
        pygame.draw.circle(screen, ORANGE if is_detouring else color, (int(self.x), int(self.y)), 7)

        # Small nose-cone notch pointing forward towards active target
        active_t_x = self.detour_x if is_detouring else self.target_x
        active_t_y = self.detour_y if is_detouring else self.target_y
        dx = active_t_x - self.x
        dy = active_t_y - self.y
        dist = math.sqrt(dx**2 + dy**2)
        if dist > 0:
            nx = dx / dist
            ny = dy / dist
            pygame.draw.line(screen, WHITE, (self.x, self.y), (self.x + nx * 10, self.y + ny * 10), 2)

        # 4. Rich telemetry labeling text
        label_y = self.y - 50
        id_text = font.render(f"{self.id} | BATT: {int(self.battery)}%", True, WHITE)
        alt_text = font.render(f"ALT: {int(self.altitude)}m", True, color)
        
        # Color codes: RED for Critical, ORANGE for Detouring, YELLOW for Emerging, GREEN for Flying
        status_color = RED if self.status == 'Critical' else ORANGE if is_detouring else YELLOW if self.status == 'Emerging' else GREEN
        status_text = font.render(f"SYS: {self.status}", True, status_color)
        route_text = font.render(f"{self.pickup} -> {self.drop}", True, (200, 200, 200))

        screen.blit(id_text, (self.x + 15, label_y))
        screen.blit(alt_text, (self.x + 15, label_y + 13))
        screen.blit(status_text, (self.x + 15, label_y + 26))
        screen.blit(route_text, (self.x + 15, label_y + 39))

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
    battery = getattr(taxi, 'battery', 100.0)
    status = getattr(taxi, 'status', 'Flying')
    
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
            building_alert,
            round(battery, 1),
            status
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
congested_zones = []
weather_info = None

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

    if frame % 60 == 0:
        weather_path = "data/weather_info.json"
        if os.path.exists(weather_path):
            try:
                with open(weather_path, "r") as f:
                    weather_info = json.load(f)
            except:
                pass

    clock.tick(60)

    screen.fill(BLACK)

    # =====================================================
    # EVENTS
    # =====================================================

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    # =====================================================
    # UPDATE DYNAMIC AVIATION HAZARDS (Storm drifting)
    # =====================================================
    for storm in weather_cells:
        storm["x"] += storm["dx"]
        storm["y"] += storm["dy"]
        
        # Grid boundaries bounce mechanics
        if storm["x"] < 150 or storm["x"] > 950:
            storm["dx"] *= -1
        if storm["y"] < 100 or storm["y"] > 800:
            storm["dy"] *= -1

    # Sync live weather position to JSON for API bridge consumption
    if frame % 10 == 0:
        try:
            with open("data/weather.json", "w") as wf:
                json.dump(weather_cells, wf)
            with open("data/obstacles.json", "w") as of:
                json.dump(unregistered_obstacles, of)
            
            # Write camera telemetry
            camera_telemetry = {}
            for t in taxis:
                if t.camera_detection:
                    camera_telemetry[t.id] = t.camera_detection
            with open("data/camera_telemetry.json", "w") as cf:
                json.dump(camera_telemetry, cf)
        except:
            pass

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
    # DRAW NO-FLY ZONES (Glowing barriers)
    # =====================================================
    for nfz in no_fly_zones:
        nfz_surf = pygame.Surface((nfz["radius"]*2, nfz["radius"]*2), pygame.SRCALPHA)
        # Pulse visual transparency
        nfz_alpha = int(45 + 10 * math.sin(frame * 0.08))
        pygame.draw.circle(nfz_surf, (255, 0, 0, nfz_alpha), (nfz["radius"], nfz["radius"]), nfz["radius"])
        pygame.draw.circle(nfz_surf, (255, 0, 0, 180), (nfz["radius"], nfz["radius"]), nfz["radius"], 2)
        
        # Expanding dash boundary rings
        dash_r = int((frame * 1.6) % nfz["radius"])
        dash_alpha = int(120 * (1.0 - dash_r / nfz["radius"]))
        pygame.draw.circle(nfz_surf, (255, 0, 0, dash_alpha), (nfz["radius"], nfz["radius"]), dash_r, 1)
        screen.blit(nfz_surf, (nfz["x"] - nfz["radius"], nfz["y"] - nfz["radius"]))
        
        # Label indicator
        nfz_lbl = font.render("RESTRICTED AIRSPACE (NO-FLY)", True, (255, 120, 120))
        screen.blit(nfz_lbl, (nfz["x"] - 90, nfz["y"] - 10))

    # =====================================================
    # DRAW WEATHER STORM HAZARDS (Rain Radar sweeps)
    # =====================================================
    for storm in weather_cells:
        storm_surf = pygame.Surface((storm["radius"]*2, storm["radius"]*2), pygame.SRCALPHA)
        pygame.draw.circle(storm_surf, (0, 100, 255, 30), (storm["radius"], storm["radius"]), storm["radius"])
        pygame.draw.circle(storm_surf, (0, 150, 255, 120), (storm["radius"], storm["radius"]), storm["radius"], 2)
        
        # Triple pulsing radar sweeps
        for offset in [0, 40, 80]:
            sweep_r = int((frame + offset) % storm["radius"])
            sweep_a = int(90 * (1.0 - sweep_r / storm["radius"]))
            pygame.draw.circle(storm_surf, (0, 180, 255, sweep_a), (storm["radius"], storm["radius"]), sweep_r, 1)
            
        screen.blit(storm_surf, (storm["x"] - storm["radius"], storm["y"] - storm["radius"]))
        
        storm_lbl = font.render("WEATHER STORM HAZARD (TURBULENCE)", True, (0, 200, 255))
        screen.blit(storm_lbl, (storm["x"] - 105, storm["y"] - 10))

    # =====================================================
    # DRAW CONGESTED ZONES (Dynamic Bottlenecks)
    # =====================================================
    for cz in congested_zones:
        cz_surf = pygame.Surface((cz["radius"]*2, cz["radius"]*2), pygame.SRCALPHA)
        # Deep semi-transparent red warning circle
        pygame.draw.circle(cz_surf, (255, 30, 30, 45), (cz["radius"], cz["radius"]), cz["radius"])
        pygame.draw.circle(cz_surf, (255, 30, 30, 180), (cz["radius"], cz["radius"]), cz["radius"], 2)
        
        # Dynamic warning pulse ring
        pulse_r = int((frame * 2.0) % cz["radius"])
        pulse_alpha = int(140 * (1.0 - pulse_r / cz["radius"]))
        pygame.draw.circle(cz_surf, (255, 30, 30, pulse_alpha), (cz["radius"], cz["radius"]), pulse_r, 1)
        
        screen.blit(cz_surf, (int(cz["x"] - cz["radius"]), int(cz["y"] - cz["radius"])))
        
        # Display traffic density index label
        cz_lbl = font.render(f"CONGESTED ZONE (DENSITY: {cz['density']})", True, (255, 100, 100))
        screen.blit(cz_lbl, (int(cz["x"] - 110), int(cz["y"] - 10)))

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
            GRAY,
            (
                building["x"],
                building["y"],
                building["w"],
                building["h"]
            )
        )
        # Highlight top rim of skyscraper in purple
        pygame.draw.rect(
            screen,
            PURPLE,
            (
                building["x"],
                building["y"],
                building["w"],
                8
            )
        )

        height_text = font.render(
            "Tower (320m Deck)",
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
    # DRAW & UPDATE UNREGISTERED OBSTACLES
    # =====================================================

    for obs in unregistered_obstacles:
        obs["x"] += obs["dx"] * obs["speed"]
        obs["y"] += obs["dy"] * obs["speed"]
        
        if obs["x"] < 50 or obs["x"] > 1050:
            obs["dx"] *= -1
        if obs["y"] < 50 or obs["y"] > 850:
            obs["dy"] *= -1
            
        # Draw dynamic target bubble
        pulse_val = int(2 * math.sin(frame * 0.15))
        pygame.draw.circle(screen, (255, 69, 0), (int(obs["x"]), int(obs["y"])), int(obs["size"] + 6 + pulse_val), 2)
        pygame.draw.circle(screen, RED, (int(obs["x"]), int(obs["y"])), 3)
        
        obs_lbl = font.render(f"{obs['id']}:{obs['type'][:5]}", True, RED)
        screen.blit(obs_lbl, (int(obs["x"]) + 10, int(obs["y"]) - 10))

    # Spawning periodic sudden obstacles disabled
    # if frame % 250 == 0 and len(unregistered_obstacles) < 6:
    #     spawn_sudden_obstacle()


    # =====================================================
    # DASHBOARD
    # =====================================================

    pygame.draw.rect(
        screen,
        DARK_PANEL,
        (1100, 0, 400, HEIGHT)
    )

    dashboard = big_font.render(
        "AIR TRAFFIC COMMAND DECK",
        True,
        WHITE
    )

    screen.blit(dashboard, (1150, 20))

    # =====================================================
    # MOVE & INTEGRATE TAXIS
    # =====================================================

    # 0. Scan dynamic airspace congestion zones
    congested_zones = detect_congestion_zones(taxis)

    for taxi in taxis:
        taxi.steering_x = 0.0
        taxi.steering_y = 0.0
        taxi.detect_buildings()

        # 1. Autopilot Building Repulsions
        for building in buildings:
            avoid_building(taxi, building)

        # 2. Dynamic Corridor Separation Controls
        congestion_control(taxi, taxis)

        # 2b. Dynamic Airspace Congestion Avoidance Rerouting
        apply_congestion_avoidance(taxi, congested_zones)

        # 2bb. AI Weather-Aware Routing & Safety Controls
        if weather_info:
            wind = weather_info.get("wind_speed", 0.0)
            cond = weather_info.get("weather_condition", "Clear")
            
            # High wind rule: reroute/stabilize by forcing a lower target altitude and slowing down
            if wind > 40.0:
                taxi.target_altitude = min(taxi.target_altitude, 480)
                taxi.speed = max(0.5, taxi.speed * 0.7)
                if not getattr(taxi, 'high_wind_alert_logged', False):
                    log_event("WEATHER", f"WEATHER ALERT: {taxi.id} wind speed is {wind} km/h (exceeds 40 km/h). Cruising altitude lowered and speed reduced.")
                    taxi.high_wind_alert_logged = True
            else:
                taxi.high_wind_alert_logged = False
                
            # Storm/heavy rain rule: mark route as unsafe, trigger emergency landing
            if cond in ["Thunderstorm", "Rainy"]:
                taxi.status = 'Critical'
                if not getattr(taxi, 'storm_alert_logged', False):
                    log_event("WEATHER", f"CRITICAL: {taxi.id} route flagged UNSAFE due to {cond.upper()}. Commencing immediate emergency diversion landing.")
                    # Force diversion to nearest skyport
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
                        taxi.pickup = "DIV_STORM"
                        taxi.drop = closest_port["name"]
                        taxi.target_x = closest_port["x"]
                        taxi.target_y = closest_port["y"]
                        taxi.target_altitude = 480
                        taxi.is_emergency_landing = True
                    taxi.storm_alert_logged = True
            else:
                taxi.storm_alert_logged = False

        # 2c. Camera sensor dynamic evasive detouring
        all_hazards = [{"id": f"BIRD-{idx}", "x": b["x"], "y": b["y"], "speed": b["speed"], "size": 2.0} for idx, b in enumerate(birds)] + unregistered_obstacles
        taxi.camera_detection = detect_in_camera_fov(taxi, all_hazards, fov_angle=60, fov_range=160)
        
        if taxi.camera_detection:
            obs_x = taxi.camera_detection["x"]
            obs_y = taxi.camera_detection["y"]
            obs_id = taxi.camera_detection["obstacle_id"]
            obs_dx = obs_x - taxi.x
            obs_dy = obs_y - taxi.y
            dist = math.sqrt(obs_dx**2 + obs_dy**2)
            if dist > 0:
                # Two candidate perpendicular directions to evade the obstacle
                perp_x1 = -obs_dy
                perp_y1 = obs_dx
                perp_x2 = obs_dy
                perp_y2 = -obs_dx
                
                # Form two waypoint candidates
                wp1_x = obs_x + (perp_x1 / dist) * 75
                wp1_y = obs_y + (perp_y1 / dist) * 75
                wp2_x = obs_x + (perp_x2 / dist) * 75
                wp2_y = obs_y + (perp_y2 / dist) * 75
                
                # Pick the waypoint that is closer to the final destination to minimize path detour
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
                taxi.speed = max(0.8, taxi.speed * 0.85)
                if not getattr(taxi, 'has_camera_logged', False) or getattr(taxi, 'last_logged_obs', '') != obs_id:
                    log_event("COLLISION", f"CAMERA: {taxi.id} onboard optical AI predicted a '{taxi.camera_detection['predicted_class']}' ({taxi.camera_detection['confidence']}% conf) at {taxi.camera_detection['distance']}m. Banking to evasive waypoint.")
                    taxi.has_camera_logged = True
                    taxi.last_logged_obs = obs_id
        else:
            if getattr(taxi, 'detouring', False):
                # Evasive detour early release: clear detour if waypoint is reached or now further from target than we are
                tdx = taxi.detour_x - taxi.x
                tdy = taxi.detour_y - taxi.y
                tdist = math.sqrt(tdx**2 + tdy**2)
                
                t_dx = taxi.target_x - taxi.x
                t_dy = taxi.target_y - taxi.y
                t_dist = math.sqrt(t_dx**2 + t_dy**2)
                
                if tdist < 15 or tdist > t_dist:
                    taxi.detouring = False
                    taxi.status = 'Flying'
                    taxi.has_camera_logged = False

        # 3. Emergency Divert Checks (Battery & Diversions)
        emergency_decision(taxi, skyports)

        # 4. Aerodynamic envelope caps
        stabilize_taxi(taxi)

        # 5. Takeoff / Landing Glide optimization curves
        optimize_route(taxi)

        # 6. Danger bubble density alerts
        if check_danger(taxi, taxis):
            draw_danger_zone(screen, taxi)

        # 7. Write low battery divert announcements to events.csv
        if getattr(taxi, 'should_log_emergency', False):
            log_event("COLLISION", f"EMERGENCY: {taxi.id} battery low ({int(taxi.battery)}%). Autopilot diverting to {taxi.drop}.")
            taxi.should_log_emergency = False

        # 8. Reset dynamic statuses to standard flight if clear of obstacles
        if taxi.status in ['Emerging', 'Critical', 'Bypassing'] and not taxi.building_alert:
            in_nfz = any(math.sqrt((taxi.x - nf["x"])**2 + (taxi.y - nf["y"])**2) < nf["radius"] + 35 for nf in no_fly_zones)
            in_stm = any(math.sqrt((taxi.x - st["x"])**2 + (taxi.y - st["y"])**2) < st["radius"] + 35 for st in weather_cells)
            if not in_nfz and not in_stm:
                taxi.status = 'Flying'

        # Move aircraft using resolved autopilot vectors
        taxi.move()

        # Reset immediate collision flags before predictive calculation runs
        taxi.collision = False

        # Draw taxi node with custom layouts and telemetry HUD overlays
        taxi.draw()

    # =====================================================
    # PREDICTIVE COLLISION LOOK-AHEAD PATH RUN
    # =====================================================

    collision_count = 0
    active_collisions_this_frame = set()

    for i in range(len(taxis)):
        for j in range(i + 1, len(taxis)):
            t1 = taxis[i]
            t2 = taxis[j]

            # Look ahead predictive AI path conflict analysis
            risk = calculate_risk_score(t1, t2)
            decision = ai_decision(t1, t2, risk)

            if risk > 50:
                collision_count += 1
                t1.collision = True
                t2.collision = True
                
                # Proactive speed-coordination deceleration during conflict resolution
                t1.speed = max(0.7, t1.speed * 0.9)
                t2.speed = max(0.7, t2.speed * 0.9)

                # Dynamic warning color overrides
                if risk > 80:
                    t1.status = 'Critical'
                    t2.status = 'Critical'
                else:
                    t1.status = 'Bypassing'
                    t2.status = 'Bypassing'

                pair_key = tuple(sorted([t1.id, t2.id]))
                active_collisions_this_frame.add(pair_key)

                if pair_key not in logged_collisions:
                    action_taken = "Autopilot engaging collaborative vertical split corridors."
                    log_category = "COLLISION" if risk > 80 else "AIRSPACE"
                    log_event(log_category, f"CONFLICT: Proximity risk between {t1.id} & {t2.id} is {risk}%. {action_taken}")
                    logged_collisions.add(pair_key)

                # Render dynamic visual look-ahead conflict line
                line_color = RED if risk > 80 else ORANGE
                pygame.draw.line(
                    screen,
                    line_color,
                    (t1.x, t1.y),
                    (t2.x, t2.y),
                    3
                )

                warning = font.render(
                    f"{decision} ({risk}%)",
                    True,
                    line_color
                )

                screen.blit(
                    warning,
                    (
                        (t1.x + t2.x) // 2 - 40,
                        (t1.y + t2.y) // 2
                    )
                )

    for pair in list(logged_collisions):
        if pair not in active_collisions_this_frame:
            logged_collisions.remove(pair)

    # =====================================================
    # SAVE TELESCOPED DATA (PERFORMANCE GLIDE)
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
    # ATC TELEMETRY OVERLAYS
    # =====================================================

    active_text = big_font.render(
        f"Active Taxis: {len(taxis)}",
        True,
        GREEN
    )

    screen.blit(active_text, (1150, 80))

    collision_text = big_font.render(
        f"Conflict Alerts: {collision_count}",
        True,
        RED if collision_count > 0 else GREEN
    )

    screen.blit(collision_text, (1150, 120))

    y_dashboard = 180

    for taxi in taxis:
        color = get_altitude_color(taxi.altitude)
        info = font.render(
            f"{taxi.id} | "
            f"Alt:{int(taxi.altitude)}m | "
            f"Batt:{int(taxi.battery)}% | "
            f"{taxi.status}",
            True,
            color
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