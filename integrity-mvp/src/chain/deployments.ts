import baseSepolia from '../deployments/deployments.baseSepolia.json';
import local from '../deployments/deployments.local.json';
import { CHAIN_ID } from '../config';

interface Deployments {
    chainId: number;
    network: string;
    singletons: Record<string, string>;
    cloneTemplates: Record<string, string>;
    protocolAddresses: Record<string, string>;
    domains: Record<string, string>;
}

const BY_CHAIN_ID: Record<number, Deployments> = {
    [baseSepolia.chainId]: baseSepolia as Deployments,
    [local.chainId]: local as Deployments,
};

export const deployments: Deployments = BY_CHAIN_ID[CHAIN_ID] ?? (baseSepolia as Deployments);

export const singleton = (name: string): `0x${string}` => {
    const address = deployments.singletons[name];
    if (!address) {
        throw new Error(`No singleton address for "${name}" in deployments for chain ${CHAIN_ID}`);
    }
    return address as `0x${string}`;
};
