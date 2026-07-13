import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Wallet, LogOut } from 'lucide-react';
import { useState } from 'react';

const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export const ConnectWalletButton = () => {
    const { address, isConnected } = useAccount();
    const { connectors, connect, isPending } = useConnect();
    const { disconnect } = useDisconnect();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    if (isConnected && address) {
        return (
            <div style={{ position: 'relative' }}>
                <div
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="glass-panel glass-panel-hover"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        border: '1px solid hsla(var(--accent-primary-hsl) / 0.5)',
                    }}
                >
                    <Wallet size={14} color="var(--accent-primary)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {shortenAddress(address)}
                    </span>
                </div>
                {isMenuOpen && (
                    <div className="glass-panel" style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                        width: '160px', borderRadius: 'var(--radius-md)', zIndex: 50, padding: '8px',
                        border: '1px solid hsla(var(--border-color-hsl) / 0.5)',
                    }}>
                        <div
                            onClick={() => { disconnect(); setIsMenuOpen(false); }}
                            className="glass-panel-hover"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                fontSize: '13px', color: 'var(--text-primary)',
                            }}
                        >
                            <LogOut size={14} /> Disconnect
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const injectedConnector = connectors.find(c => c.type === 'injected') ?? connectors[0];

    return (
        <button
            className="btn btn-primary"
            disabled={isPending || !injectedConnector}
            onClick={() => injectedConnector && connect({ connector: injectedConnector })}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}
        >
            <Wallet size={14} />
            {isPending ? 'Connecting...' : injectedConnector ? 'Connect Wallet' : 'No Wallet Found'}
        </button>
    );
};
