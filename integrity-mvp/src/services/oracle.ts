import { ORACLE_URL } from '../config';

// Mirrors integrity-oracle/backend/src/handlers.rs's response DTOs exactly —
// keep in sync with spec/ais-api/v1/openapi.yaml if that surface changes.

export interface PrimitiveSetDto {
    sovereign_agent: string;
    state_anchor: string;
    reputation_registry: string;
    slasher: string;
    verifier_registry: string;
    compliance_gate: string;
    agent_profile: string;
}

export interface AgentResponse {
    id: string;
    verification_tier: number;
    last_nonce: number;
    created_at: string;
    has_ed25519_key: boolean;
    has_eth_address: boolean;
    primitives: PrimitiveSetDto | null;
    primitives_source: string;
    did_document: Record<string, unknown> | null;
}

export interface AgentSummary {
    id: string;
    verification_tier: number;
    created_at: string;
}

export interface AisComponents {
    entropy: number;
    grounding: number;
    sacrifice: number;
    compliance: number;
}

export interface AisResponse {
    agent_id: string;
    ais: number;
    components: AisComponents;
    weights: Record<string, number>;
    zk_boost: number;
    zk_proof_verified: boolean;
    period_start: string;
    period_end: string;
    event_count: number;
    onchain_zk_boost_consistent: boolean | null;
}

export interface ComplianceResponse {
    agent_id: string;
    vertical: string;
    is_compliant: boolean;
    covered_entity: string | null;
}

export interface WalletPositionDto {
    market_address: string;
    question: string;
    outcome_index: number;
    amount: string;
    market_resolved: boolean;
    won: boolean | null;
}

export interface WalletResponse {
    agent_id: string;
    sovereign_agent: string;
    itk_balance: string;
    open_positions: WalletPositionDto[];
    transaction_history: unknown[] | null;
}

export interface MarketSummaryDto {
    address: string;
    creator: string;
    question: string;
    outcome_count: number;
    min_ais_to_enter: string;
    resolve_deadline: string;
    resolved: boolean;
    winning_outcome: number | null;
    total_staked: string;
    outcome_staked: string[];
}

export interface PositionDto {
    amount: string;
    outcome_index: number;
    bcc_commitment_hash: string;
    claimed: boolean;
}

export interface MarketDetailDto extends MarketSummaryDto {
    your_position: PositionDto | null;
    positions_note: string;
}

export interface LeaderboardEntryDto {
    agent_id: string;
    sovereign_agent: string;
    effective_score: string;
    realized_pnl: string | null;
}

export interface TelemetryEventDetailDto {
    id: string;
    agent_id: string;
    nonce: number;
    performance_variance: number;
    hgi_raw: number;
    gpu_hours_verified: number;
    flagged: boolean;
    zk_verified: boolean;
    leaf_hash: string;
    payload: unknown;
    merkle_root_id: string | null;
    leaf_index: number | null;
    created_at: string;
}

export interface AgentJudgeEvaluationDto {
    id: string;
    agent_id: string;
    run_id: string;
    judge_model: string;
    verdict: string;
    score: number | null;
    rationale_summary: string | null;
    telemetry_event_id: string | null;
    created_at: string;
}

class OracleError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${ORACLE_URL}${path}`);
    if (!res.ok) {
        throw new OracleError(res.status, `Oracle request failed: ${res.status} ${path}`);
    }
    return res.json();
}

export const oracle = {
    getAgent: (id: string) => get<AgentResponse>(`/v1/agent/${encodeURIComponent(id)}`),
    listAgents: () => get<AgentSummary[]>('/v1/agents'),
    getAis: (id: string) => get<AisResponse>(`/v1/agent/${encodeURIComponent(id)}/ais`),
    getCompliance: (id: string, coveredEntity?: string) =>
        get<ComplianceResponse>(
            `/v1/agent/${encodeURIComponent(id)}/compliance${coveredEntity ? `?covered_entity=${coveredEntity}` : ''}`,
        ),
    getWallet: (id: string) => get<WalletResponse>(`/v1/agent/${encodeURIComponent(id)}/wallet`),
    listMarkets: () => get<MarketSummaryDto[]>('/v1/markets'),
    getMarket: (address: string, agent?: string) =>
        get<MarketDetailDto>(`/v1/markets/${address}${agent ? `?agent=${agent}` : ''}`),
    getLeaderboard: () => get<LeaderboardEntryDto[]>('/v1/leaderboard'),
    getTelemetry: (id: string) => get<TelemetryEventDetailDto[]>(`/v1/agent/${encodeURIComponent(id)}/telemetry`),
    getTraces: (id: string) => get<AgentJudgeEvaluationDto[]>(`/v1/agent/${encodeURIComponent(id)}/traces`),
};

export { OracleError };
