import { useState, useEffect, useRef } from 'react';
import { Terminal, Save, Folder, File, Cpu, ShieldCheck } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { TopBar } from '../components/TopBar';
import { oracle } from '../services/oracle';
import type { AgentSummary } from '../services/oracle';
import { REAL_FILES } from '../services/contractFiles';

export const ContractsPage = () => {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [activeItem, setActiveItem] = useState<{ type: 'contract' | 'agent', id: string, name: string } | null>(null);
  
  const [agentPrimitives, setAgentPrimitives] = useState<any | null>(null);
  const [agentAis, setAgentAis] = useState<any | null>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);

  const [logs, setLogs] = useState<string[]>([
    '[system] Legacy IDE Interface loaded.',
    '[system] Connected to Xibalba Agent Registry.'
  ]);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    oracle.listAgents().then(a => setAgents(a)).catch(err => appendLog(`[error] Failed to fetch agents: ${err.message}`));
    
    // Default to the first contract if available
    if (REAL_FILES.length > 0) {
      setActiveItem({ type: 'contract', id: REAL_FILES[0].name, name: REAL_FILES[0].name });
    }
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const appendLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleSelectAgent = async (id: string) => {
    setActiveItem({ type: 'agent', id, name: `Agent ${id.substring(0, 8)}...` });
    setIsLoadingAgent(true);
    setAgentPrimitives(null);
    setAgentAis(null);
    appendLog(`[system] Querying primitive statuses for agent ${id}...`);
    try {
      const agentData = await oracle.getAgent(id);
      setAgentPrimitives(agentData.primitives);
      appendLog(`[success] Resolved 7 primitives for agent ${id} (${agentData.primitives_source})`);
      
      const aisData = await oracle.getAis(id);
      setAgentAis(aisData);
      appendLog(`[success] Fetched AIS scoring for agent ${id}`);
    } catch (err: any) {
      appendLog(`[error] Failed to query agent details: ${err.message}`);
    } finally {
      setIsLoadingAgent(false);
    }
  };

  const handleSelectContract = (name: string) => {
    setActiveItem({ type: 'contract', id: name, name });
    appendLog(`[system] Opened contract ${name}`);
  };

  const getContractCode = (name: string) => {
    return REAL_FILES.find(f => f.name === name)?.content || '// Contract not found';
  };

  return (
    <div className="main-content legacy-ide-theme" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
      <TopBar title="Smart Contracts & Architecture" />

      {/* IDE Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Code size={18} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Integrity IDE Workstation</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => appendLog('State saved locally.')}>
            <Save size={14} /> Save
          </button>
          <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '13px', background: 'var(--accent-primary)', color: 'var(--bg-main)', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => appendLog('[build] Compiling contracts...')}>
            <Cpu size={14} /> Build
          </button>
          <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '13px', background: 'var(--gold)', color: 'black', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }} onClick={() => appendLog('[deploy] Deploying to Base...')}>
            <ShieldCheck size={14} /> Deploy
          </button>
        </div>
      </div>

      {/* Main IDE Layout */}
      <div style={{ display: 'flex', flex: 1, gap: '4px', overflow: 'hidden', padding: '4px', backgroundColor: 'var(--border-color)', minHeight: 0 }}>
        
        {/* Left Panel - File Explorer */}
        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)', minHeight: 0 }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>
            <Folder size={14} style={{ display: 'inline', marginRight: '6px' }} /> Workspace
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            
            {/* Smart Contracts Folder */}
            <div style={{ padding: '4px 8px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <Folder size={14} style={{ color: 'var(--gold)' }} /> src/contracts
            </div>
            {REAL_FILES.map(file => (
              <div 
                key={file.name}
                onClick={() => handleSelectContract(file.name)}
                style={{ 
                  padding: '4px 16px 4px 32px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  backgroundColor: activeItem?.id === file.name ? 'var(--bg-panel-hover)' : 'transparent',
                  color: activeItem?.id === file.name ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
              >
                <File size={14} style={{ color: activeItem?.id === file.name ? 'var(--accent-primary)' : 'var(--text-muted)' }} /> {file.name}
              </div>
            ))}

            {/* Connected Agents Folder */}
            <div style={{ padding: '4px 8px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <Folder size={14} style={{ color: 'var(--primary)' }} /> connected_agents
            </div>
            {agents.map(agent => (
              <div 
                key={agent.id}
                onClick={() => handleSelectAgent(agent.id)}
                style={{ 
                  padding: '4px 16px 4px 32px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  backgroundColor: activeItem?.id === agent.id ? 'var(--bg-panel-hover)' : 'transparent',
                  color: activeItem?.id === agent.id ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
              >
                <Cpu size={14} style={{ color: activeItem?.id === agent.id ? 'var(--accent-primary)' : 'var(--text-muted)' }} /> {agent.id.substring(0, 8)}...{agent.id.substring(agent.id.length - 4)}
              </div>
            ))}
          </div>
        </div>

        {/* Center Panel - Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)', minHeight: 0 }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ padding: '8px 16px', backgroundColor: 'var(--bg-main)', color: 'var(--accent-primary)', fontSize: '13px', borderTop: '2px solid var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <File size={14} /> {activeItem?.name || 'No file selected'}
            </div>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {activeItem?.type === 'contract' && (
              <Editor
                height="100%"
                defaultLanguage="solidity"
                theme="vs-dark"
                value={getContractCode(activeItem.id)}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: 'var(--font-sans)',
                  scrollBeyondLastLine: false,
                  readOnly: true,
                }}
              />
            )}

            {activeItem?.type === 'agent' && (
              <div style={{ padding: '24px', overflowY: 'auto', height: '100%', fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#d4d4d4', backgroundColor: '#1e1e1e' }}>
                <div style={{ marginBottom: '16px', color: '#569cd6' }}>
                  <ShieldCheck style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} size={16} />
                  // AgentPrimitivesFactory: 7 Primitive Contract Statuses
                </div>
                
                {isLoadingAgent ? (
                  <div style={{ color: '#ce9178' }}>&gt; Fetching primitives from registry...</div>
                ) : agentPrimitives ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ color: '#6a9955', marginBottom: '8px' }}>/* Discovered primitives for {activeItem.name} */</div>
                    {[
                      { key: 'sovereign_agent', label: 'Sovereign Agent (Core)' },
                      { key: 'state_anchor', label: 'State Anchor' },
                      { key: 'reputation_registry', label: 'Reputation Registry' },
                      { key: 'slasher', label: 'Slasher' },
                      { key: 'verifier_registry', label: 'Verifier Registry' },
                      { key: 'compliance_gate', label: 'Compliance Gate' },
                      { key: 'agent_profile', label: 'Agent Profile' },
                    ].map((prim) => {
                      const address = agentPrimitives[prim.key as keyof typeof agentPrimitives];
                      const isValid = address && address !== '0x0000000000000000000000000000000000000000';
                      const paddedLabel = prim.label.padEnd(25, '.');
                      return (
                        <div key={prim.key} style={{ display: 'flex', gap: '16px' }}>
                          <span style={{ color: '#9cdcfe', minWidth: '220px' }}>{paddedLabel}</span>
                          <span style={{ color: isValid ? '#b5cea8' : '#808080', flex: 1 }}>{address || 'Not Registered'}</span>
                          <span>
                            {isValid ? <span style={{ color: '#4ec9b0' }}>[ OK ]</span> : <span style={{ color: '#f44336' }}>[ ERR ]</span>}
                          </span>
                        </div>
                      );
                    })}

                    {agentAis && (
                      <div style={{ marginTop: '24px', borderTop: '1px dashed #444', paddingTop: '16px' }}>
                        <div style={{ color: '#c586c0', marginBottom: '12px' }}>&gt; AIS_Telemetry_Snapshot()</div>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                          <span style={{ color: '#9cdcfe' }}>System.Score:</span>
                          <span style={{ fontSize: '18px', fontWeight: 'bold', color: agentAis.ais >= 700 ? '#4ec9b0' : '#d7ba7d' }}>
                            {agentAis.ais} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#808080' }}>/ 1000</span>
                          </span>
                        </div>
                        <div style={{ marginTop: '8px', display: 'flex', gap: '24px', color: '#d4d4d4' }}>
                          <div>Entropy: <span style={{ color: '#b5cea8' }}>{agentAis.components.entropy}</span></div>
                          <div>Grounding: <span style={{ color: '#b5cea8' }}>{agentAis.components.grounding}</span></div>
                          <div>Sacrifice: <span style={{ color: '#b5cea8' }}>{agentAis.components.sacrifice}</span></div>
                          <div>Compliance: <span style={{ color: '#b5cea8' }}>{agentAis.components.compliance}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#f44336' }}>[!] Agent not found in registry.</div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Panel - Terminal */}
      <div style={{ height: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-panel)', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>
          <Terminal size={14} /> System Console (tty1)
        </div>
        <div 
          ref={terminalRef}
          style={{ 
            flex: 1, padding: '12px', overflowY: 'auto', 
            fontSize: '13px', 
            display: 'flex', flexDirection: 'column', gap: '4px'
          }}
        >
          {logs.map((log, i) => (
            <div key={i} style={{ 
              color: log.includes('error') ? 'var(--danger)' : log.includes('success') ? 'var(--success)' : 'var(--text-secondary)',
              wordBreak: 'break-all'
            }}>
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
