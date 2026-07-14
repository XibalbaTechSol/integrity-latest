import { useEffect, useRef, useState } from 'react';
import { oracle, type StreamEvent, type AisResponse } from '../services/oracle';

interface UseOracleStreamResult {
    /** Rolling buffer of the most recent frames, newest first, capped at maxEvents. */
    events: StreamEvent[];
    /** True once the browser's EventSource has actually opened the connection. */
    connected: boolean;
    /** The most recent AisUpdate frame, if any have arrived this session. */
    latestAis: AisResponse | null;
}

/**
 * Subscribes to the oracle's real SSE stream (GET /v1/stream or
 * /v1/agent/{id}/stream — see backend/src/stream.rs) via the browser's native
 * EventSource, which reconnects automatically on a dropped connection, so this hook
 * needs no manual retry logic of its own. Pass `agentId` to scope to one agent,
 * omit it to receive every agent's events.
 */
export function useOracleStream(agentId?: string, maxEvents = 50): UseOracleStreamResult {
    const [events, setEvents] = useState<StreamEvent[]>([]);
    const [connected, setConnected] = useState(false);
    const [latestAis, setLatestAis] = useState<AisResponse | null>(null);
    const maxEventsRef = useRef(maxEvents);
    maxEventsRef.current = maxEvents;

    useEffect(() => {
        const source = new EventSource(oracle.streamUrl(agentId));

        source.onopen = () => setConnected(true);
        source.onerror = () => setConnected(false);

        const handleFrame = (raw: MessageEvent<string>) => {
            let event: StreamEvent;
            try {
                event = JSON.parse(raw.data);
            } catch {
                return;
            }
            setEvents((prev) => [event, ...prev].slice(0, maxEventsRef.current));
            if (event.type === 'AisUpdate') {
                const { type: _type, ...ais } = event;
                setLatestAis(ais as AisResponse);
            }
        };

        source.addEventListener('telemetry', handleFrame);
        source.addEventListener('otel_span', handleFrame);
        source.addEventListener('ais_update', handleFrame);

        return () => {
            source.close();
            setConnected(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentId]);

    return { events, connected, latestAis };
}
