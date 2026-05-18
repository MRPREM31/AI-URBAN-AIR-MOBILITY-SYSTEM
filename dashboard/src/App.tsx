import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Wind, 
  Navigation, 
  AlertTriangle, 
  Activity, 
  Cpu, 
  Zap, 
  Crosshair,
  TrendingUp,
  Clock,
  MapPin,
  Wifi,
  Layers,
  Terminal,
  Activity as Heartbeat,
  Battery
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Airspace3D from './components/Airspace3D';
import Analytics from './components/Analytics';

interface Taxi {
  id: string;
  status: 'Flying' | 'Landing' | 'Emerging' | 'Critical' | 'Bypassing';
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
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [events, setEvents] = useState<any[]>([]);
  const [slowDown, setSlowDown] = useState(false);

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
        setTaxis(data);
        
        const avgAltitude = data.length > 0 ? data.reduce((acc: number, t: Taxi) => acc + t.altitude, 0) / data.length : 0;
        const avgRisk = data.length > 0 ? data.reduce((acc: number, t: Taxi) => acc + t.risk, 0) / data.length : 0;
        
        setHistory(prev => {
          const newEntry = { time: new Date().toLocaleTimeString(), avgAltitude, avgRisk };
          return [...prev, newEntry].slice(-25);
        });
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
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Flying': return 'text-[#00ffcc] border-[#00ffcc]/30 bg-[#00ffcc]/5';
      case 'Landing': return 'text-blue-400 border-blue-400/30 bg-blue-400/5';
      case 'Emerging': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5';
      case 'Critical': return 'text-red-500 border-red-500/50 bg-red-500/10 animate-pulse';
      case 'Bypassing': return 'text-[#ffaa00] border-[#ffaa00]/30 bg-[#ffaa00]/5';
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
          <div className="relative aspect-[21/9] border border-zinc-800 bg-[#030305] overflow-hidden">
            {viewMode === '3D' ? <Airspace3D taxis={taxis} airspace={airspace} /> : (
              <div className="relative w-full h-full">
                {/* SVG High-Tech Radar Overlay */}
                <svg viewBox="0 0 1100 900" className="w-full h-full select-none">
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

                  {/* Skyports */}
                  {airspace?.skyports.map((p, idx) => (
                    <g key={`p-${idx}`}>
                      <circle cx={p.x} cy={p.y} r="6" fill="#00ffcc" />
                      <circle cx={p.x} cy={p.y} r="12" fill="none" stroke="#00ffcc" strokeWidth="1" opacity="0.4" />
                      <text x={p.x + 15} y={p.y + 4} fill="#fff" fontSize="10" fontWeight="bold" opacity="0.9">{p.name}</text>
                    </g>
                  ))}

                  {/* Taxi Nodes */}
                  {taxis.map((taxi) => {
                    const x = (taxi.longitude - 78.0) * 1100;
                    const y = (taxi.latitude - 17.0) * 900;
                    const color = getAltitudeColor(taxi.altitude);
                    const isCritical = taxi.status === 'Critical';
                    const isBypassing = taxi.status === 'Bypassing';
                    
                    return (
                      <g key={taxi.id}>
                        {/* Safe Bubble radius matching simulation 45px */}
                        <circle cx={x} cy={y} r="45" fill="none" stroke={isCritical ? '#ef4444' : isBypassing ? '#ffaa00' : color} strokeWidth="1" strokeDasharray="3,3" opacity={isCritical || isBypassing ? "0.6" : "0.3"} />
                        
                        {/* Interactive glow ring */}
                        <circle cx={x} cy={y} r="15" fill="none" stroke={isBypassing ? '#ffaa00' : color} strokeWidth="0.5" opacity="0.2" />

                        {/* Central Target Dot */}
                        <circle cx={x} cy={y} r="5" fill={isCritical ? '#ef4444' : isBypassing ? '#ffaa00' : color} className={isCritical ? 'animate-ping' : isBypassing ? 'animate-pulse' : ''} />
                        
                        {/* Telemetry Labels */}
                        <rect x={x + 10} y={y - 30} width="95" height="36" fill="rgba(2, 2, 3, 0.85)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                        <text x={x + 15} y={y - 20} fill="#fff" fontSize="9" fontWeight="bold">{taxi.id} // {Math.round(taxi.battery)}%</text>
                        <text x={x + 15} y={y - 10} fill={color} fontSize="8" fontWeight="bold">ALT: {Math.round(taxi.altitude)}M</text>
                        <text x={x + 15} y={y - 2} fill={isCritical ? '#ff4444' : isBypassing ? '#ffaa00' : '#888'} fontSize="7" fontWeight="bold" letterSpacing="0.5px">SYS_{taxi.status.toUpperCase()}</text>
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

        {/* SIDEBAR - ATC TRACKING LIST */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#00ffcc] flex items-center gap-2">
              <Crosshair className="w-4 h-4" /> Live_Tracking
            </h2>
            <span className="text-[9px] font-black bg-[#00ffcc]/10 text-[#00ffcc] px-2 py-0.5 border border-[#00ffcc]/20">
              {taxis.length} UNITS_UP
            </span>
          </div>

          <div className="space-y-2 h-[750px] overflow-y-auto pr-2 custom-scrollbar">
            {taxis.map((taxi) => (
              <div key={taxi.id} className="bg-black border border-zinc-900 p-3 hover:border-[#00ffcc]/40 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-xs font-black text-white">{taxi.id}</div>
                    <div className="text-[8px] text-zinc-600 mt-0.5 uppercase tracking-widest">{taxi.route}</div>
                  </div>
                  <div className={`px-2 py-0.5 text-[8px] font-black border uppercase tracking-widest ${getStatusColor(taxi.status)}`}>
                    {taxi.status}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-[#050505] p-2 border border-zinc-900">
                    <div className="text-[8px] text-zinc-600 uppercase mb-0.5">ALT</div>
                    <div className="text-xs font-bold font-mono text-white tracking-wider">{Math.round(taxi.altitude)}M</div>
                  </div>
                  <div className="bg-[#050505] p-2 border border-zinc-900">
                    <div className="text-[8px] text-zinc-600 uppercase mb-0.5">SPD</div>
                    <div className="text-xs font-bold font-mono text-white tracking-wider">{Math.round(taxi.speed * 100)}KMH</div>
                  </div>
                  <div className="bg-[#050505] p-2 border border-zinc-900">
                    <div className="text-[8px] text-zinc-600 uppercase mb-0.5">BATT</div>
                    <div className={`text-xs font-bold font-mono tracking-wider ${taxi.battery < 30 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                      {Math.round(taxi.battery)}%
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[8px] font-black uppercase">
                    <span className="text-zinc-600">Risk_Vec</span>
                    <span className={taxi.status === 'Bypassing' ? 'text-[#ffaa00] font-bold' : taxi.risk > 70 ? 'text-red-500 font-bold' : 'text-[#00ffcc]'}>{Math.round(taxi.risk)}%</span>
                  </div>
                  <div className="h-1 bg-zinc-900 rounded-none overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${taxi.risk}%` }}
                      className={`h-full ${taxi.status === 'Bypassing' ? 'bg-[#ffaa00]' : taxi.risk > 70 ? 'bg-red-500' : 'bg-[#00ffcc]'}`}
                    />
                  </div>
                </div>
              </div>
            ))}
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
