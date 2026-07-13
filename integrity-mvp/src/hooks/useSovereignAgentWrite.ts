import { encodeFunctionData, type Abi } from 'viem';
import { useWriteContract } from 'wagmi';
import { abis } from '../chain/abis';

/**
 * Every agent-attributable on-chain write in this protocol is routed through
 * the agent's own SovereignAgent.execute(target, value, calldata) — a raw
 * EOA can never call IntegrityMarket/XibalbaNameService/etc. directly (see
 * contracts/src/markets/IntegrityMarket.sol's AgentNotRegistered revert).
 * This hook is the one place that pattern is implemented for the frontend,
 * mirroring integrity_sdk/markets.py's _execute_via_agent and
 * integrity_cli/chain.py's _xns_send_via_agent.
 */
export function useSovereignAgentWrite() {
    const { writeContractAsync, ...rest } = useWriteContract();

    const executeViaAgent = async (params: {
        sovereignAgent: `0x${string}`;
        target: `0x${string}`;
        abi: Abi;
        functionName: string;
        args?: readonly unknown[];
        value?: bigint;
    }) => {
        const calldata = encodeFunctionData({
            abi: params.abi,
            functionName: params.functionName,
            args: params.args ?? [],
        });
        return writeContractAsync({
            address: params.sovereignAgent,
            abi: abis.SovereignAgent as Abi,
            functionName: 'execute',
            args: [params.target, params.value ?? 0n, calldata],
        });
    };

    return { executeViaAgent, ...rest };
}
