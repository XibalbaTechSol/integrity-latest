import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

let initialized = false;

function ensureInitialized() {
    if (initialized) return;
    mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
            darkMode: true,
            background: 'transparent',
            primaryColor: 'rgba(255,255,255,0.05)',
            primaryTextColor: '#ffffff',
            primaryBorderColor: 'var(--primary, #4F8CFF)',
            lineColor: 'rgba(255,255,255,0.4)',
            secondaryColor: 'rgba(255,255,255,0.03)',
            tertiaryColor: 'rgba(255,255,255,0.03)',
            fontFamily: 'inherit',
        },
        securityLevel: 'strict',
    });
    initialized = true;
}

interface MermaidDiagramProps {
    chart: string;
    className?: string;
}

/**
 * Renders a Mermaid diagram client-side. `securityLevel: 'strict'` disallows
 * script/click bindings in the diagram source — every chart here is a static,
 * hardcoded string this codebase owns, never user-supplied, but strict mode
 * costs nothing and rules out a whole class of mistake if that ever changes.
 */
export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

    useEffect(() => {
        ensureInitialized();
        let cancelled = false;

        mermaid
            .render(idRef.current, chart)
            .then(({ svg }) => {
                if (!cancelled && containerRef.current) {
                    containerRef.current.innerHTML = svg;
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : String(err));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [chart]);

    if (error) {
        return (
            <div style={{ color: 'var(--danger, #ff6b6b)', fontSize: '0.85rem', padding: '16px' }}>
                Diagram failed to render: {error}
            </div>
        );
    }

    return <div ref={containerRef} className={className} style={{ width: '100%', overflowX: 'auto' }} />;
}
