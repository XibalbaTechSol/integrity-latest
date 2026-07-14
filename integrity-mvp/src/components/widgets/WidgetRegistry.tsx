import React from 'react';
import { Activity, ShieldCheck, Zap, FileText, Server, Radar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar } from 'recharts';

import { SeededDataBadge } from '../../shared/SeededDataBadge';

import { TriMetricWidget } from './TriMetricWidget';
const THROUGHPUT_DATA = [
  { time: '00:00', tps: 1200 },
  { time: '04:00', tps: 2100 },
  { time: '08:00', tps: 3400 },
  { time: '12:00', tps: 4500 },
  { time: '16:00', tps: 3100 },
  { time: '20:00', tps: 2400 },
  { time: '24:00', tps: 1500 }
];

const AIS_DISTRIBUTION_FALLBACK = [
  { name: 'High (900+)', count: 1420, fill: 'var(--success)' },
  { name: 'Medium (700-899)', count: 230, fill: 'var(--warning)' },
  { name: 'Low (<700)', count: 12, fill: 'var(--danger)' }
];

const LATENCY_DATA = [
  { node: 'us-east', latency: 45 },
  { node: 'eu-west', latency: 120 },
  { node: 'ap-south', latency: 85 },
  { node: 'us-west', latency: 55 },
  { node: 'sa-east', latency: 190 }
];

const RADAR_DATA = [
  { subject: 'ZKP Performance', A: 120, B: 110, fullMark: 150 },
  { subject: 'Attestation Speed', A: 98, B: 130, fullMark: 150 }
];

const COST_DATA = [
  { time: 'Mon', spend: 120, tokens: 4.2 },
  { time: 'Wed', spend: 180, tokens: 6.8 },
  { time: 'Thu', spend: 340, tokens: 12.1 },
  { time: 'Fri', spend: 290, tokens: 9.4 },
  { time: 'Sat', spend: 150, tokens: 5.1 },
  { time: 'Sun', spend: 220, tokens: 7.8 }
];

interface WidgetProps {
  aisDistribution?: any;
  highIntegrityPct?: number | null;
}

const NotesWidget: React.FC<WidgetProps> = () => {
  const [text, setText] = React.useState('System status: Active. ZK proofs anchoring every 10 min. Check health before rotation.');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <h3 className="card-title" style={{ fontSize: '0.9rem' }}>Dashboard Notes</h3>
        <FileText size={18} className="text-muted" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          flex: 1,
          background: 'rgba(0,0,0,0.15)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          color: 'var(--text-primary)',
          fontSize: '0.8rem',
          padding: '8px',
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit'
        }}
      />
    </div>
  );
};

export const WidgetRegistry: Record<string, {
  name: string;
  description: string;
  defaultSize: { w: number; h: number };
  component: React.FC<WidgetProps>;
}> = {
  'tri-metric': {
    name: 'Tri-Metric Risk Analysis',
    description: 'Displays the three cornerstone risk metrics in LaTeX.',
    defaultSize: { w: 10, h: 2 },
    component: TriMetricWidget
  },
  gauge: {
    name: 'Network Security Score',
    description: 'Real-time security posture of the network across all agents.',
    defaultSize: { w: 4, h: 2 },
    component: ({ aisDistribution, highIntegrityPct }) => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0, width: '100%' }}>
          <h3 className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Network Security Score
          </h3>
          <ShieldCheck size={18} className="text-muted" />
        </div>
        <div style={{ flex: 1, minHeight: 0, position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '140px', height: '140px' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--success)" strokeWidth="8" strokeDasharray="282.7" strokeDashoffset={282.7 * (1 - (highIntegrityPct ?? 94) / 100)} style={{ transition: 'stroke-dashoffset 1s ease-out' }} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textShadow: '0 0 20px rgba(16,185,129,0.5)' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success)', lineHeight: 1 }}>{highIntegrityPct ?? 94}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Score</span>
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 0, width: '100%', display: 'flex', justifyContent: 'space-around', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
               <div style={{ color: 'var(--success)', fontWeight: 700 }}>{(aisDistribution ?? AIS_DISTRIBUTION_FALLBACK)[0].count}</div>
               High
            </div>
            <div style={{ textAlign: 'center' }}>
               <div style={{ color: 'var(--warning)', fontWeight: 700 }}>{(aisDistribution ?? AIS_DISTRIBUTION_FALLBACK)[1].count}</div>
               Medium
            </div>
            <div style={{ textAlign: 'center' }}>
               <div style={{ color: 'var(--danger)', fontWeight: 700 }}>{(aisDistribution ?? AIS_DISTRIBUTION_FALLBACK)[2].count}</div>
               Low
            </div>
          </div>
        </div>
      </div>
    )
  },
  throughput: {
    name: 'Oracle Throughput (TPS)',
    description: 'Realtime TPS measurement for Oracle transactions.',
    defaultSize: { w: 4, h: 2 },
    component: () => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
          <h3 className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Oracle Throughput (TPS) <SeededDataBadge />
          </h3>
          <Activity size={18} className="text-muted" />
        </div>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={THROUGHPUT_DATA} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTpsDash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--success)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '8px', zIndex: 1000 }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Area type="monotone" dataKey="tps" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#colorTpsDash)" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)', animation: 'pulse 2s infinite' }}></div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>4,502 <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>peak TPS</span></div>
          </div>
        </div>
      </div>
    )
  },
  latency: {
    name: 'BCC Middleware Latency (ms)',
    description: 'Average response latency of global pre-execution policy gating.',
    defaultSize: { w: 4, h: 2 },
    component: () => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
          <h3 className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            BCC Middleware Latency (ms) <SeededDataBadge />
          </h3>
          <Zap size={18} className="text-muted" />
        </div>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={LATENCY_DATA} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
              <XAxis dataKey="node" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '8px', zIndex: 1000 }}
              />
              <Bar dataKey="latency" fill="var(--warning)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', top: '10px', right: '10px', textAlign: 'right' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--warning)' }}>99ms</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avg Global Latency</div>
          </div>
        </div>
      </div>
    )
  },
  nodes: {
    name: 'Global Node Fleet',
    description: 'Live hardware status of the active trusted execution environments.',
    defaultSize: { w: 6, h: 2 },
    component: () => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid hsla(var(--border-color-hsl) / 0.5)', paddingBottom: '12px', flexShrink: 0 }}>
          <h3 className="card-title" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Global Node Fleet <SeededDataBadge />
          </h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', background: 'var(--success)', borderRadius: '50%' }}></span>
            All Nominal
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.85rem', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid hsla(var(--border-color-hsl) / 0.5)' }}>
                <th style={{ padding: '8px 4px', fontWeight: 500 }}>Region</th>
                <th style={{ padding: '8px 4px', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '8px 4px', fontWeight: 500 }}>Enclave Type</th>
                <th style={{ padding: '8px 4px', fontWeight: 500, textAlign: 'right' }}>Uptime</th>
              </tr>
            </thead>
            <tbody>
              {[
                { region: 'us-east-1', status: 'ACTIVE', type: 'AWS Nitro', uptime: '99.99%' },
                { region: 'eu-central-1', status: 'ACTIVE', type: 'Azure CVM', uptime: '99.95%' },
                { region: 'ap-northeast-1', status: 'ACTIVE', type: 'AWS Nitro', uptime: '99.98%' },
                { region: 'us-west-2', status: 'DEGRADED', type: 'GCP TDX', uptime: '98.40%' },
              ].map((node, i) => (
                <tr key={i} style={{ borderBottom: '1px solid hsla(var(--border-color-hsl) / 0.5)' }}>
                  <td style={{ padding: '8px 4px', color: 'var(--text-primary)' }}><Server size={12} style={{ display: 'inline', marginRight: '6px', color: 'var(--text-muted)' }}/>{node.region}</td>
                  <td style={{ padding: '8px 4px' }}>
                    <span style={{ 
                      color: node.status === 'ACTIVE' ? 'var(--success)' : 'var(--warning)', 
                      background: node.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontSize: '0.65rem', fontWeight: 600
                    }}>{node.status}</span>
                  </td>
                  <td style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>{node.type}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{node.uptime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  },
  events: {
    name: 'Live Attestation Feed',
    description: 'Streaming audit log of ZKP and BCC transactions.',
    defaultSize: { w: 6, h: 2 },
    component: () => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', padding: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px 12px 0', flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            Live Attestation Feed <div style={{ width: '6px', height: '6px', background: 'var(--danger)', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
          </h3>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>T-0.00s</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto', padding: '0 8px 8px' }} className="custom-scrollbar">
          {[
            { time: '10:42:01.321', type: 'alert', msg: 'Suspicious payload intercepted from DID 0x9f... Blocked by BCC.', color: 'var(--danger)' },
            { time: '10:41:15.092', type: 'contract', msg: 'SmartBAA verified for Agent Healthcare-v2. Collateral locked.', color: 'var(--primary)' },
            { time: '10:39:50.884', type: 'success', msg: 'ZKP Attestation passed on Base L2 block 149231. Anchor confirmed.', color: 'var(--success)' },
            { time: '10:35:12.110', type: 'warning', msg: 'BCC Middleware quarantined node in us-west-2 due to latency spike.', color: 'var(--warning)' },
            { time: '10:30:05.405', type: 'success', msg: 'Agent Primitives deployed for new agent [did:intg:0x33b].', color: 'var(--success)' },
            { time: '10:28:11.992', type: 'contract', msg: 'Market outcome settled on ETH>3500. Escrow distributing.', color: 'var(--gold)' },
          ].map((event, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '6px 8px', borderLeft: `2px solid ${event.color}`, background: 'rgba(255,255,255,0.02)', fontFamily: 'var(--font-mono)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>{event.time}</div>
              <div style={{ color: event.color, fontSize: '0.75rem', lineHeight: 1.4 }}>{event.msg}</div>
            </div>
          ))}
        </div>
      </div>
    )
  },
  radar: {
    name: 'Attestation Integrity Radar',
    description: 'Multi-dimensional analysis of agent attestation features.',
    defaultSize: { w: 4, h: 2 },
    component: () => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
          <h3 className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Integrity Radar <SeededDataBadge />
          </h3>
          <Radar size={18} className="text-muted" />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={RADAR_DATA}>
              <PolarGrid stroke="rgba(255,255,255,0.05)" />
              <PolarAngleAxis dataKey="subject" stroke="var(--text-muted)" fontSize={9} />
              <PolarRadiusAxis angle={30} domain={[0, 150]} stroke="var(--text-muted)" fontSize={8} />
              <RechartsRadar name="Current Attested" dataKey="A" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
              <RechartsRadar name="Target SLA" dataKey="B" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.1} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '8px', zIndex: 1000 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  },
  notes: {
    name: 'Dashboard Notes',
    description: 'A customizable text note for system reminders.',
    defaultSize: { w: 4, h: 2 },
    component: NotesWidget
  },
  costAnalytics: {
    name: 'Cost & Token Analytics',
    description: 'Dual-axis visualization of API spend versus token throughput.',
    defaultSize: { w: 6, h: 2 },
    component: () => (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
          <h3 className="card-title" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Cost & Token Analytics <SeededDataBadge />
          </h3>
          <Activity size={18} className="text-muted" />
        </div>
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={COST_DATA} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
              <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}M`} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-main)', borderRadius: '8px', zIndex: 1000 }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
              <Area yAxisId="left" type="monotone" dataKey="spend" name="Spend ($)" stroke="var(--danger)" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
              <Area yAxisId="right" type="monotone" dataKey="tokens" name="Tokens (M)" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorTokens)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }
};;
