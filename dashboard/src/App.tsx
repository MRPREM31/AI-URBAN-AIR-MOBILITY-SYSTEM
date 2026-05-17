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
  Activity as Heartbeat
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Airspace3D from './components/Airspace3D';
import Analytics from './components/Analytics';

interface Taxi {
  id: string;
  status: 'Flying' | 'Landing' | 'Emerging' | 'Critical';
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  route: string;
  risk: number;
  lastSeen: string;
}

export default function UrbanAirTaxiDashboard() {
  const [taxis, setTaxis] = useState<Taxi[]>([]);
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
              URBAN_AIR_MOBILITY_SYSTEM // UAM_NODE
            </h1>
            <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500 mt-0.5">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> UAM_LINK_ESTABLISHED</span>
              <span className="flex items-center gap-1.5"><Wifi className="w-3 h-3" /> SECURE_DATA_FEED</span>
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
          <div className="relative aspect-[21/9] border border-zinc-800 bg-black overflow-hidden">
            {viewMode === '3D' ? <Airspace3D taxis={taxis} /> : (
              <div className="relative w-full h-full bg-[#050505]">
                <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 opacity-10 pointer-events-none">
                  {[...Array(144)].map((_, i) => (
                    <div key={i} className="border-[0.5px] border-[#00ffcc]/20" />
                  ))}
                </div>
                
                {/* Radar Rings */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full border border-zinc-900 rounded-full opacity-20 scale-75" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full border border-zinc-900 rounded-full opacity-10 scale-50" />

                {/* Taxi Markers */}
                <AnimatePresence>
                  {taxis.map((taxi) => (
                    <motion.div
                      key={taxi.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1,
                        x: (taxi.longitude - 78.5) * 800,
                        y: (taxi.latitude - 17.5) * 600
                      }}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                    >
                      <div className={`w-3 h-3 border-2 ${taxi.status === 'Critical' ? 'border-red-500 bg-red-500/20' : 'border-[#00ffcc] bg-[#00ffcc]/20'} rotate-45`} />
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-white whitespace-nowrap bg-black/80 px-1 border border-white/10 opacity-0 group-hover:opacity-100">
                        {taxi.id} // {taxi.altitude}M
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

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
              <div className="bg-black/80 border border-zinc-800 p-3 flex items-center gap-3">
                <Heartbeat className="w-4 h-4 text-orange-500" />
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
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">WIND_VEC</span><span className="text-white">12.4 KT @ 240°</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">VISIBILITY</span><span className="text-white">9.8 KM (OPTIMAL)</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">BIRD_DENSITY</span><span className="text-yellow-500">MODERATE</span></div>
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
                    colorClass = "text-orange-500 font-bold";
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

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-[#050505] p-2 border border-zinc-900">
                    <div className="text-[8px] text-zinc-600 uppercase mb-0.5">ALT</div>
                    <div className="text-xs font-bold font-mono text-white tracking-wider">{Math.round(taxi.altitude)}M</div>
                  </div>
                  <div className="bg-[#050505] p-2 border border-zinc-900">
                    <div className="text-[8px] text-zinc-600 uppercase mb-0.5">SPD</div>
                    <div className="text-xs font-bold font-mono text-white tracking-wider">{Math.round(taxi.speed)}KMH</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[8px] font-black uppercase">
                    <span className="text-zinc-600">Risk_Vec</span>
                    <span className={taxi.risk > 70 ? 'text-red-500' : 'text-[#00ffcc]'}>{Math.round(taxi.risk)}%</span>
                  </div>
                  <div className="h-1 bg-zinc-900 rounded-none overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${taxi.risk}%` }}
                      className={`h-full ${taxi.risk > 70 ? 'bg-red-500' : 'bg-[#00ffcc]'}`}
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
          { label: 'FLEET_AVG_ALT', value: '342M', icon: TrendingUp, color: 'text-zinc-400' },
          { label: 'SAFETY_RATIO', value: '94.2%', icon: Shield, color: 'text-[#00ffcc]' },
          { label: 'RISK_EVENTS', value: '0', icon: AlertTriangle, color: 'text-zinc-600' },
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
