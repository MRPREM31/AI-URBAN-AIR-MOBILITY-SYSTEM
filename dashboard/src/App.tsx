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
}

interface Airspace {
  skyports: Array<{ name: string; x: number; y: number }>;
  buildings: Array<{ x: number; y: number; w: number; h: number }>;
  no_fly_zones: Array<{ name: string; x: number; y: number; radius: number }>;
  weather_cells: Array<{ name: string; x: number; y: number; radius: number }>;
  congested_zones: Array<{ x: number; y: number; radius: number; density: number }>;
}

const getAltitudeColor = (alt: number) => {
  if (alt >= 700) return '#b400ff'; // Purple (Climb override)
  if (alt >= 625) return '#00ff78'; // Green (650m Corridor)
  if (alt >= 575) return '#ff00dc'; // Magenta (600m Corridor)
  if (alt >= 525) return '#ffd700'; // Yellow (550m Corridor)
  if (alt >= 475) return '#00f6ff'; // Cyan (500m Corridor)
  return '#ff4646'; // Red (Emergency / Landing Descent)
};

export default function UrbanAirTaxiDashboard() {
  const [taxis, setTaxis] = useState<Taxi[]>([]);
  const [airspace, setAirspace] = useState<Airspace | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [events, setEvents] = useState<any[]>([]);
  const [slowDown, setSlowDown] = useState(false);

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
              const tx = (taxi.longitude - 78.0) * 1100;
              const ty = (taxi.latitude - 17.0) * 900;
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
    <div className="min-h-screen bg-[#020202] text-zinc-300 p-2 md:p-6 font-mono selection:bg-[#00ffcc]/30">
      {/* ATC TOP BAR */}
      <div className="max-w-[1600px] mx-auto mb-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#00ffcc]/10 border border-[#00ffcc]/30">
            <Terminal className="w-5 h-5 text-[#00ffcc]" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-[0.3em] uppercase text-white">
              URBAN_AIR_MOBILITY_SYSTEM // ATC_NODE_V3
            </h1>
            <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500 mt-0.5">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" /> UAM_LINK_ACTIVE</span>
              <span className="flex items-center gap-1.5"><Wifi className="w-3 h-3 text-[#00ffcc]" /> SECURE_DATA_FEED</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={toggleSpeedRestriction}
            className={`px-4 py-1.5 text-[10px] font-black tracking-widest transition-all border flex items-center gap-1.5 rounded-none ${
              slowDown 
                ? 'bg-yellow-500 border-yellow-500 text-black hover:bg-yellow-600 animate-pulse' 
                : 'border-zinc-800 text-zinc-400 hover:text-yellow-500 hover:border-yellow-500/50 bg-black'
            }`}
          >
            <Wind className={`w-3.5 h-3.5 ${slowDown ? 'animate-spin' : ''}`} />
            {slowDown ? 'RESTORE VELOCITY' : 'SLOW AIR MOBILITY'}
          </button>

          <div className="flex bg-black border border-zinc-800 p-0.5">
            {['2D', '3D'].map((mode) => (
              <button 
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`px-6 py-1.5 text-[10px] font-black tracking-widest transition-all ${viewMode === mode ? 'bg-[#00ffcc] text-black' : 'text-zinc-600 hover:text-zinc-300'}`}
              >
                {mode}_RADAR
              </button>
            ))}
          </div>
          <div className="text-right border-l border-zinc-800 pl-6">
            <div className="text-zinc-600 text-[9px] uppercase tracking-widest font-black mb-1">System Time</div>
            <div className="text-xl font-bold text-white tracking-widest leading-none">{currentTime}</div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* CENTER - SPATIAL DATA */}
        <div className="lg:col-span-9 space-y-4">
          
          {/* PLAYBACK CONTROL HUB */}
          <div className="bg-black/90 border border-zinc-900 p-3 flex flex-col gap-2 rounded-sm shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${playbackActive ? 'bg-orange-500 animate-pulse' : 'bg-green-500 animate-ping'}`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  {playbackActive ? `PLAYBACK ACTIVE // TIMELINE STEP: ${playbackIndex + 1} / ${playbackBuffer.length}` : 'LIVE REAL-TIME STREAMING'}
                </span>
              </div>

              <div className="flex items-center gap-3">
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
                      ? 'bg-orange-500 text-black border-orange-500 hover:bg-orange-600' 
                      : 'bg-black text-[#00ffcc] border-[#00ffcc]/30 hover:border-[#00ffcc]/60'
                  }`}
                >
                  {playbackActive ? 'GO LIVE STREAM' : 'PAUSE / REPLAY FLIGHT'}
                </button>

                {/* Step back */}
                <button
                  disabled={!playbackActive || playbackIndex === 0}
                  onClick={() => setPlaybackIndex(prev => Math.max(0, prev - 1))}
                  className="px-2 py-1 text-[9px] font-black bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ◀ STEP BACK
                </button>

                {/* Step forward */}
                <button
                  disabled={!playbackActive || playbackIndex >= playbackBuffer.length - 1}
                  onClick={() => setPlaybackIndex(prev => Math.min(playbackBuffer.length - 1, prev + 1))}
                  className="px-2 py-1 text-[9px] font-black bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
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
              <div className="flex items-center gap-3 border-t border-zinc-900 pt-2 w-full">
                <span className="text-[8px] text-zinc-600 font-mono">00:00</span>
                <input 
                  type="range"
                  min="0"
                  max={playbackBuffer.length - 1}
                  value={playbackIndex}
                  onChange={(e) => setPlaybackIndex(parseInt(e.target.value))}
                  className="flex-1 accent-[#00ffcc] h-1 bg-zinc-800 cursor-pointer rounded-none"
                />
                <span className="text-[8px] text-zinc-400 font-mono">T-{playbackBuffer.length - 1 - playbackIndex} SECS</span>
              </div>
            )}
          </div>

          <div className="relative aspect-[21/9] border border-zinc-800 bg-[#030305] overflow-hidden">
            {viewMode === '3D' ? <Airspace3D taxis={taxis} airspace={airspace} selectedTaxiId={selectedTaxiId} /> : (
              <div className="relative w-full h-full">
                {/* SVG High-Tech Radar Overlay with smooth viewBox slide transitions */}
                <svg 
                  viewBox={(() => {
                    if (autofocusMode && selectedTaxiId) {
                      const act = taxis.find(t => t.id === selectedTaxiId);
                      if (act) {
                        const tx = (act.longitude - 78.0) * 1100;
                        const ty = (act.latitude - 17.0) * 900;
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
                    const x = (taxi.longitude - 78.0) * 1100;
                    const y = (taxi.latitude - 17.0) * 900;
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
            <div className="absolute top-4 right-4 space-y-2 pointer-events-none">
              <div className="bg-black/90 border border-zinc-800 p-3 flex items-center gap-3">
                <Heartbeat className="w-4 h-4 text-orange-500 animate-pulse" />
                <div className="text-[10px] font-bold">
                  <div className="text-zinc-500 uppercase">Sync_Rate</div>
                  <div className="text-white">1000ms / 60fps</div>
                </div>
              </div>
            </div>
          </div>

          <Analytics history={history} />

          {/* SYSTEM LOGS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0a0a0a] border border-zinc-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-[10px] font-black uppercase text-zinc-400">Environment_Status</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">WIND_VEC</span><span className="text-white">14.6 KT @ 245°</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">VISIBILITY</span><span className="text-white">9.8 KM (OPTIMAL)</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">STORM_CELL_A</span><span className="text-blue-400 font-bold animate-pulse">ACTIVE // DRIFTING</span></div>
              </div>
            </div>
            <div className="md:col-span-2 bg-[#0a0a0a] border border-zinc-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-[#00ffcc]" />
                <span className="text-[10px] font-black uppercase text-zinc-400">AI_Decision_Log</span>
              </div>
              <div ref={logContainerRef} className="text-[10px] font-mono space-y-2 h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                {events.map((event, idx) => {
                  let colorClass = "text-zinc-400";
                  if (event.event_type === "COLLISION") {
                    colorClass = "text-red-500 font-bold animate-pulse";
                  } else if (event.event_type === "BUILDING") {
                    colorClass = "text-purple-500 font-bold";
                  } else if (event.event_type === "WEATHER") {
                    colorClass = "text-sky-400 font-bold";
                  } else if (event.event_type === "AIRSPACE") {
                    colorClass = "text-yellow-500 font-bold";
                  } else if (event.event_type === "ROUTE") {
                    colorClass = "text-[#00ffcc]";
                  }
                  
                  return (
                    <div key={idx} className={`${colorClass} flex items-start gap-1`}>
                      <span className="text-zinc-600">[{event.timestamp}]</span>
                      <span className="font-semibold bg-zinc-900 px-1 py-0.5 rounded text-[8px] tracking-wider uppercase border border-zinc-800 text-zinc-500">{event.event_type}</span>
                      <span>{event.message}</span>
                    </div>
                  );
                })}
                {events.length === 0 && (
                  <div className="text-zinc-600 text-[10px] italic">No active decisions logged. Syncing with flight simulation...</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR - SURVEILLANCE & FLEET DECKS */}
        <div className="lg:col-span-3 space-y-4">
          
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
                const cx = (activeTaxi.longitude - 78.0) * 1100;
                const cy = (activeTaxi.latitude - 17.0) * 900;
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
                  className="bg-black border border-[#00ffcc]/30 p-4 relative shadow-[0_0_15px_rgba(0,255,204,0.05)]"
                >
                  {/* Glowing header target reticle */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ffcc] animate-ping" />
                    <button 
                      onClick={() => setSelectedTaxiId(null)}
                      className="text-[8px] font-black uppercase text-[#00ffcc] hover:text-red-400 border border-[#00ffcc]/20 hover:border-red-400/30 px-1 py-0.5"
                    >
                      DISCONNECT
                    </button>
                  </div>

                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-[#00ffcc] flex items-center gap-2">
                    <Crosshair className="w-3.5 h-3.5 animate-spin text-[#00ffcc]" style={{ animationDuration: '4s' }} />
                    SURVEILLANCE_LINK
                  </h3>

                  {/* Abnormal Alert Indicator */}
                  {isAbnormal && (
                    <div className="bg-red-950/40 border border-red-500/50 p-2.5 mb-3 text-red-400 text-[8px] font-bold tracking-wider animate-pulse flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <div>
                        <div className="font-black uppercase text-red-500">ABNORMAL FLIGHT STATUS</div>
                        <div className="text-zinc-400 mt-0.5 text-[7px] leading-tight">{abnormalMessage}</div>
                      </div>
                    </div>
                  )}

                  {/* Visual telemetry dials */}
                  <div className="border border-zinc-900 p-3 mb-4 space-y-3 bg-[#020203]">
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                      <span className="text-[12px] font-black text-white">{activeTaxi.id}</span>
                      <span className="text-[8px] font-mono text-zinc-500">FLIGHT_DECK_{activeTaxi.altitude}M</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[9px]">
                      <div>
                        <span className="text-zinc-600 block uppercase">Altitude</span>
                        <span className="text-xs font-bold text-white tracking-wider">{Math.round(activeTaxi.altitude)}M</span>
                      </div>
                      <div>
                        <span className="text-zinc-600 block uppercase">Speed</span>
                        <span className="text-xs font-bold text-white tracking-wider">{Math.round(activeTaxi.speed * 100)} KMH</span>
                      </div>
                      <div>
                        <span className="text-zinc-600 block uppercase">Latitude</span>
                        <span className="text-zinc-400 font-mono">{activeTaxi.latitude.toFixed(5)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-600 block uppercase">Longitude</span>
                        <span className="text-zinc-400 font-mono">{activeTaxi.longitude.toFixed(5)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-600 block uppercase">Depart From</span>
                        <span className="text-zinc-300 font-semibold block truncate">{pickupName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-600 block uppercase">Destination</span>
                        <span className="text-zinc-300 font-semibold block truncate">{dropName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-600 block uppercase">Corridor Deck</span>
                        <span className="text-zinc-300 font-semibold block text-[8px] truncate">{activeTaxi.altitude >= 600 ? "HIGHWAY_DECK_WEST" : "FLIGHT_LANE_EAST"}</span>
                      </div>
                      <div>
                        <span className="text-zinc-600 block uppercase">ETA (Skyport)</span>
                        <span className="text-[#00ffcc] font-bold block">{etaString}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-[9px] mb-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 uppercase">AI Collision Index</span>
                      <span className={`font-bold ${activeTaxi.risk > 70 ? 'text-red-500 animate-pulse' : 'text-[#00ffcc]'}`}>{activeTaxi.risk}%</span>
                    </div>
                    <div className="h-1 bg-zinc-900 overflow-hidden">
                      <div className="h-full transition-all duration-500" style={{ width: `${activeTaxi.risk}%`, backgroundColor: activeColor }} />
                    </div>
                  </div>

                  <div className="space-y-2 text-[9px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 uppercase">Battery Telemetry</span>
                      <span className={`font-bold ${activeTaxi.battery < 30 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>{Math.round(activeTaxi.battery)}%</span>
                    </div>
                    <div className="h-1 bg-zinc-900 overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${activeTaxi.battery < 30 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${activeTaxi.battery}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-900 grid grid-cols-2 gap-2 text-[8px] font-black uppercase text-zinc-500">
                    <div>
                      STATUS: <span style={{ color: activeColor }}>{activeTaxi.status}</span>
                    </div>
                    <div>
                      COLLISION: <span className={isSelectedCritical ? 'text-red-500 animate-pulse' : 'text-green-500'}>{isSelectedCritical ? 'CONFLICT' : 'SECURE'}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          {/* FLEET TRACKING & FILTERS SECTION */}
          <div className="border border-zinc-850 p-4 bg-black/40 space-y-4">
            
            {/* Search Input Widget */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block flex items-center gap-1">
                <Search className="w-3 h-3 text-[#00ffcc]" /> Search Fleet By ID
              </label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="ENTER TAXI ID (E.G. TX2)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  className="w-full bg-[#050508] border border-zinc-800 p-2 text-xs font-mono text-white placeholder-zinc-700 rounded-none focus:outline-none focus:border-[#00ffcc]/50"
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
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Direct Target Select</label>
              <select 
                value={selectedTaxiId || ''} 
                onChange={(e) => setSelectedTaxiId(e.target.value || null)}
                className="w-full bg-[#050508] border border-zinc-800 p-2 text-xs font-mono text-white rounded-none focus:outline-none focus:border-[#00ffcc]/50"
              >
                <option value="">-- SELECT TAXI TARGET --</option>
                {taxis.map(t => (
                  <option key={t.id} value={t.id}>{t.id} [{t.status}]</option>
                ))}
              </select>
            </div>

            {/* Sector Filtering Widgets */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Sector-Wise Quadrants</label>
              <div className="grid grid-cols-5 gap-1 bg-black border border-zinc-900 p-0.5">
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
              <div className="text-[9px] font-black uppercase text-zinc-400 mb-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#00ffcc]" /> DENSITY_ANALYTICAL_MATRIX
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
                <span className="text-green-400 font-mono">0 ACTIVE</span>
              </div>
            </div>

            {/* Dynamic Fleet List Scrollable */}
            <div className="border-t border-zinc-900 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase text-[#00ffcc] tracking-widest">Surveillance Feed ({taxis.filter(t => {
                  const x = (t.longitude - 78.0) * 1100;
                  const y = (t.latitude - 17.0) * 900;
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
                    const x = (t.longitude - 78.0) * 1100;
                    const y = (t.latitude - 17.0) * 900;
                    
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
                    return (
                      <div 
                        key={taxi.id} 
                        onClick={() => setSelectedTaxiId(taxi.id)}
                        className={`bg-black/90 p-2.5 border transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-[#00ffcc] bg-[#00ffcc]/5 shadow-[0_0_8px_rgba(0,255,204,0.1)]' 
                            : 'border-zinc-900 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black text-white">{taxi.id}</span>
                          <span className={`px-1.5 py-0.5 text-[7px] font-black border uppercase tracking-widest leading-none ${getStatusColor(taxi.status)}`}>
                            {taxi.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-[8px] text-zinc-500">
                          <span>ALT: {Math.round(taxi.altitude)}M</span>
                          <span>SPD: {Math.round(taxi.speed * 100)}KMH</span>
                          <span className={taxi.battery < 30 ? 'text-red-500 animate-pulse' : 'text-zinc-400'}>{Math.round(taxi.battery)}% BATT</span>
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
      <div className="max-w-[1600px] mx-auto mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-zinc-800 pt-4">
        {[
          { label: 'AI_MODEL_CONF', value: '99.8%', icon: Zap, color: 'text-green-500' },
          { label: 'FLEET_AVG_ALT', value: '575M', icon: TrendingUp, color: 'text-zinc-400' },
          { label: 'SAFETY_RATIO', value: '98.4%', icon: Shield, color: 'text-[#00ffcc]' },
          { label: 'RISK_EVENTS', value: taxis.filter(t => t.status === 'Critical').length.toString(), icon: AlertTriangle, color: 'text-red-500 animate-pulse' },
        ].map((stat, i) => (
          <div key={i} className="bg-black/40 p-3 border border-zinc-900">
            <h3 className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.2em] mb-1">{stat.label}</h3>
            <div className={`text-xl font-bold tracking-widest ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
