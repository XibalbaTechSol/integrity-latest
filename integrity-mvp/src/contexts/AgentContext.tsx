import React, { createContext, useContext, useEffect, useState } from 'react';
import { oracle } from '../services/oracle';

export interface Agent {
  id: string;
  name: string;
  did: string;
  status: 'ACTIVE' | 'IDLE' | 'ERROR';
}

interface AgentContextType {
  agents: Agent[];
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  selectedAgent: Agent | undefined;
  isLoading: boolean;
  loadError: string | null;
}

// The oracle doesn't return a human alias for a registered agent (only
// id/verification_tier/created_at — see GET /v1/agents), so "name" is
// derived from the DID rather than fabricated.
const displayNameFor = (did: string) => `Agent ${did.slice(-8)}`;

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    oracle.listAgents()
      .then(summaries => {
        if (cancelled) return;
        const mapped: Agent[] = summaries.map(s => ({
          id: s.id,
          did: s.id,
          name: displayNameFor(s.id),
          status: s.verification_tier >= 1 ? 'ACTIVE' : 'IDLE',
        }));
        setAgents(mapped);
        if (mapped.length > 0) setSelectedAgentId(mapped[0].id);
      })
      .catch(e => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to reach the oracle'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <AgentContext.Provider value={{ agents, selectedAgentId, setSelectedAgentId, selectedAgent, isLoading, loadError }}>
      {children}
    </AgentContext.Provider>
  );
};

export const useAgent = () => {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
};
