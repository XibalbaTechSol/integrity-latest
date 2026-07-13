import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AgentProvider, useAgent } from './AgentContext';

vi.mock('../services/oracle', () => ({
    oracle: {
        listAgents: vi.fn().mockResolvedValue([
            { id: 'did:integrity:aaaaaaaabbbbbbbb', verification_tier: 1, created_at: '2026-01-01T00:00:00Z' },
            { id: 'did:integrity:ccccccccdddddddd', verification_tier: 0, created_at: '2026-01-02T00:00:00Z' },
        ]),
    },
}));

const Probe = () => {
    const { agents, selectedAgentId, isLoading } = useAgent();
    if (isLoading) return <div>loading</div>;
    return (
        <div>
            <div data-testid="count">{agents.length}</div>
            <div data-testid="selected">{selectedAgentId}</div>
            <div data-testid="status-0">{agents[0]?.status}</div>
            <div data-testid="status-1">{agents[1]?.status}</div>
        </div>
    );
};

describe('AgentContext', () => {
    it('populates real agents from the oracle instead of the old hardcoded 3-agent fixture', async () => {
        render(
            <AgentProvider>
                <Probe />
            </AgentProvider>,
        );

        await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
        expect(screen.getByTestId('selected')).toHaveTextContent('did:integrity:aaaaaaaabbbbbbbb');
        // verification_tier >= 1 maps to ACTIVE, 0 maps to IDLE
        expect(screen.getByTestId('status-0')).toHaveTextContent('ACTIVE');
        expect(screen.getByTestId('status-1')).toHaveTextContent('IDLE');
    });
});
