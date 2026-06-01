import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Wind, 
  AlertTriangle, 
  Cpu, 
  Zap, 
  Crosshair,
  TrendingUp,
  Wifi,
  Layers,
  Terminal,
  Activity as Heartbeat,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Airspace3D from './components/Airspace3D';
import Analytics from './components/Analytics';

interface Taxi {
  id: string;
  status: 'Flying' | 'Landing' | 'Emerging' | 'Critical' | 'Bypassing' | 'Detouring';
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  route: string;
  risk: number;
  battery: number;
  lastSeen: string;
  place_name?: string;
  nearest_skyport?: string;
  weather_condition?: string;
  wind_speed?: number;
  temperature?: number;
  visibility?: number;
}

interface Airspace {
  skyports: Array<{ name: string; x: number; y: number; latitude?: number; longitude?: number }>;
  buildings: Array<{ x: number; y: number; w: number; h: number }>;
  no_fly_zones: Array<{ name: string; x: number; y: number; radius: number }>;
  weather_cells: Array<{ name: string; x: number; y: number; radius: number }>;
  congested_zones: Array<{ x: number; y: number; radius: number; density: number; latitude?: number; longitude?: number }>;
  weather?: {
    temperature: number;
    wind_speed: number;
    weather_condition: string;
    visibility: number;
    is_safe: boolean;
  };
}

const getAltitudeColor = (alt: number) => {
  if (alt >= 700) return '#b400ff'; // Purple (Climb override)
  if (alt >= 625) return '#00ff78'; // Green (650m Corridor)
  if (alt >= 575) return '#ff00dc'; // Magenta (600m Corridor)
  if (alt >= 525) return '#ffd700'; // Yellow (550m Corridor)
  if (alt >= 475) return '#00f6ff'; // Cyan (500m Corridor)
  return '#ff4646'; // Red (Emergency / Landing Descent)
};

interface CameraFeedProps {
  taxiId: string | null;
  cameraTelemetry: Record<string, any>;
}

function AirTaxiCameraFeed({ taxiId, cameraTelemetry }: CameraFeedProps) {
  const [glitch, setGlitch] = useState(false);
  const detection = taxiId ? cameraTelemetry[taxiId] : null;

  useEffect(() => {
    // Periodically trigger a quick 150ms screen glitch to represent real-time signal noise
    const timer = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 150);
    }, randomBetween(5000, 12000));
    return () => clearInterval(timer);
  }, []);

  function randomBetween(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  // Draw simulated graphic vectors representing the scanned obstacle types inside the camera
  function renderObstacleIcon(type: string) {
    if (type.includes("Drone")) {
      return (
        <svg viewBox="0 0 100 100" className="w-16 h-16 text-red-500 animate-bounce">
          <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="2" />
          <line x1="20" y1="80" x2="80" y2="20" stroke="currentColor" strokeWidth="2" />
          <circle cx="20" cy="20" r="6" fill="currentColor" />
          <circle cx="80" cy="20" r="6" fill="currentColor" />
          <circle cx="20" cy="80" r="6" fill="currentColor" />
          <circle cx="80" cy="80" r="6" fill="currentColor" />
        </svg>
      );
    } else if (type.includes("Helicopter")) {
      return (
        <svg viewBox="0 0 100 100" className="w-16 h-16 text-orange-500">
          <ellipse cx="50" cy="55" rx="25" ry="12" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="50" y1="43" x2="50" y2="35" stroke="currentColor" strokeWidth="2" />
          <line x1="25" y1="55" x2="15" y2="70" stroke="currentColor" strokeWidth="2" />
          <line x1="75" y1="55" x2="85" y2="70" stroke="currentColor" strokeWidth="2" />
          <line x1="10" y1="70" x2="90" y2="70" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    } else if (type.includes("Balloon")) {
      return (
        <svg viewBox="0 0 100 100" className="w-16 h-16 text-yellow-500 animate-pulse">
          <circle cx="50" cy="45" r="22" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M 40 65 L 60 65 L 54 80 L 46 80 Z" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="40" y1="55" x2="40" y2="65" stroke="currentColor" strokeWidth="1" />
          <line x1="60" y1="55" x2="60" y2="65" stroke="currentColor" strokeWidth="1" />
        </svg>
      );
    } else {
      return (
        <svg viewBox="0 0 100 100" className="w-16 h-16 text-cyan-400">
          <path d="M 20 50 Q 35 30 50 50 Q 65 30 80 50" fill="none" stroke="currentColor" strokeWidth="2" className="animate-pulse" />
          <path d="M 30 65 Q 42 50 54 65 Q 66 50 78 65" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    }
  }

  return (
    <div className="border border-zinc-800 bg-[#07070a] p-3 font-mono rounded-none">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${taxiId ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
          {taxiId ? `ONBOARD_OPTICAL_FEED // ${taxiId}` : 'NO TARGET LINK CONNECTED'}
        </span>
        <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">
          {detection ? 'LOCK_ACQUIRED' : 'SCANNING_AIRSPACE'}
        </span>
      </div>

      <div className="relative aspect-[16/10] bg-[#020203] border border-zinc-900 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none z-10" />

        {(glitch || !taxiId) && (
          <div className="absolute inset-0 bg-[#08080c] opacity-80 z-20 flex flex-col items-center justify-center">
            <div className="w-full h-0.5 bg-zinc-700/30 animate-bounce" />
            <div className="text-[9px] font-black text-zinc-700 tracking-[0.3em] uppercase select-none animate-pulse">
              {!taxiId ? 'SYS_FEED_OFFLINE' : 'STATIC_INTERFERENCE_RECONNECTING'}
            </div>
            <div className="w-full h-0.5 bg-zinc-700/30 animate-ping mt-4" />
          </div>
        )}

        {taxiId && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-zinc-700" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-zinc-700" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-zinc-700" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-zinc-700" />
            
            <div className="absolute top-1/2 left-1/2 w-8 h-8 border border-dashed border-zinc-800 -translate-x-1/2 -translate-y-1/2 rounded-full" />
            <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-zinc-800 -translate-x-1/2 -translate-y-1/2 rounded-full" />
          </div>
        )}

        {taxiId ? (
          detection ? (
            <div className="flex flex-col items-center justify-center animate-pulse z-0">
              <div className="absolute border border-red-500/40 w-24 h-24 flex items-center justify-center">
                <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-red-500" />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-red-500" />
                <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-red-500" />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-red-500" />
                
                {renderObstacleIcon(detection.predicted_class)}
              </div>
              <span className="text-[7px] text-red-500/60 absolute bottom-4 select-none font-bold uppercase tracking-[0.25em]">TARGET LOCK ACQUIRED</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center opacity-40 z-0">
              <Crosshair className="w-10 h-10 text-cyan-500/60 animate-spin" style={{ animationDuration: '8s' }} />
              <span className="text-[8px] text-cyan-400 tracking-[0.2em] font-bold mt-2 uppercase">Airspace Safe // Monitoring Lanes</span>
            </div>
          )
        ) : (
          <div className="text-[8px] text-zinc-600 tracking-wider text-center select-none uppercase leading-relaxed max-w-xs">
            Connect link to start UAM forward optical sensor streams
          </div>
        )}
      </div>

      {taxiId && (
        <div className="mt-2.5 pt-2 border-t border-zinc-900 grid grid-cols-12 gap-2 text-[9px]">
          {detection ? (
            <>
              <div className="col-span-6 space-y-1">
                <span className="text-zinc-500 uppercase block text-[8px]">AI_Classification</span>
                <span className="text-red-400 font-bold block truncate">{detection.predicted_class.toUpperCase()}</span>
                <span className="text-zinc-600 block text-[7px] leading-tight uppercase font-semibold">CONFIDENCE: {detection.confidence}%</span>
              </div>
              
              <div className="col-span-6 space-y-1 pl-2.5 border-l border-zinc-900">
                <span className="text-zinc-500 uppercase block text-[8px]">AutoPilot_Decision</span>
                <span className="text-yellow-500 font-bold block animate-pulse">BANKING_LATERAL</span>
                <span className="text-white block text-[7px] leading-tight uppercase font-semibold">BYPASSING CORRIDOR Y BY 75M</span>
              </div>
            </>
          ) : (
            <div className="col-span-12 py-1.5 flex items-center justify-between text-zinc-500 bg-zinc-950/20 px-2">
              <span className="flex items-center gap-1.5 animate-pulse"><div className="w-1 h-1 rounded-full bg-cyan-400" /> AP_CORRIDOR_STEERING: ACTIVE</span>
              <span className="text-[8px]">STATUS: OK</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const latMin = 12.8500;
const latMax = 13.1500;
const lonMin = 77.4000;
const lonMax = 77.8500;

const toX = (lon: number) => ((lon - lonMin) / (lonMax - lonMin)) * 1100;
const toY = (lat: number) => ((lat - latMin) / (latMax - latMin)) * 900;

interface LeafletMapProps {
  taxis: any[];
  airspace: any;
  selectedTaxiId: string | null;
  setSelectedTaxiId: (id: string | null) => void;
}

function LeafletMap({ taxis, airspace, selectedTaxiId, setSelectedTaxiId }: LeafletMapProps) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const leafletMapInst = React.useRef<any>(null);
  const markersRef = React.useRef<Record<string, any>>({});
  const skyportMarkersRef = React.useRef<any[]>([]);
  const pathsRef = React.useRef<Record<string, any>>({});
  const nfzRef = React.useRef<any[]>([]);
  const congestedRef = React.useRef<any[]>([]);

  // Robust async safety: poll for window.L loading
  const [lAvailable, setLAvailable] = React.useState(!!(window as any).L);

  React.useEffect(() => {
    if ((window as any).L) {
      setLAvailable(true);
      return;
    }
    const interval = setInterval(() => {
      if ((window as any).L) {
        setLAvailable(true);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (!mapRef.current || leafletMapInst.current || !lAvailable) return;

    const L = (window as any).L;
    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView([12.9716, 77.5946], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18
    }).addTo(map);

    leafletMapInst.current = map;

    return () => {
      if (leafletMapInst.current) {
        leafletMapInst.current.remove();
        leafletMapInst.current = null;
      }
    };
  }, [lAvailable]);

  React.useEffect(() => {
    const map = leafletMapInst.current;
    if (!map || !(window as any).L) return;
    const L = (window as any).L;

    // A. Render Skyports
    if (airspace && skyportMarkersRef.current.length === 0) {
      airspace.skyports.forEach((port: any) => {
        if (port.latitude && port.longitude) {
          const marker = L.circleMarker([port.latitude, port.longitude], {
            radius: 8,
            fillColor: '#00ff78',
            color: '#fff',
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.9
          }).addTo(map)
            .bindTooltip(port.name, { permanent: true, className: 'skyport-tooltip', direction: 'top', offset: [0, -10] });
          skyportMarkersRef.current.push(marker);
        }
      });
    }

    // B. Render No-Fly Zones
    if (airspace && nfzRef.current.length === 0) {
      airspace.no_fly_zones.forEach((nfz: any) => {
        const lat = 12.8500 + (nfz.y / 900.0) * (13.1500 - 12.8500);
        const lon = 77.4000 + (nfz.x / 1100.0) * (77.8500 - 77.4000);
        const circle = L.circle([lat, lon], {
          radius: nfz.radius * 7.5,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.15,
          weight: 1.5,
          dashArray: '5, 5'
        }).addTo(map);
        nfzRef.current.push(circle);
      });
    }

    // C. Render / Update Congested Zones
    congestedRef.current.forEach(c => map.removeLayer(c));
    congestedRef.current = [];
    if (airspace?.congested_zones) {
      airspace.congested_zones.forEach((cz: any) => {
        if (cz.latitude && cz.longitude) {
          const circle = L.circle([cz.latitude, cz.longitude], {
            radius: cz.radius * 7.5,
            color: '#f97316',
            fillColor: '#ef4444',
            fillOpacity: 0.25,
            weight: 2
          }).addTo(map)
            .bindTooltip(`CONGESTED ZONE (DENSITY: ${cz.density})`, { permanent: true, className: 'congested-tooltip' });
          congestedRef.current.push(circle);
        }
      });
    }

    // D. Render UAM Taxis & Flight paths
    taxis.forEach((taxi: any) => {
      const isSelected = selectedTaxiId === taxi.id;
      const taxiColor = taxi.status === 'Critical' ? '#ef4444' : taxi.status === 'Detouring' ? '#f97316' : '#00f6ff';

      if (markersRef.current[taxi.id]) {
        markersRef.current[taxi.id].setLatLng([taxi.latitude, taxi.longitude]);
        markersRef.current[taxi.id].setStyle({ fillColor: taxiColor });
      } else {
        const marker = L.circleMarker([taxi.latitude, taxi.longitude], {
          radius: 9,
          fillColor: taxiColor,
          color: '#fff',
          weight: 2.5,
          opacity: 1,
          fillOpacity: 0.95
        }).addTo(map);
        
        marker.on('click', () => setSelectedTaxiId(taxi.id));
        marker.bindTooltip(`${taxi.id}`, { permanent: false, className: 'taxi-tooltip' });
        markersRef.current[taxi.id] = marker;
      }

      if (markersRef.current[taxi.id]) {
        if (isSelected) {
          markersRef.current[taxi.id].setStyle({ weight: 4.5, color: '#00ffcc', radius: 11 });
          map.panTo([taxi.latitude, taxi.longitude]);
        } else {
          markersRef.current[taxi.id].setStyle({ weight: 2.5, color: '#fff', radius: 9 });
        }
      }

      const destName = taxi.route.split(" -> ")[1];
      const destPort = airspace?.skyports.find((p: any) => p.name === destName);
      if (destPort && destPort.latitude && destPort.longitude) {
        const points: [number, number][] = [
          [taxi.latitude, taxi.longitude],
          [destPort.latitude, destPort.longitude]
        ];

        if (pathsRef.current[taxi.id]) {
          pathsRef.current[taxi.id].setLatLngs(points);
          pathsRef.current[taxi.id].setStyle({ color: taxiColor });
        } else {
          const polyline = L.polyline(points, {
            color: taxiColor,
            weight: isSelected ? 3.5 : 1.5,
            dashArray: '6, 6',
            opacity: isSelected ? 0.9 : 0.4
          }).addTo(map);
          pathsRef.current[taxi.id] = polyline;
        }

        if (pathsRef.current[taxi.id]) {
          pathsRef.current[taxi.id].setStyle({
            weight: isSelected ? 3.5 : 1.5,
            opacity: isSelected ? 0.9 : 0.4
          });
        }
      }
    });

    const activeIds = new Set(taxis.map((t: any) => t.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
        if (pathsRef.current[id]) {
          map.removeLayer(pathsRef.current[id]);
          delete pathsRef.current[id];
        }
      }
    });

  }, [taxis, airspace, selectedTaxiId]);

  return (
    <div ref={mapRef} className="w-full h-full relative" style={{ height: '100%', minHeight: '100%', background: '#020202' }}>
      <style>{`
        .leaflet-tooltip.skyport-tooltip {
          background: #020202;
          color: #fff;
          border: 1px solid #00ff78;
          font-family: monospace;
          font-size: 8px;
          font-weight: bold;
          padding: 2px 5px;
          opacity: 0.9;
        }
        .leaflet-tooltip.congested-tooltip {
          background: #110300;
          color: #ef4444;
          border: 1px solid #f97316;
          font-family: monospace;
          font-size: 8px;
          font-weight: bold;
          padding: 2px 5px;
        }
        .leaflet-tooltip.taxi-tooltip {
          background: #050505;
          color: #00f6ff;
          border: 1px solid #333;
          font-family: monospace;
          font-size: 9px;
          font-weight: bold;
          padding: 2px 4px;
        }
      `}</style>
    </div>
  );
}

export default function UrbanAirTaxiDashboard() {
  const [taxis, setTaxis] = useState<Taxi[]>([]);
  const [airspace, setAirspace] = useState<Airspace | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'MAP_2D' | 'RADAR' | '3D'>('MAP_2D');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [events, setEvents] = useState<any[]>([]);
  const [slowDown, setSlowDown] = useState(false);
  const [obstacles, setObstacles] = useState<any[]>([]);
  const [cameraTelemetry, setCameraTelemetry] = useState<Record<string, any>>({});

  // Advanced Interactive States
  const [selectedTaxiId, setSelectedTaxiId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [autofocusMode, setAutofocusMode] = useState<boolean>(true);
  const [trailBuffer, setTrailBuffer] = useState<Record<string, Array<[number, number]>>>({});

  // Replay & Playback Engine States
  const [playbackActive, setPlaybackActive] = useState<boolean>(false);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [playbackBuffer, setPlaybackBuffer] = useState<Array<Taxi[]>>([]);

  const logContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [events]);

  const [simulationRunning, setSimulationRunning] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/simulation/status");
        const data = await res.json();
        if (data && data.status) {
          setSimulationRunning(data.status === "active");
        }
      } catch (e) {}
    };
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const startSimulationEngine = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/simulation/start", { method: "POST" });
      const data = await res.json();
      if (data && (data.status === "success" || data.status === "active")) {
        setSimulationRunning(true);
      }
    } catch (e) {}
  };

  const stopSimulationEngine = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/simulation/stop", { method: "POST" });
      const data = await res.json();
      if (data && (data.status === "success" || data.status === "inactive")) {
        setSimulationRunning(false);
      }
    } catch (e) {}
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/settings");
        const data = await res.json();
        if (data && typeof data.slow_down === 'boolean') {
          setSlowDown(data.slow_down);
        }
      } catch (err) {
        console.error("ATC_SETTINGS_LOAD_FAILURE:", err);
      }
    };
    loadSettings();
  }, []);

  const toggleSpeedRestriction = async () => {
    const nextState = !slowDown;
    try {
      const res = await fetch("http://127.0.0.1:8000/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slow_down: nextState })
      });
      const data = await res.json();
      if (data && data.status === "success") {
        setSlowDown(nextState);
      }
    } catch (err) {
      console.error("ATC_SETTINGS_UPDATE_FAILURE:", err);
    }
  };

  const fetchData = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/taxis");
      const data = await response.json();
      if (!data.error) {
        // Build playback history buffer in background
        setPlaybackBuffer(prev => {
          const next = [...prev, data];
          return next.slice(-120); // Hold last 2 minutes (120 frames)
        });

        if (!playbackActive) {
          setTaxis(data);
          
          const avgAltitude = data.length > 0 ? data.reduce((acc: number, t: Taxi) => acc + t.altitude, 0) / data.length : 0;
          const avgRisk = data.length > 0 ? data.reduce((acc: number, t: Taxi) => acc + t.risk, 0) / data.length : 0;
          
          setHistory(prev => {
            const newEntry = { time: new Date().toLocaleTimeString(), avgAltitude, avgRisk };
            return [...prev, newEntry].slice(-25);
          });

          // Log historical trail coordinates
          setTrailBuffer(prev => {
            const next = { ...prev };
            data.forEach((taxi: Taxi) => {
              const tx = toX(taxi.longitude);
              const ty = toY(taxi.latitude);
              const trail = next[taxi.id] || [];
              const last = trail[trail.length - 1];
              if (!last || Math.abs(last[0] - tx) > 1 || Math.abs(last[1] - ty) > 1) {
                next[taxi.id] = [...trail, [tx, ty] as [number, number]].slice(-15);
              }
            });
            return next;
          });
        }
      }

      // Fetch dynamic weather & airspace metadata
      const airspaceRes = await fetch("http://127.0.0.1:8000/airspace");
      const airspaceData = await airspaceRes.json();
      if (!airspaceData.error) {
        setAirspace(airspaceData);
      }

      const eventsRes = await fetch("http://127.0.0.1:8000/events");
      const eventsData = await eventsRes.json();
      if (!eventsData.error) {
        setEvents(eventsData);
      }

      // Fetch dynamic unregistered obstacles
      try {
        const obsRes = await fetch("http://127.0.0.1:8000/obstacles");
        const obsData = await obsRes.json();
        if (Array.isArray(obsData)) {
          setObstacles(obsData);
        }
      } catch (e) {}

      // Fetch camera telemetry
      try {
        const camRes = await fetch("http://127.0.0.1:8000/camera_telemetry");
        const camData = await camRes.json();
        if (camData && !camData.error) {
          setCameraTelemetry(camData);
        }
      } catch (e) {}
    } catch (error) {
      console.error("ATC_LINK_FAILURE:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
      fetchData();
    }, 1000);
    return () => clearInterval(timer);
  }, [playbackActive]); // Restart sync trigger if playback toggles

  // Synchronize dynamic scrubbing index
  useEffect(() => {
    if (playbackActive && playbackBuffer[playbackIndex]) {
      setTaxis(playbackBuffer[playbackIndex]);
    }
  }, [playbackActive, playbackIndex, playbackBuffer]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Flying': return 'text-[#00ffcc] border-[#00ffcc]/30 bg-[#00ffcc]/5';
      case 'Landing': return 'text-blue-400 border-blue-400/30 bg-blue-400/5';
      case 'Emerging': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5';
      case 'Critical': return 'text-red-500 border-red-500/50 bg-red-500/10 animate-pulse';
      case 'Bypassing': return 'text-[#ffaa00] border-[#ffaa00]/30 bg-[#ffaa00]/5';
      case 'Detouring': return 'text-orange-500 border-orange-500/40 bg-orange-500/10 animate-pulse';
      default: return 'text-zinc-500 border-zinc-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#030306] text-zinc-300 p-2 md:p-6 font-sans selection:bg-[#00ffcc]/30 relative overflow-hidden">
      {/* High-tech ambient glowing grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%),linear-gradient(90deg,rgba(0,255,204,0.02),rgba(0,0,0,0),rgba(239,68,68,0.01))] bg-[size:100%_4px,3px_100%] pointer-events-none z-0" />
      <div className="absolute -top-[400px] -left-[400px] w-[800px] h-[800px] rounded-full bg-[#00ffcc]/3 blur-[180px] pointer-events-none z-0" />
      <div className="absolute -bottom-[400px] -right-[400px] w-[800px] h-[800px] rounded-full bg-[#ef4444]/2 blur-[180px] pointer-events-none z-0" />

      {/* ATC TOP BAR */}
      <div className="max-w-[1600px] mx-auto mb-6 flex flex-col lg:flex-row items-center justify-between gap-4 border-b border-zinc-800 pb-4 relative z-10 font-orbitron">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-[#00ffcc]/5 border border-[#00ffcc]/20 rounded-none shadow-[0_0_15px_rgba(0,255,204,0.05)]">
            <Terminal className="w-5 h-5 text-[#00ffcc] animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-[0.25em] text-white font-orbitron bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
              AERONET AI <span className="text-[#00ffcc]">//</span> UAM MONITORING
            </h1>
            <div className="flex items-center gap-3 text-[9px] font-bold text-zinc-500 mt-1.5 font-share-tech tracking-wider">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" /> TELEMETRY_ACTIVE</span>
              <span className="flex items-center gap-1.5 text-[#00ffcc]"><Wifi className="w-3 h-3 animate-pulse" /> SECURE_DATA_LINK</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 font-rajdhani text-sm">
          <button
            onClick={toggleSpeedRestriction}
            className={`px-4 py-1.5 text-[11px] font-black tracking-widest transition-all border flex items-center gap-2 rounded-none font-orbitron ${
              slowDown 
                ? 'bg-yellow-500 border-yellow-500 text-black hover:bg-yellow-600 shadow-[0_0_15px_rgba(234,179,8,0.2)] animate-pulse' 
                : 'border-zinc-850 text-zinc-400 hover:text-yellow-500 hover:border-yellow-500/30 bg-black/60 backdrop-blur-md'
            }`}
          >
            <Wind className={`w-3.5 h-3.5 ${slowDown ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            {slowDown ? 'LIFT SPEED RESTRICTION' : 'ISSUE SPEED RESTRICTION'}
          </button>

          <button
            onClick={simulationRunning ? stopSimulationEngine : startSimulationEngine}
            className={`px-4 py-1.5 text-[11px] font-black tracking-widest transition-all border flex items-center gap-2 rounded-none font-orbitron ${
              simulationRunning 
                ? 'bg-red-500 border-red-500 text-black hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.2)] font-black' 
                : 'bg-green-500 border-green-500 text-black hover:bg-green-600 shadow-[0_0_15px_rgba(34,197,94,0.25)] font-black'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${simulationRunning ? 'bg-black animate-ping' : 'bg-black'}`} />
            {simulationRunning ? 'STOP SIMULATION' : 'START SIMULATION'}
          </button>

          <div className="flex bg-black/60 backdrop-blur-md border border-zinc-800 p-0.5 rounded-none font-orbitron">
            {['MAP_2D', 'RADAR', '3D'].map((mode) => (
              <button 
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`px-4 py-1.5 text-[9px] font-black tracking-widest transition-all rounded-none ${
                  viewMode === mode 
                    ? 'bg-[#00ffcc] text-black shadow-[0_0_15px_rgba(0,255,204,0.2)] font-black' 
                    : 'text-zinc-600 hover:text-zinc-300'
                }`}
              >
                {mode === 'MAP_2D' ? 'OSM MAP' : mode === 'RADAR' ? '2D RADAR' : '3D AIRSPACE'}
              </button>
            ))}
          </div>
          <div className="text-right border-l border-zinc-850 pl-5 font-orbitron">
            <div className="text-zinc-600 text-[8px] uppercase tracking-widest font-black mb-1">SYSTEM CLOCK</div>
            <div className="text-lg font-bold text-white tracking-widest leading-none font-share-tech">{currentTime}</div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
        {/* CENTER - SPATIAL DATA */}
        <div className="lg:col-span-9 space-y-5">
          
          {/* PLAYBACK CONTROL HUB */}
          <div className="bg-[#06060c]/85 border border-[#00ffcc]/15 p-3 flex flex-col gap-2 rounded-none shadow-md backdrop-blur-md relative font-orbitron">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00ffcc]" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00ffcc]" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00ffcc]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00ffcc]" />
            <div className="flex flex-wrap items-center justify-between gap-4 font-rajdhani text-sm">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${playbackActive ? 'bg-orange-500 animate-pulse' : 'bg-green-500 animate-ping'}`} />
                <span className="text-[10px] font-orbitron font-black uppercase tracking-wider text-zinc-400">
                  {playbackActive ? `PLAYBACK ACTIVE // TIMELINE STEP: ${playbackIndex + 1} / ${playbackBuffer.length}` : 'LIVE REAL-TIME STREAMING'}
                </span>
              </div>

              <div className="flex items-center gap-3 font-orbitron">
                {/* Live / Pause Toggle */}
                <button 
                  onClick={() => {
                    if (playbackActive) {
                      setPlaybackActive(false);
                    } else {
                      if (playbackBuffer.length > 0) {
                        setPlaybackActive(true);
                        setPlaybackIndex(playbackBuffer.length - 1);
                      }
                    }
                  }}
                  className={`px-3 py-1 text-[9px] font-black tracking-widest border transition-all ${
                    playbackActive 
                      ? 'bg-orange-500 text-black border-orange-500 hover:bg-orange-600 shadow-[0_0_10px_rgba(249,115,22,0.15)]' 
                      : 'bg-black/60 text-[#00ffcc] border-[#00ffcc]/30 hover:border-[#00ffcc]/60 hover:text-white'
                  }`}
                >
                  {playbackActive ? 'GO LIVE STREAM' : 'PAUSE / REPLAY'}
                </button>

                {/* Step back */}
                <button
                  disabled={!playbackActive || playbackIndex === 0}
                  onClick={() => setPlaybackIndex(prev => Math.max(0, prev - 1))}
                  className="px-2.5 py-1 text-[8px] font-black bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  ◀ STEP BACK
                </button>

                {/* Step forward */}
                <button
                  disabled={!playbackActive || playbackIndex >= playbackBuffer.length - 1}
                  onClick={() => setPlaybackIndex(prev => Math.min(playbackBuffer.length - 1, prev + 1))}
                  className="px-2.5 py-1 text-[8px] font-black bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  STEP FWD ▶
                </button>

                {/* Autofocus Toggle */}
                <button
                  onClick={() => setAutofocusMode(prev => !prev)}
                  className={`px-3 py-1 text-[9px] font-black border transition-all ${
                    autofocusMode 
                      ? 'bg-[#00ffcc]/10 text-[#00ffcc] border-[#00ffcc]/40' 
                      : 'bg-black text-zinc-500 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {autofocusMode ? 'AUTOFOCUS: ON' : 'AUTOFOCUS: OFF'}
                </button>
              </div>
            </div>

            {/* Timeline Slider */}
            {playbackActive && playbackBuffer.length > 0 && (
              <div className="flex items-center gap-3 border-t border-zinc-900 pt-2 w-full font-share-tech">
                <span className="text-[8px] text-zinc-600">00:00</span>
                <input 
                  type="range"
                  min="0"
                  max={playbackBuffer.length - 1}
                  value={playbackIndex}
                  onChange={(e) => setPlaybackIndex(parseInt(e.target.value))}
                  className="flex-1 accent-[#00ffcc] h-1 bg-zinc-900 cursor-pointer rounded-none"
                />
                <span className="text-[8px] text-[#00ffcc]">T-{playbackBuffer.length - 1 - playbackIndex} SECS AGO</span>
              </div>
            )}
          </div>

          <div className="relative h-[500px] border border-zinc-800 bg-[#030305] overflow-hidden">
            {viewMode === '3D' ? (
              <Airspace3D taxis={taxis} airspace={airspace} selectedTaxiId={selectedTaxiId} />
            ) : viewMode === 'MAP_2D' ? (
              <LeafletMap taxis={taxis} airspace={airspace} selectedTaxiId={selectedTaxiId} setSelectedTaxiId={setSelectedTaxiId} />
            ) : (
              <div className="relative w-full h-full">
                {/* SVG High-Tech Radar Overlay with smooth viewBox slide transitions */}
                <svg 
                  viewBox={(() => {
                    if (autofocusMode && selectedTaxiId) {
                      const act = taxis.find(t => t.id === selectedTaxiId);
                      if (act) {
                        const tx = toX(act.longitude);
                        const ty = toY(act.latitude);
                        const zoomW = 380;
                        const zoomH = 290;
                        // Clamp center viewport safely inside maps grid bounds
                        const vx = Math.max(0, Math.min(1100 - zoomW, tx - zoomW / 2));
                        const vy = Math.max(0, Math.min(900 - zoomH, ty - zoomH / 2));
                        return `${vx} ${vy} ${zoomW} ${zoomH}`;
                      }
                    }
                    return "0 0 1100 900";
                  })()} 
                  className="w-full h-full select-none transition-all duration-700 ease-in-out"
                  style={{ transitionProperty: 'viewBox' }}
                >
                  {/* Radar Circles */}
                  <circle cx="550" cy="450" r="400" fill="none" stroke="#141420" strokeWidth="1" />
                  <circle cx="550" cy="450" r="250" fill="none" stroke="#141420" strokeWidth="1" strokeDasharray="5,5" />
                  <circle cx="550" cy="450" r="100" fill="none" stroke="#141420" strokeWidth="1" />
                  
                  {/* Grid Lines */}
                  <line x1="550" y1="0" x2="550" y2="900" stroke="#141420" strokeWidth="1.5" strokeDasharray="3,3" />
                  <line x1="0" y1="450" x2="1100" y2="450" stroke="#141420" strokeWidth="1.5" strokeDasharray="3,3" />

                  {/* Sectors */}
                  <text x="30" y="50" fill="#00ffcc" fontSize="11" fontWeight="bold" opacity="0.35" letterSpacing="2px">SECTOR A // N_WEST</text>
                  <text x="580" y="50" fill="#00ffcc" fontSize="11" fontWeight="bold" opacity="0.35" letterSpacing="2px">SECTOR B // N_EAST</text>
                  <text x="30" y="480" fill="#00ffcc" fontSize="11" fontWeight="bold" opacity="0.35" letterSpacing="2px">SECTOR C // S_WEST</text>
                  <text x="580" y="480" fill="#00ffcc" fontSize="11" fontWeight="bold" opacity="0.35" letterSpacing="2px">SECTOR D // S_EAST</text>

                  {/* Buildings */}
                  {airspace?.buildings.map((b, idx) => (
                    <g key={`b-${idx}`}>
                      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#0d0d15" stroke="#3b2b52" strokeWidth="1.5" opacity="0.85" />
                      <line x1={b.x} y1={b.y} x2={b.x + b.w} y2={b.y} stroke="#b400ff" strokeWidth="3" />
                      <text x={b.x + b.w/2} y={b.y + b.h/2 + 4} fill="#8b8ba0" fontSize="8" textAnchor="middle" opacity="0.8">TOWER</text>
                    </g>
                  ))}

                  {/* No-Fly Zones */}
                  {airspace?.no_fly_zones.map((nfz, idx) => (
                    <g key={`nfz-${idx}`}>
                      <circle cx={nfz.x} cy={nfz.y} r={nfz.radius} fill="rgba(239, 68, 68, 0.05)" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2" opacity="0.75" />
                      <circle cx={nfz.x} cy={nfz.y} r={nfz.radius + 15} fill="none" stroke="#ef4444" strokeWidth="0.5" opacity="0.25" />
                      <circle cx={nfz.x} cy={nfz.y} r="5" fill="#ef4444" opacity="0.6" />
                      <text x={nfz.x} y={nfz.y + 4} fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.75" letterSpacing="1px">NO-FLY ZONE</text>
                    </g>
                  ))}

                  {/* Weather Cells */}
                  {airspace?.weather_cells.map((w, idx) => (
                    <g key={`w-${idx}`}>
                      <circle cx={w.x} cy={w.y} r={w.radius} fill="rgba(14, 165, 233, 0.07)" stroke="#0ea5e9" strokeWidth="1.5" opacity="0.8" />
                      <circle cx={w.x} cy={w.y} r={w.radius * 0.7} fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="10,5" opacity="0.3" />
                      <circle cx={w.x} cy={w.y} r={w.radius * 0.4} fill="none" stroke="#0ea5e9" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.2" />
                      <text x={w.x} y={w.y + 4} fill="#0ea5e9" fontSize="8" fontWeight="black" textAnchor="middle" opacity="0.75" letterSpacing="1px">STORM_CELL</text>
                    </g>
                  ))}

                  {/* Congested Zones (High-Traffic Bottlenecks) */}
                  {airspace?.congested_zones?.map((cz, idx) => (
                    <g key={`cz-${idx}`}>
                      {/* Deep warning zone */}
                      <circle cx={cz.x} cy={cz.y} r={cz.radius} fill="rgba(239, 68, 68, 0.08)" stroke="#ef4444" strokeWidth="2" opacity="0.9" />
                      
                      {/* Secondary pulsing safety border */}
                      <circle cx={cz.x} cy={cz.y} r={cz.radius + 15} fill="none" stroke="#ef4444" strokeWidth="0.75" strokeDasharray="5,5" className="animate-pulse" opacity="0.4" />
                      
                      <circle cx={cz.x} cy={cz.y} r="5" fill="#ef4444" className="animate-ping" />
                      
                      {/* Banner Indicator Text */}
                      <text x={cz.x} y={cz.y - 12} fill="#ef4444" fontSize="8" fontWeight="black" textAnchor="middle" opacity="0.9" letterSpacing="1.5px">CONGESTED ZONE</text>
                      
                      {/* Traffic Density Indicator */}
                      <text x={cz.x} y={cz.y + 6} fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.95">DENSITY: {cz.density}</text>
                    </g>
                  ))}

                  {/* Dynamic Unregistered Camera obstacles */}
                  {obstacles?.map((obs) => {
                    const radius = obs.size ? obs.size + 6 : 8;
                    return (
                      <g key={obs.id}>
                        <circle 
                          cx={obs.x} 
                          cy={obs.y} 
                          r={radius} 
                          fill="rgba(239, 68, 68, 0.1)" 
                          stroke="#ef4444" 
                          strokeWidth="1.5" 
                          className="animate-pulse" 
                        />
                        <circle cx={obs.x} cy={obs.y} r="2" fill="#ef4444" />
                        <rect 
                          x={obs.x - radius - 2} 
                          y={obs.y - radius - 2} 
                          width={radius * 2 + 4} 
                          height={radius * 2 + 4} 
                          fill="none" 
                          stroke="#f97316" 
                          strokeWidth="0.5" 
                          strokeDasharray="2,2" 
                        />
                        <text 
                          x={obs.x + radius + 6} 
                          y={obs.y + 3} 
                          fill="#ef4444" 
                          fontSize="7" 
                          fontWeight="black" 
                          letterSpacing="0.5px"
                        >
                          {obs.id} : {obs.type.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}

                  {/* Active UAM Optical Target Acquisition Lines & Reticles */}
                  {taxis.map((taxi) => {
                    const det = cameraTelemetry[taxi.id];
                    if (!det) return null;
                    const tx = toX(taxi.longitude);
                    const ty = toY(taxi.latitude);
                    
                    return (
                      <g key={`det-line-${taxi.id}`}>
                        <line 
                          x1={tx} 
                          y1={ty} 
                          x2={det.x} 
                          y2={det.y} 
                          stroke="#ef4444" 
                          strokeWidth="1.2" 
                          strokeDasharray="3,1" 
                          className="animate-pulse" 
                        />
                        <g transform={`translate(${det.x}, ${det.y})`}>
                          <path d="M -12 -6 L -12 -12 L -6 -12" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                          <path d="M 6 -12 L 12 -12 L 12 -6" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                          <path d="M 12 6 L 12 12 L 6 12" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                          <path d="M -6 12 L -12 12 L -12 6" fill="none" stroke="#ef4444" strokeWidth="1.5" />
                          
                          <rect x="-42" y="-23" width="84" height="10" fill="rgba(2, 2, 2, 0.9)" stroke="#ef4444" strokeWidth="0.5" />
                          <text x="0" y="-15" fill="#ef4444" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                            [AI:{det.predicted_class.toUpperCase()} {det.confidence}%]
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* Skyports with Hyderabad place labels */}
                  {airspace?.skyports.map((p, idx) => (
                    <g key={`p-${idx}`}>
                      <circle cx={p.x} cy={p.y} r="6" fill="#00ffcc" />
                      <circle cx={p.x} cy={p.y} r="12" fill="none" stroke="#00ffcc" strokeWidth="1" opacity="0.4" className="animate-pulse" />
                      <text x={p.x + 10} y={p.y + 16} fill="#fff" fontSize="9" fontWeight="bold" opacity="0.9" filter="drop-shadow(0px 2px 2px #000)" textAnchor="middle">{p.name}</text>
                    </g>
                  ))}

                  {/* Historical Breadcrumb Trails */}
                  {taxis.map(taxi => {
                    const trail = trailBuffer[taxi.id] || [];
                    if (trail.length < 2) return null;
                    const isSelected = selectedTaxiId === taxi.id;
                    const color = getAltitudeColor(taxi.altitude);
                    const pointsStr = trail.map(pt => `${pt[0]},${pt[1]}`).join(" ");
                    return (
                      <polyline
                        key={`trail-${taxi.id}`}
                        points={pointsStr}
                        fill="none"
                        stroke={color}
                        strokeWidth={isSelected ? "2.5" : "1.2"}
                        strokeDasharray="4,2"
                        opacity={isSelected ? "0.85" : "0.35"}
                      />
                    );
                  })}

                  {/* Taxi Nodes */}
                  {taxis.map((taxi) => {
                    const x = toX(taxi.longitude);
                    const y = toY(taxi.latitude);
                    const color = getAltitudeColor(taxi.altitude);
                    const isCritical = taxi.status === 'Critical';
                    const isBypassing = taxi.status === 'Bypassing';
                    const isDetouring = taxi.status === 'Detouring';
                    const isSelected = selectedTaxiId === taxi.id;

                    // Sector/Search Filters mapping checks
                    if (sectorFilter === 'NORTH' && y >= 450) return null;
                    if (sectorFilter === 'SOUTH' && y < 450) return null;
                    if (sectorFilter === 'EAST' && x < 550) return null;
                    if (sectorFilter === 'WEST' && x >= 550) return null;
                    if (searchQuery && !taxi.id.toLowerCase().includes(searchQuery.toLowerCase())) return null;

                    // Compute dynamic detour waypoint inside frontend
                    let wpx = 0, wpy = 0, tx = 0, ty = 0;
                    let hasDetourLine = false;
                    if (isDetouring) {
                      const cz = airspace?.congested_zones?.find(z => {
                        const dist = Math.sqrt(Math.pow(x - z.x, 2) + Math.pow(y - z.y, 2));
                        return dist < 130;
                      });
                      if (cz) {
                        const dx = x - cz.x;
                        const dy = y - cz.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist > 0) {
                          const ux = -dy / dist;
                          const uy = dx / dist;
                          const wp1_x = cz.x + ux * (cz.radius + 35);
                          const wp1_y = cz.y + uy * (cz.radius + 35);
                          const wp2_x = cz.x - ux * (cz.radius + 35);
                          const wp2_y = cz.y - uy * (cz.radius + 35);
                          const destName = taxi.route.split(" -> ")[1];
                          const destPort = airspace?.skyports.find(p => p.name === destName);
                          tx = destPort ? destPort.x : x;
                          ty = destPort ? destPort.y : y;
                          const d1 = Math.sqrt(Math.pow(wp1_x - tx, 2) + Math.pow(wp1_y - ty, 2));
                          const d2 = Math.sqrt(Math.pow(wp2_x - tx, 2) + Math.pow(wp2_y - ty, 2));
                          wpx = d1 < d2 ? wp1_x : wp2_x;
                          wpy = d1 < d2 ? wp1_y : wp2_y;
                          hasDetourLine = true;
                        }
                      }
                    } else {
                      // Fallback straight vector
                      const destName = taxi.route.split(" -> ")[1];
                      const destPort = airspace?.skyports.find(p => p.name === destName);
                      tx = destPort ? destPort.x : x;
                      ty = destPort ? destPort.y : y;
                    }

                    // Compute current heading vector angle to rotate quadcopter SVGs
                    const headingDx = tx - x;
                    const headingDy = ty - y;
                    const headingDeg = Math.round((Math.atan2(headingDy, headingDx) * 180 / Math.PI) + 90);
                    const activeColor = isCritical ? '#ef4444' : isDetouring ? '#f97316' : isBypassing ? '#ffaa00' : color;

                    return (
                      <g key={taxi.id}>
                        {/* Live dynamic detour waypoints */}
                        {hasDetourLine && (
                          <g>
                            <line x1={x} y1={y} x2={wpx} y2={wpy} stroke="#f97316" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />
                            <line x1={wpx} y1={wpy} x2={tx} y2={ty} stroke="rgba(249, 115, 22, 0.4)" strokeWidth="1" strokeDasharray="2,2" />
                            <circle cx={wpx} cy={wpy} r="4" fill="#f97316" stroke="#fff" strokeWidth="0.5" />
                            <text x={wpx + 8} y={wpy + 3} fill="#f97316" fontSize="7" fontWeight="black">WP_DETOUR</text>
                          </g>
                        )}

                        {/* Standard route lines mapping */}
                        <line x1={x} y1={y} x2={tx} y2={ty} stroke={activeColor} strokeWidth="0.8" strokeDasharray="3,3" opacity={isSelected ? "0.8" : "0.2"} />

                        {/* Safe Separation bubble */}
                        <circle cx={x} cy={y} r="45" fill="none" stroke={activeColor} strokeWidth="1" strokeDasharray="3,3" opacity={isCritical || isDetouring || isBypassing ? "0.6" : "0.3"} />
                        
                        {/* Pulse glow surrounding ring */}
                        <circle cx={x} cy={y} r="15" fill="none" stroke={activeColor} strokeWidth="0.5" opacity="0.2" />

                        {/* Dynamic Double Target Surveillance Reticle brackets (Flashing for selected target) */}
                        {isSelected && (
                          <g className="animate-pulse">
                            <circle cx={x} cy={y} r="20" fill="none" stroke="#00ffcc" strokeWidth="1" strokeDasharray="4,2" />
                            <circle cx={x} cy={y} r="25" fill="none" stroke="#00ffcc" strokeWidth="0.5" opacity="0.4" />
                            <path d={`M ${x-28} ${y} L ${x-20} ${y}`} stroke="#00ffcc" strokeWidth="1.5" />
                            <path d={`M ${x+20} ${y} L ${x+28} ${y}`} stroke="#00ffcc" strokeWidth="1.5" />
                            <path d={`M ${x} ${y-28} L ${x} ${y-20}`} stroke="#00ffcc" strokeWidth="1.5" />
                            <path d={`M ${x} ${y+20} L ${x} ${y+28}`} stroke="#00ffcc" strokeWidth="1.5" />
                          </g>
                        )}

                        {/* Futuristic Rotating SVG Quadcopter UAM Icon */}
                        <g 
                          transform={`translate(${x}, ${y}) rotate(${headingDeg})`} 
                          style={{ cursor: 'pointer' }} 
                          onClick={() => setSelectedTaxiId(taxi.id)}
                        >
                          {/* Projecting Camera Scanning Cone (projecting forward) */}
                          {(() => {
                            const isDetecting = !!cameraTelemetry[taxi.id];
                            const coneFill = isDetecting ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 255, 204, 0.035)';
                            const coneStroke = isDetecting ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 255, 204, 0.12)';
                            return (
                              <g>
                                <path 
                                  d="M 0 0 L -80 -138.56 A 160 160 0 0 1 80 -138.56 Z" 
                                  fill={coneFill} 
                                  stroke={coneStroke} 
                                  strokeWidth="1"
                                  strokeDasharray={isDetecting ? "none" : "3,3"}
                                />
                                {isDetecting && (
                                  <line x1="0" y1="0" x2="0" y2="-160" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="2,2" className="animate-pulse" />
                                )}
                              </g>
                            );
                          })()}

                          {/* Rotor cross arm guards */}
                          <line x1="-10" y1="-10" x2="10" y2="10" stroke={activeColor} strokeWidth="1.5" />
                          <line x1="-10" y1="10" x2="10" y2="-10" stroke={activeColor} strokeWidth="1.5" />
                          
                          {/* Guards */}
                          <circle cx="-10" cy="-10" r="3.5" fill="none" stroke={activeColor} strokeWidth="0.5" opacity="0.5" />
                          <circle cx="10" cy="-10" r="3.5" fill="none" stroke={activeColor} strokeWidth="0.5" opacity="0.5" />
                          <circle cx="-10" cy="10" r="3.5" fill="none" stroke={activeColor} strokeWidth="0.5" opacity="0.5" />
                          <circle cx="10" cy="10" r="3.5" fill="none" stroke={activeColor} strokeWidth="0.5" opacity="0.5" />
                          
                          {/* Spin rotors */}
                          <circle cx="-10" cy="-10" r="1.5" fill="#fff" />
                          <circle cx="10" cy="-10" r="1.5" fill="#fff" />
                          <circle cx="-10" cy="10" r="1.5" fill="#fff" />
                          <circle cx="10" cy="10" r="1.5" fill="#fff" />

                          {/* Aerodynamic Carbon hull */}
                          <polygon points="-4,6 4,6 6,-4 0,-9 -6,-4" fill="#030305" stroke={activeColor} strokeWidth="1.2" />
                          <circle cx="0" cy="-1" r="2.5" fill={isSelected ? '#00ffcc' : activeColor} className="animate-pulse" />
                        </g>
                        
                        {/* Telemetry Labels Overlay */}
                        <rect x={x + 12} y={y - 32} width="95" height="36" fill="rgba(2, 2, 3, 0.88)" stroke={isSelected ? '#00ffcc' : "rgba(255,255,255,0.08)"} strokeWidth="0.5" />
                        <text x={x + 16} y={y - 22} fill="#fff" fontSize="9" fontWeight="bold">{taxi.id} // {Math.round(taxi.battery)}%</text>
                        <text x={x + 16} y={y - 12} fill={color} fontSize="8" fontWeight="bold">ALT: {Math.round(taxi.altitude)}M</text>
                        <text x={x + 16} y={y - 4} fill={isCritical ? '#ff4444' : isDetouring ? '#f97316' : isBypassing ? '#ffaa00' : '#888'} fontSize="7" fontWeight="bold" letterSpacing="0.5px">SYS_{taxi.status.toUpperCase()}</text>
                      </g>
                    );
                  })}
                </svg>

                {taxis.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                    <AlertTriangle className="w-8 h-8 text-yellow-500 mb-2 animate-pulse" />
                    <div className="text-[10px] font-black tracking-[0.4em] text-yellow-500">NO_DATA_LINK_DETECTED</div>
                    <div className="text-[8px] text-zinc-500 mt-1 uppercase">Run Simulation Engine (main.py) to sync data</div>
                  </div>
                )}
              </div>
            )}
                     {/* HUD Overlays */}
            <div className="absolute top-4 right-4 space-y-2 pointer-events-none font-orbitron">
              <div className="bg-black/80 backdrop-blur-md border border-[#00ffcc]/30 px-3 py-1.5 flex items-center gap-3">
                <Heartbeat className="w-4 h-4 text-orange-500 animate-pulse" />
                <div className="text-[9px] font-bold">
                  <div className="text-zinc-500 uppercase tracking-widest">SYNC RATE</div>
                  <div className="text-white font-share-tech">60 FPS // LIVE</div>
                </div>
              </div>
            </div>
          </div>

          <Analytics history={history} />

          {/* SYSTEM LOGS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-share-tech">
            <div className="bg-[#06060c]/85 border border-[#ffd700]/15 p-4 rounded-none backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#ffd700]" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#ffd700]" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#ffd700]" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#ffd700]" />
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[#ffd700]" />
                <span className="text-[10px] font-orbitron font-black uppercase text-zinc-400">Environment_Status</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">WIND_SPEED</span><span className="text-white font-bold">{airspace?.weather?.wind_speed ? `${airspace.weather.wind_speed.toFixed(1)} km/h` : "12.5 km/h"}</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">TEMPERATURE</span><span className="text-white font-bold">{airspace?.weather?.temperature ? `${airspace.weather.temperature.toFixed(1)}°C` : "25.0°C"}</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">CONDITION</span><span className="text-sky-400 font-black uppercase tracking-wider">{airspace?.weather?.weather_condition || "CLEAR"}</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">VISIBILITY</span><span className="text-white font-bold">{airspace?.weather?.visibility ? `${(airspace.weather.visibility / 1000).toFixed(1)} km` : "10.0 km"}</span></div>
              </div>
            </div>
            
            <div className="md:col-span-2 bg-[#06060c]/85 border border-[#00ffcc]/15 p-4 rounded-none backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00ffcc]" />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00ffcc]" />
              <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00ffcc]" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00ffcc]" />
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-[#00ffcc]" />
                <span className="text-[10px] font-orbitron font-black uppercase text-zinc-400">AI_Decision_Log</span>
              </div>
              <div ref={logContainerRef} className="text-[10px] font-mono space-y-2 h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                {events.map((event, idx) => {
                  let colorClass = "text-zinc-400";
                  if (event.event_type === "COLLISION") {
                    colorClass = "text-red-400 font-bold animate-pulse";
                  } else if (event.event_type === "BUILDING") {
                    colorClass = "text-purple-400 font-bold";
                  } else if (event.event_type === "WEATHER") {
                    colorClass = "text-sky-450 font-bold";
                  } else if (event.event_type === "AIRSPACE") {
                    colorClass = "text-yellow-400 font-bold";
                  } else if (event.event_type === "ROUTE") {
                    colorClass = "text-[#00ffcc] font-semibold";
                  }
                  
                  return (
                    <div key={idx} className={`${colorClass} flex items-start gap-1.5`}>
                      <span className="text-zinc-650 font-bold">[{event.timestamp}]</span>
                      <span className="font-semibold bg-zinc-900/60 px-1 py-0.5 rounded-none text-[8px] tracking-widest uppercase border border-zinc-850 text-zinc-500">{event.event_type}</span>
                      <span className="font-share-tech">{event.message}</span>
                    </div>
                  );
                })}
                {events.length === 0 && (
                  <div className="text-zinc-650 text-[10px] italic">No active decisions logged. Syncing with flight simulation...</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR - SURVEILLANCE & FLEET DECKS */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* LIVE CAMERA FEED MONITOR PANEL */}
          <AirTaxiCameraFeed 
            taxiId={selectedTaxiId} 
            cameraTelemetry={cameraTelemetry} 
          />

          {/* UAM INFORMATION PANEL (VISIBLE ON SELECTION) */}
          <AnimatePresence mode="wait">
            {selectedTaxiId && (() => {
              const activeTaxi = taxis.find(t => t.id === selectedTaxiId);
              if (!activeTaxi) return null;
              
              const isSelectedCritical = activeTaxi.status === 'Critical';
              const isSelectedBypassing = activeTaxi.status === 'Bypassing';
              const isSelectedDetouring = activeTaxi.status === 'Detouring';
              const activeColor = isSelectedCritical ? '#ef4444' : isSelectedDetouring ? '#f97316' : isSelectedBypassing ? '#ffaa00' : '#00ffcc';
              
              // Calculate Cardinal Direction of movement based on route name or coordinates
              const routeParts = activeTaxi.route.split(" -> ");
              const pickupName = routeParts[0];
              const dropName = routeParts[1];
              
              // Estimate ETA
              const destPort = airspace?.skyports.find(p => p.name === dropName);
              let etaString = "ARRIVED";
              if (destPort) {
                const cx = toX(activeTaxi.longitude);
                const cy = toY(activeTaxi.latitude);
                const dist = Math.sqrt(Math.pow(destPort.x - cx, 2) + Math.pow(destPort.y - cy, 2));
                const etaSeconds = (dist / Math.max(0.5, activeTaxi.speed * 12));
                if (etaSeconds > 1) {
                  const mins = Math.floor(etaSeconds / 60);
                  const secs = Math.floor(etaSeconds % 60);
                  etaString = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                }
              }
              
              // Detect abnormal behavior
              const isAbnormal = activeTaxi.battery < 30 || activeTaxi.risk > 70 || activeTaxi.speed < 0.2;
              let abnormalMessage = "";
              if (activeTaxi.battery < 30) abnormalMessage = "LOW FUEL CRITICAL DIVERSION ENGAGED";
              else if (activeTaxi.risk > 70) abnormalMessage = "HIGH COLLISION PROXIMITY VECTOR ENCOUNTERED";
              else if (activeTaxi.speed < 0.2) abnormalMessage = "ABNORMAL FLIGHT HOVER DRIFT DETECTED";

              return (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-[#080812]/95 border border-[#00ffcc]/30 p-4 relative shadow-[0_0_20px_rgba(0,255,204,0.08)] rounded-none backdrop-blur-md font-share-tech"
                >
                  <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#00ffcc]" />
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#00ffcc]" />
                  <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-[#00ffcc]" />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-[#00ffcc]" />

                  {/* Glowing header target reticle */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 font-orbitron">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ffcc] animate-ping" />
                    <button 
                      onClick={() => setSelectedTaxiId(null)}
                      className="text-[8px] font-black uppercase text-[#00ffcc] hover:text-red-400 border border-[#00ffcc]/20 hover:border-red-400/30 px-2 py-0.5"
                    >
                      DISCONNECT
                    </button>
                  </div>

                  <h3 className="text-[10px] font-orbitron font-black uppercase tracking-[0.2em] mb-4 text-[#00ffcc] flex items-center gap-2">
                    <Crosshair className="w-3.5 h-3.5 animate-spin text-[#00ffcc]" style={{ animationDuration: '4s' }} />
                    SURVEILLANCE_LINK
                  </h3>

                  {/* Abnormal Alert Indicator */}
                  {isAbnormal && (
                    <div className="bg-red-950/40 border border-red-500/50 p-2.5 mb-3 text-red-400 text-[8px] font-bold tracking-wider animate-pulse flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <div>
                        <div className="font-black uppercase text-red-500 font-orbitron">ABNORMAL FLIGHT STATUS</div>
                        <div className="text-zinc-400 mt-0.5 text-[7px] leading-tight font-share-tech">{abnormalMessage}</div>
                      </div>
                    </div>
                  )}

                  {/* Visual telemetry dials */}
                  <div className="border border-zinc-900 p-3 mb-4 space-y-3 bg-[#020204]/80">
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-900 font-orbitron">
                      <span className="text-[12px] font-black text-white">{activeTaxi.id}</span>
                      <span className="text-[8px] text-zinc-500">FLIGHT_DECK_{activeTaxi.altitude}M</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[9px] font-share-tech">
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Altitude</span>
                        <span className="text-[11px] font-bold text-white tracking-wider font-orbitron">{Math.round(activeTaxi.altitude)}M</span>
                      </div>
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Speed</span>
                        <span className="text-[11px] font-bold text-white tracking-wider font-orbitron">{Math.round(activeTaxi.speed * 100)} KMH</span>
                      </div>
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Latitude</span>
                        <span className="text-zinc-450 font-mono">{activeTaxi.latitude.toFixed(5)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Longitude</span>
                        <span className="text-zinc-450 font-mono">{activeTaxi.longitude.toFixed(5)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Place Name</span>
                        <span className="text-zinc-300 font-semibold block text-[8px] truncate">{activeTaxi.place_name || "Resolving Location..."}</span>
                      </div>
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Nearest Skyport</span>
                        <span className="text-zinc-300 font-semibold block text-[8px] truncate">{activeTaxi.nearest_skyport || "Resolving..."}</span>
                      </div>
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Flight Status</span>
                        <span className="text-[#00ffcc] font-black block font-orbitron text-[8.5px]">{activeTaxi.status.toUpperCase()}</span>
                      </div>
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Weather</span>
                        <span className="text-sky-400 font-semibold block truncate">{activeTaxi.weather_condition || "Clear"}</span>
                      </div>
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Wind Speed</span>
                        <span className="text-zinc-300 font-semibold block">{activeTaxi.wind_speed ? `${activeTaxi.wind_speed.toFixed(1)} km/h` : "12.5 km/h"}</span>
                      </div>
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Depart From</span>
                        <span className="text-zinc-300 font-semibold block truncate">{pickupName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Destination</span>
                        <span className="text-zinc-300 font-semibold block truncate">{dropName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-655 block uppercase text-[7px] font-orbitron font-bold">Corridor Deck</span>
                        <span className="text-zinc-300 font-semibold block text-[8px] truncate">{activeTaxi.altitude >= 600 ? "HIGHWAY_DECK_WEST" : "FLIGHT_LANE_EAST"}</span>
                      </div>
                      <div className="col-span-2 mt-1 pt-1.5 border-t border-zinc-900 flex justify-between items-center">
                        <span className="text-zinc-655 uppercase text-[7px] font-orbitron font-bold">ETA (Skyport)</span>
                        <span className="text-[#00ffcc] font-bold font-orbitron text-[10px]">{etaString}</span>
                      </div>
                    </div>
                  </div>

                  {/* Onboard Camera Telemetry */}
                  {(() => {
                    const cam = cameraTelemetry[activeTaxi.id];
                    if (!cam) return null;
                    return (
                      <div className="border border-red-950/40 bg-red-950/5 p-2.5 mb-3 text-[9px] font-mono shadow-inner relative">
                        <div className="text-red-400 font-black tracking-wider uppercase mb-1.5 flex items-center gap-1.5 animate-pulse font-orbitron text-[8px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Onboard Optical Target Lock
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-zinc-400 text-[8px] font-share-tech">
                          <div>
                            <span className="text-zinc-600 block uppercase">Target ID</span>
                            <span className="text-white font-bold">{cam.obstacle_id}</span>
                          </div>
                          <div>
                            <span className="text-zinc-600 block uppercase">Classification</span>
                            <span className="text-red-400 font-bold">{cam.predicted_class}</span>
                          </div>
                          <div>
                            <span className="text-zinc-600 block uppercase">Distance</span>
                            <span className="text-white font-bold">{cam.distance}m</span>
                          </div>
                          <div>
                            <span className="text-zinc-600 block uppercase">Confidence</span>
                            <span className="text-red-400 font-bold">{cam.confidence}%</span>
                          </div>
                          <div className="col-span-2 mt-1 pt-1 border-t border-red-950/20 text-[7px] leading-tight text-zinc-500 uppercase font-semibold">
                            {cam.description.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-2 text-[9px] mb-2 font-orbitron">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 uppercase text-[8px]">AI Collision Index</span>
                      <span className={`font-bold ${activeTaxi.risk > 70 ? 'text-red-500 animate-pulse' : 'text-[#00ffcc]'}`}>{activeTaxi.risk}%</span>
                    </div>
                    <div className="h-1 bg-zinc-950 overflow-hidden border border-zinc-900">
                      <div className="h-full transition-all duration-500" style={{ width: `${activeTaxi.risk}%`, backgroundColor: activeColor }} />
                    </div>
                  </div>

                  <div className="space-y-2 text-[9px] font-orbitron">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 uppercase text-[8px]">Battery Telemetry</span>
                      <span className={`font-bold ${activeTaxi.battery < 30 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>{Math.round(activeTaxi.battery)}%</span>
                    </div>
                    <div className="h-1 bg-zinc-950 overflow-hidden border border-zinc-900">
                      <div className={`h-full transition-all duration-500 ${activeTaxi.battery < 30 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${activeTaxi.battery}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-900 grid grid-cols-2 gap-2 text-[8px] font-black uppercase text-zinc-500 font-orbitron">
                    <div>
                      STATUS: <span style={{ color: activeColor }}>{activeTaxi.status}</span>
                    </div>
                    <div>
                      COLLISION: <span className={isSelectedCritical ? 'text-red-500 animate-pulse font-extrabold' : 'text-green-500'}>{isSelectedCritical ? 'CONFLICT' : 'SECURE'}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* FLEET TRACKING & FILTERS SECTION */}
          <div className="border border-zinc-800 bg-[#06060c]/85 p-4 space-y-4 rounded-none backdrop-blur-md relative overflow-hidden font-share-tech">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-700" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-zinc-700" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-zinc-700" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-700" />
            
            {/* Search Input Widget */}
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron font-black text-zinc-400 uppercase tracking-widest block flex items-center gap-1">
                <Search className="w-3 h-3 text-[#00ffcc]" /> Search Fleet By ID
              </label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="ENTER TAXI ID (E.G. TX2)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  className="w-full bg-[#030306] border border-zinc-850 p-2 text-xs font-mono text-white placeholder-zinc-700 rounded-none focus:outline-none focus:border-[#00ffcc]/50"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-[9px] text-zinc-500 hover:text-white"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Selector (Direct selection target) */}
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron font-black text-zinc-400 uppercase tracking-widest block">Direct Target Select</label>
              <select 
                value={selectedTaxiId || ''} 
                onChange={(e) => setSelectedTaxiId(e.target.value || null)}
                className="w-full bg-[#030306] border border-zinc-850 p-2 text-xs font-mono text-white rounded-none focus:outline-none focus:border-[#00ffcc]/50"
              >
                <option value="">-- SELECT TAXI TARGET --</option>
                {taxis.map(t => (
                  <option key={t.id} value={t.id}>{t.id} [{t.status}]</option>
                ))}
              </select>
            </div>

            {/* Sector Filtering Widgets */}
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron font-black text-zinc-400 uppercase tracking-widest block">Sector-Wise Quadrants</label>
              <div className="grid grid-cols-5 gap-1 bg-black/60 border border-zinc-850 p-0.5 font-orbitron">
                {['ALL', 'NORTH', 'SOUTH', 'EAST', 'WEST'].map(sect => (
                  <button
                    key={sect}
                    onClick={() => setSectorFilter(sect)}
                    className={`py-1 text-[8px] font-black tracking-tighter text-center transition-all ${
                      sectorFilter === sect 
                        ? 'bg-[#00ffcc] text-black font-extrabold' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                    }`}
                  >
                    {sect}
                  </button>
                ))}
              </div>
            </div>

            {/* Busiest Skyports & Analytical density indices */}
            <div className="border-t border-zinc-900 pt-3 space-y-1.5 text-[8.5px]">
              <div className="text-[9px] font-orbitron font-black uppercase text-zinc-400 mb-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#00ffcc]" /> ANALYTICAL_MATRIX
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>ACTIVE_CONGESTED_ZONES</span>
                <span className="text-red-500 font-bold font-mono">{airspace?.congested_zones?.length || 0} SECTORS</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>AVERAGE_FLEET_ALTITUDE</span>
                <span className="text-white font-mono">{taxis.length > 0 ? Math.round(taxis.reduce((acc, t) => acc + t.altitude, 0) / taxis.length) : 0}M</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>SEPARATION_VIOLATIONS</span>
                <span className="text-green-405 font-mono font-bold">0 ACTIVE</span>
              </div>
            </div>

            {/* Dynamic Fleet List Scrollable */}
            <div className="border-t border-zinc-900 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-orbitron font-black uppercase text-[#00ffcc] tracking-wider">Surveillance Feed ({taxis.filter(t => {
                  const x = toX(t.longitude);
                  const y = toY(t.latitude);
                  if (sectorFilter === 'NORTH') return y < 450;
                  if (sectorFilter === 'SOUTH') return y >= 450;
                  if (sectorFilter === 'EAST') return x >= 550;
                  if (sectorFilter === 'WEST') return x < 550;
                  return true;
                }).length} units)</span>
              </div>

              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                {taxis
                  .filter(t => {
                    const x = toX(t.longitude);
                    const y = toY(t.latitude);
                    
                    // Apply quadrant filter
                    if (sectorFilter === 'NORTH' && y >= 450) return false;
                    if (sectorFilter === 'SOUTH' && y < 450) return false;
                    if (sectorFilter === 'EAST' && x < 550) return false;
                    if (sectorFilter === 'WEST' && x >= 550) return false;
                    
                    // Apply search query
                    if (searchQuery && !t.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                    
                    return true;
                  })
                  .map((taxi) => {
                    const isSelected = selectedTaxiId === taxi.id;
                    const isCritical = taxi.status === 'Critical';
                    const activeColor = isCritical ? 'border-red-500/50 hover:border-red-500 bg-[#ef4444]/5' : isSelected ? 'border-[#00ffcc] bg-[#00ffcc]/5 shadow-[0_0_8px_rgba(0,255,204,0.15)]' : 'border-zinc-900 hover:border-zinc-800 bg-[#030305]';
                    return (
                      <div 
                        key={taxi.id} 
                        onClick={() => setSelectedTaxiId(taxi.id)}
                        className={`p-2.5 border transition-all cursor-pointer rounded-none relative ${activeColor}`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-orbitron font-black text-white">{taxi.id}</span>
                          <span className={`px-1.5 py-0.5 text-[7px] font-orbitron font-black border uppercase tracking-widest leading-none ${getStatusColor(taxi.status)}`}>
                            {taxi.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-[8px] text-zinc-500 font-share-tech">
                          <span>ALT: {Math.round(taxi.altitude)}M</span>
                          <span>SPD: {Math.round(taxi.speed * 100)}KMH</span>
                          <span className={taxi.battery < 30 ? 'text-red-500 animate-pulse font-bold' : 'text-zinc-400'}>{Math.round(taxi.battery)}% BATT</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* FOOTER - SYSTEM TELEMETRY */}
      <div className="max-w-[1600px] mx-auto mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-zinc-850 pt-4 relative z-10 font-orbitron">
        {[
          { label: 'AI_MODEL_CONF', value: '99.8%', icon: Zap, color: 'text-green-500' },
          { label: 'FLEET_AVG_ALT', value: taxis.length > 0 ? `${Math.round(taxis.reduce((acc, t) => acc + t.altitude, 0) / taxis.length)}M` : '575M', icon: TrendingUp, color: 'text-zinc-400' },
          { label: 'SAFETY_RATIO', value: '99.4%', icon: Shield, color: 'text-[#00ffcc]' },
          { label: 'RISK_EVENTS', value: taxis.filter(t => t.status === 'Critical').length.toString(), icon: AlertTriangle, color: 'text-red-500 animate-pulse' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#06060c]/85 p-3.5 border border-zinc-900 rounded-none relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-zinc-800" />
            <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-zinc-800" />
            <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-zinc-800" />
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-zinc-800" />
            <h3 className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.2em] mb-1">{stat.label}</h3>
            <div className={`text-xl font-bold tracking-widest ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
