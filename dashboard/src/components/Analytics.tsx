
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface AnalyticsProps {
  history: any[];
}

export default function Analytics({ history }: AnalyticsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="bg-[#06060c]/85 p-4 border border-[#00ffcc]/15 rounded-none min-h-[220px] min-w-0 relative overflow-hidden backdrop-blur-md font-share-tech">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00ffcc]" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00ffcc]" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00ffcc]" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00ffcc]" />
        
        <h3 className="text-[10px] font-orbitron font-black text-[#00ffcc] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#00ffcc] inline-block animate-pulse" />
          ALTITUDE_TELEMETRY_LOG
        </h3>
        <div style={{ width: '100%', height: '180px', minWidth: '0px' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={history}>
              <CartesianGrid strokeDasharray="2 2" stroke="#141420" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#444" fontSize={8} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: '#06060c', border: '1px solid #00ffcc33', borderRadius: '0px', fontSize: '9px', fontFamily: 'monospace', color: '#fff' }}
              />
              <Area type="step" dataKey="avgAltitude" stroke="#00ffcc" fill="#00ffcc" fillOpacity={0.03} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#06060c]/85 p-4 border border-orange-500/15 rounded-none min-h-[220px] min-w-0 relative overflow-hidden backdrop-blur-md font-share-tech">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-orange-500" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-orange-500" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-orange-500" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-orange-500" />

        <h3 className="text-[10px] font-orbitron font-black text-orange-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-orange-500 inline-block animate-pulse" />
          RISK_VECTOR_ANALYSIS
        </h3>
        <div style={{ width: '100%', height: '180px', minWidth: '0px' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="2 2" stroke="#141420" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#444" fontSize={8} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: '#06060c', border: '1px solid #f9731633', borderRadius: '0px', fontSize: '9px', fontFamily: 'monospace', color: '#fff' }}
              />
              <Line type="monotone" dataKey="avgRisk" stroke="#f97316" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
