import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Lock, CheckCircle, Loader2, AlertCircle, XCircle } from 'lucide-react';
import { useAccount, useSignMessage } from 'wagmi';
import { readContract } from '@wagmi/core';
import { verifyMessage } from 'viem';
import { useToast } from '../contexts/ToastContext';
import { wagmiConfig } from '../chain/wagmi';
import { abis } from '../chain/abis';
import { singleton } from '../chain/deployments';

interface ClaimAgentModalProps {
  isOpen: boolean;
  defaultAddress?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * "Claiming" an agent you don't already control isn't a real on-chain
 * concept in this protocol — SovereignAgent.rotateController() is
 * onlyController-gated, there is no challenge/signature scheme for a
 * third party to take over an agent (see docs/wiki/WIKI_LOG.md's
 * 2026-07-12 backend-infra-audit entry). What IS real and buildable: a
 * connected wallet either already IS an agent's on-chain controller or it
 * isn't — this modal now verifies that directly against
 * XibalbaAgentRegistry, plus a real personal_sign as an extra
 * "prove you hold this key right now" confirmation step. No transaction is
 * submitted; none is needed.
 */
export function ClaimAgentModal({ isOpen, defaultAddress = '', onClose, onSuccess }: ClaimAgentModalProps) {
  const { addToast } = useToast();
  const { address: connectedAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [step, setStep] = useState(1);
  const [sovereignAgentInput, setSovereignAgentInput] = useState(defaultAddress);
  const [isResolving, setIsResolving] = useState(false);
  const [onChainController, setOnChainController] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleResolveController = async () => {
    if (!sovereignAgentInput.startsWith('0x') || sovereignAgentInput.length !== 42) {
      addToast('error', 'Enter a valid SovereignAgent contract address');
      return;
    }
    setIsResolving(true);
    setResolveError(null);
    try {
      const record = await readContract(wagmiConfig, {
        address: singleton('XibalbaAgentRegistry'),
        abi: abis.XibalbaAgentRegistry,
        functionName: 'resolveAgent',
        args: [sovereignAgentInput as `0x${string}`],
      });
      const controller = (record as { controller: string }).controller;
      if (!controller || controller === '0x0000000000000000000000000000000000000000') {
        setResolveError('No registered agent found at this address.');
        return;
      }
      setOnChainController(controller);
      setStep(2);
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to read the on-chain registry.');
    } finally {
      setIsResolving(false);
    }
  };

  const controllerMatches = onChainController && connectedAddress
    && onChainController.toLowerCase() === connectedAddress.toLowerCase();

  const handleVerifySignature = async () => {
    if (!connectedAddress) {
      addToast('error', 'Connect a wallet first.');
      return;
    }
    setIsSigning(true);
    try {
      const message = `I am verifying control of SovereignAgent ${sovereignAgentInput} at ${new Date().toISOString()}`;
      const signature = await signMessageAsync({ message });
      const valid = await verifyMessage({ address: connectedAddress, message, signature });
      if (valid && controllerMatches) {
        setVerified(true);
        addToast('success', 'Control verified — this wallet is the agent\'s registered controller.');
      } else if (valid && !controllerMatches) {
        addToast('error', "Signature is valid, but this wallet is not this agent's on-chain controller.");
      } else {
        addToast('error', 'Signature verification failed.');
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Signing failed or was rejected.');
    } finally {
      setIsSigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'var(--bg-main)', opacity: 0.85, backdropFilter: 'blur(8px)' }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '500px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--gold-muted)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}
      >
        <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--navy-light)' }}>
          <div className="flex items-center gap-3">
            <Shield size={20} color="var(--gold)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Verify Agent Control</h3>
          </div>
          <button onClick={onClose} className="btn btn-icon" aria-label="Close modal"><X size={20} /></button>
        </div>

        <div style={{ padding: 'var(--space-8)' }}>
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-col gap-6">
                <div className="flex-col gap-2">
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>SovereignAgent Contract Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="input mono"
                    value={sovereignAgentInput}
                    onChange={(e) => setSovereignAgentInput(e.target.value)}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Reads the real on-chain controller from XibalbaAgentRegistry — not a claim/transfer, just a lookup.
                  </p>
                </div>
                {resolveError && (
                  <div style={{ display: 'flex', gap: '8px', color: 'var(--danger)', fontSize: '0.8rem' }}>
                    <XCircle size={16} /> {resolveError}
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleResolveController}
                  disabled={isResolving || !sovereignAgentInput}
                >
                  {isResolving ? <><Loader2 className="spin" size={18} /> Reading registry...</> : 'Look Up Controller'}
                </button>
              </motion.div>
            ) : (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-col gap-6">
                <div style={{ padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 800 }}>
                    <Lock size={14} /> ON-CHAIN CONTROLLER
                  </div>
                  <div className="mono" style={{ fontSize: '0.8rem', wordBreak: 'break-all', opacity: 0.8 }}>
                    {onChainController}
                  </div>
                </div>

                {!isConnected ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Connect a wallet (top bar) to continue.</div>
                ) : !controllerMatches ? (
                  <div style={{ display: 'flex', gap: '8px', color: 'var(--danger)', fontSize: '0.8rem' }}>
                    <XCircle size={16} /> Connected wallet ({connectedAddress?.slice(0, 10)}...) does not match this agent's controller.
                  </div>
                ) : !verified ? (
                  <button className="btn btn-primary" onClick={handleVerifySignature} disabled={isSigning}>
                    {isSigning ? <><Loader2 className="spin" size={18} /> Signing...</> : 'Sign to Verify Control'}
                  </button>
                ) : (
                  <div className="flex-col gap-4">
                    <div style={{ padding: 'var(--space-4)', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--success)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <CheckCircle size={20} color="var(--success)" />
                      <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>Control verified</div>
                    </div>
                    <button className="btn btn-primary" onClick={onSuccess}>
                      Done
                    </button>
                  </div>
                )}

                <button className="btn btn-ghost btn-sm" onClick={() => { setStep(1); setVerified(false); }}>
                  Back to Address
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ padding: 'var(--space-4) var(--space-8)', background: 'var(--bg-secondary)', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <AlertCircle size={16} color="var(--text-muted)" />
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>
            This only verifies control of an agent whose controller is already your connected wallet — there is no
            on-chain mechanism to take over an agent controlled by someone else.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
