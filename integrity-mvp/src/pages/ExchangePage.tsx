import { useEffect, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { oracle, type MarketSummaryDto } from '../services/oracle';
import { SeededDataBadge } from '../shared/SeededDataBadge';
import { useAccount } from 'wagmi';
import { waitForTransactionReceipt, readContract } from '@wagmi/core';
import { parseUnits } from 'viem';
import { useAgent } from '../contexts/AgentContext';
import { useToast } from '../contexts/ToastContext';
import { useSovereignAgentWrite } from '../hooks/useSovereignAgentWrite';
import { wagmiConfig } from '../chain/wagmi';
import { abis } from '../chain/abis';
import { singleton } from '../chain/deployments';

// Illustrative market trend data — IntegrityMarket is a pari-mutuel
// pool. We simulate a historical trend based on the current probability.

const yesNoSplit = (market: MarketSummaryDto) => {
  const staked = market.outcome_staked.map(Number);
  const total = staked.reduce((a, b) => a + b, 0);
  if (total === 0) return { yes: 50, no: 50 };
  const yes = Math.round(((staked[0] ?? 0) / total) * 100);
  return { yes, no: 100 - yes };
};

export const ExchangePage = () => {
  const [markets, setMarkets] = useState<MarketSummaryDto[]>([]);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [selectedMarket, setSelectedMarket] = useState<MarketSummaryDto | null>(null);
  const [outcome, setOutcome] = useState<0 | 1>(0);
  const [amount, setAmount] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { address, isConnected } = useAccount();
  const { selectedAgent } = useAgent();
  const { addToast } = useToast();
  const { executeViaAgent } = useSovereignAgentWrite();

  useEffect(() => {
    let cancelled = false;
    oracle.listMarkets()
      .then(data => { if (!cancelled) { setMarkets(data); if (data.length && !selectedMarket) setSelectedMarket(data[0]); } })
      .catch(e => { if (!cancelled) setMarketsError(e instanceof Error ? e.message : 'Failed to reach the oracle'); })
      .finally(() => { if (!cancelled) setMarketsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlaceOrder = async () => {
    if (!isConnected || !address) {
      addToast('error', 'Connect a wallet first.');
      return;
    }
    if (!selectedAgent) {
      addToast('error', 'No agent selected — select one from the top bar.');
      return;
    }
    if (!selectedMarket) {
      addToast('error', 'Select a market first.');
      return;
    }
    const amountWei = (() => {
      try {
        return parseUnits(amount, 18);
      } catch {
        return null;
      }
    })();
    if (!amountWei || amountWei <= 0n) {
      addToast('error', 'Enter a valid stake amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const agent = await oracle.getAgent(selectedAgent.id);
      const sovereignAgent = agent.primitives?.sovereign_agent as `0x${string}` | undefined;
      if (!sovereignAgent) {
        addToast('error', 'This agent has no registered on-chain primitives yet.');
        return;
      }

      const registryRecord = await readContract(wagmiConfig, {
        address: singleton('XibalbaAgentRegistry'),
        abi: abis.XibalbaAgentRegistry,
        functionName: 'resolveAgent',
        args: [sovereignAgent],
      });
      const controller = (registryRecord as { controller: string }).controller;
      if (controller.toLowerCase() !== address.toLowerCase()) {
        addToast('error', `Connected wallet is not this agent's controller (expected ${controller.slice(0, 10)}...).`);
        return;
      }

      const itkAddress = singleton('IntegrityToken');

      addToast('info', 'Approving ITK spend...');
      const approveHash = await executeViaAgent({
        sovereignAgent,
        target: itkAddress,
        abi: abis.IntegrityToken,
        functionName: 'approve',
        args: [selectedMarket.address, amountWei],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

      addToast('info', 'Submitting position...');
      // No BCC intent commitment is signed by this frontend yet (that's a
      // separate off-chain flow via integrity-sdk/bcc_middleware) — the
      // contract itself never validates this hash, it's purely stored for
      // later cross-referencing, so a zero hash is honest here, not faked.
      const enterHash = await executeViaAgent({
        sovereignAgent,
        target: selectedMarket.address as `0x${string}`,
        abi: abis.IntegrityMarket,
        functionName: 'enterPosition',
        args: [outcome, amountWei, `0x${'0'.repeat(64)}`],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash: enterHash });

      addToast('success', 'Position entered.');
      oracle.listMarkets().then(setMarkets).catch(() => {});
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Transaction failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentYes = selectedMarket ? yesNoSplit(selectedMarket).yes : 50;
  const historicalProbabilityData = [
    { time: 'T-24h', yes: Math.max(0, currentYes - 20) },
    { time: 'T-12h', yes: Math.max(0, currentYes - 15) },
    { time: 'T-6h', yes: Math.max(0, currentYes - 5) },
    { time: 'T-2h', yes: Math.max(0, currentYes - 2) },
    { time: 'Now', yes: currentYes },
  ];

  return (
    <div className="main-content">
      <TopBar title="Markets Escrow" />
      
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--space-6)', height: 'calc(100vh - 120px)' }}>
          
          {/* Left Column: Escrow Analytics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            
            {/* Implied Probability Trend */}
            <div className="card" style={{ flex: '1 1 60%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Implied Probability Trend
                  <SeededDataBadge label="Historical trend simulated" />
                </h2>
                {selectedMarket && (
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
                    <div style={{ color: 'var(--success)' }}>YES {yesNoSplit(selectedMarket).yes}%</div>
                    <div style={{ color: 'var(--danger)' }}>NO {yesNoSplit(selectedMarket).no}%</div>
                  </div>
                )}
              </div>
              
              <div style={{ height: '80%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historicalProbabilityData}>
                    <defs>
                      <linearGradient id="colorYes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)' }} />
                    <Area type="monotone" dataKey="yes" stroke="var(--success)" strokeWidth={2} fillOpacity={1} fill="url(#colorYes)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Escrow Lockup Visualizer */}
            <div className="card" style={{ flex: '1 1 40%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Active Escrow Lockups
                <SeededDataBadge label="Simulated positions" />
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Market</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>ETH {'>'} $3500 by EOFY</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Locked Stake</div>
                    <div style={{ fontSize: '1.1rem', color: 'var(--success)', fontWeight: 700 }}>500 ITK <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(YES)</span></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Est. Payout</div>
                    <div style={{ fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 700 }}>850 ITK</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Market</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>FED Rate Cut Q3</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Locked Stake</div>
                    <div style={{ fontSize: '1.1rem', color: 'var(--danger)', fontWeight: 700 }}>250 ITK <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(NO)</span></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Est. Payout</div>
                    <div style={{ fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 700 }}>310 ITK</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Execution Panel & Active Markets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            
            {/* Execution Panel — real IntegrityMarket.enterPosition write */}
            <div className="card">
              <h2 className="panel-title" style={{ marginBottom: '8px' }}>Place Order</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {selectedMarket ? selectedMarket.question : 'Select a market below'}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setOutcome(0)}
                  style={{ flex: 1, background: outcome === 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: `1px solid var(--success)`, opacity: outcome === 0 ? 1 : 0.6 }}
                >
                  Stake YES
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setOutcome(1)}
                  style={{ flex: 1, background: outcome === 1 ? 'rgba(244, 63, 94, 0.25)' : 'rgba(244, 63, 94, 0.1)', color: 'var(--danger)', border: `1px solid var(--danger)`, opacity: outcome === 1 ? 1 : 0.6 }}
                >
                  Stake NO
                </button>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Amount (ITK)</label>
                <input type="text" className="input-field" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                disabled={isSubmitting || !selectedMarket || !isConnected}
                onClick={handlePlaceOrder}
              >
                {isSubmitting ? 'Submitting...' : !isConnected ? 'Connect wallet to trade' : 'Confirm Trade'}
              </button>
            </div>

            {/* Active Prediction Markets — real oracle data */}
            <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
              <h2 className="panel-title" style={{ marginBottom: '16px' }}>Active Markets</h2>

              {marketsError && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', wordBreak: 'break-word' }}>Could not reach the Integrity Oracle ({marketsError}).</div>}
              {!marketsError && marketsLoading && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading...</div>}
              {!marketsError && !marketsLoading && markets.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No markets deployed yet.</div>
              )}

              {markets.map((market) => {
                const { yes, no } = yesNoSplit(market);
                const isSelected = selectedMarket?.address === market.address;
                return (
                  <div
                    key={market.address}
                    onClick={() => setSelectedMarket(market)}
                    style={{ cursor: 'pointer', background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '12px', border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}` }}
                  >
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px', lineHeight: 1.4 }}>{market.question}</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--success)' }}>Yes {yes}%</span>
                      <span style={{ color: 'var(--danger)' }}>No {no}%</span>
                    </div>

                    <div style={{ height: '6px', background: 'var(--bg-panel-hover)', borderRadius: '3px', display: 'flex', overflow: 'hidden' }}>
                      <div style={{ width: `${yes}%`, background: 'var(--success)' }}></div>
                      <div style={{ width: `${no}%`, background: 'var(--danger)' }}></div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                      {market.resolved ? 'Resolved' : `Total staked: ${market.total_staked} ITK`}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};
