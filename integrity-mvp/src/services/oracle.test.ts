import { describe, it, expect, vi, beforeEach } from 'vitest';
import { oracle, OracleError } from './oracle';
import { ORACLE_URL } from '../config';

describe('oracle client', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('getAgent hits the real GET /v1/agent/{id} path and returns parsed JSON', async () => {
        const body = { id: 'did:integrity:abc', verification_tier: 1 };
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: async () => body,
        });

        const result = await oracle.getAgent('did:integrity:abc');

        expect(fetch).toHaveBeenCalledWith(`${ORACLE_URL}/v1/agent/did%3Aintegrity%3Aabc`);
        expect(result).toEqual(body);
    });

    it('listAgents hits /v1/agents with no id interpolation', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => [] });
        await oracle.listAgents();
        expect(fetch).toHaveBeenCalledWith(`${ORACLE_URL}/v1/agents`);
    });

    it('getCompliance omits the covered_entity query param when not provided', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({}) });
        await oracle.getCompliance('did:integrity:abc');
        expect(fetch).toHaveBeenCalledWith(`${ORACLE_URL}/v1/agent/did%3Aintegrity%3Aabc/compliance`);
    });

    it('getCompliance includes the covered_entity query param when provided', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({}) });
        await oracle.getCompliance('did:integrity:abc', '0xCE');
        expect(fetch).toHaveBeenCalledWith(`${ORACLE_URL}/v1/agent/did%3Aintegrity%3Aabc/compliance?covered_entity=0xCE`);
    });

    it('throws OracleError with the real HTTP status on a non-ok response', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });
        await expect(oracle.getAgent('missing')).rejects.toMatchObject(
            expect.objectContaining({ status: 404 }) as Partial<OracleError>,
        );
    });

    it('getMarket appends the ?agent= query param only when provided', async () => {
        (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({}) });
        await oracle.getMarket('0xMarket');
        expect(fetch).toHaveBeenCalledWith(`${ORACLE_URL}/v1/markets/0xMarket`);

        await oracle.getMarket('0xMarket', '0xAgent');
        expect(fetch).toHaveBeenCalledWith(`${ORACLE_URL}/v1/markets/0xMarket?agent=0xAgent`);
    });
});
