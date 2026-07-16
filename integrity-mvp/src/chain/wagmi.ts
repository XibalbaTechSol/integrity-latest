import { http, createConfig } from 'wagmi';
import { base, baseSepolia, foundry } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { CHAIN_ID } from '../config';

// This app only ever targets one chain at a time (whatever VITE_CHAIN_ID
// resolves to — Base Sepolia 84532 by default, or 31337 for a local anvil
// dev stack per make chain) rather than offering the user a network switcher.
const CHAINS_BY_ID = { [base.id]: base, [baseSepolia.id]: baseSepolia, [foundry.id]: foundry };
export const activeChain = CHAINS_BY_ID[CHAIN_ID as keyof typeof CHAINS_BY_ID] ?? baseSepolia;

export const wagmiConfig = createConfig({
    chains: [activeChain],
    connectors: [injected()],
    transports: {
        [base.id]: http(),
        [baseSepolia.id]: http(),
        [foundry.id]: http(),
    },
});
