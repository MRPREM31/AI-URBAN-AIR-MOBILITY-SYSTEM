
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface AnalyticsProps {
  history: any[];
}

export default function Analytics({ history }: AnalyticsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-black/40 p-4 border border-[#00ffcc]/10 rounded-lg min-h-[220px] min-w-0">
        <h3 className="text-[10px] font-mono font-black text-[#00ffcc] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#00ffcc] inline-block animate-pulse" />
          ALT_TELEMETRY_LOG
        </h3>
        <div style={{ width: '100%', height: '180px', minWidth: '0px' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={history}>
              <CartesianGrid strokeDasharray="2 2" stroke="#111" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#333" fontSize={8} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: '#000', border: '1px solid #00ffcc33', borderRadius: '0px', fontSize: '9px', fontFamily: 'monospace' }}
              />
              <Area type="step" dataKey="avgAltitude" stroke="#00ffcc" fill="#00ffcc" fillOpacity={0.05} strokeWidth={1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-black/40 p-4 border border-orange-500/10 rounded-lg min-h-[220px] min-w-0">
        <h3 className="text-[10px] font-mono font-black text-orange-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-orange-500 inline-block animate-pulse" />
          RISK_VEC_ANALYSIS
        </h3>
        <div style={{ width: '100%', height: '180px', minWidth: '0px' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="2 2" stroke="#111" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#333" fontSize={8} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ background: '#000', border: '1px solid #f9731633', borderRadius: '0px', fontSize: '9px', fontFamily: 'monospace' }}
              />
              <Line type="monotone" dataKey="avgRisk" stroke="#f97316" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
