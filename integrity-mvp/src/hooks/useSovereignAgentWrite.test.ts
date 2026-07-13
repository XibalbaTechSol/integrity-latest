import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeFunctionData } from 'viem';
import { abis } from '../chain/abis';

const writeContractAsyncMock = vi.fn().mockResolvedValue('0xTxHash');
vi.mock('wagmi', () => ({
    useWriteContract: () => ({ writeContractAsync: writeContractAsyncMock, isPending: false }),
}));

// Imported after the mock so the hook picks up the mocked useWriteContract.
const { useSovereignAgentWrite } = await import('./useSovereignAgentWrite');

describe('useSovereignAgentWrite', () => {
    it('wraps every call in SovereignAgent.execute(target, value, calldata) — the one on-chain pattern every agent write must use', async () => {
        const { result } = renderHook(() => useSovereignAgentWrite());

        const sovereignAgent = '0x1111111111111111111111111111111111111111' as const;
        const target = '0x2222222222222222222222222222222222222222' as const;

        await act(async () => {
            await result.current.executeViaAgent({
                sovereignAgent,
                target,
                abi: abis.IntegrityToken,
                functionName: 'approve',
                args: [target, 100n],
            });
        });

        expect(writeContractAsyncMock).toHaveBeenCalledTimes(1);
        const call = writeContractAsyncMock.mock.calls[0][0];
        expect(call.address).toBe(sovereignAgent);
        expect(call.functionName).toBe('execute');

        const expectedCalldata = encodeFunctionData({
            abi: abis.IntegrityToken,
            functionName: 'approve',
            args: [target, 100n],
        });
        expect(call.args).toEqual([target, 0n, expectedCalldata]);
    });

    it('defaults value to 0n when not provided, and forwards a non-zero value when given', async () => {
        const { result } = renderHook(() => useSovereignAgentWrite());
        const sovereignAgent = '0x1111111111111111111111111111111111111111' as const;
        const target = '0x2222222222222222222222222222222222222222' as const;

        await act(async () => {
            await result.current.executeViaAgent({ sovereignAgent, target, abi: abis.IntegrityMarket, functionName: 'resolve', args: [0], value: 5n });
        });

        const call = writeContractAsyncMock.mock.calls.at(-1)?.[0];
        expect(call.args[1]).toBe(5n);
    });
});
