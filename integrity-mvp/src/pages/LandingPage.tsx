import { useState } from 'react';
import { CinematicHeader } from '../components/landing/CinematicHeader';
import { HeroSection } from '../components/landing/HeroSection';
import { CinematicFooter } from '../components/landing/CinematicFooter';
import { RegistryExplorer } from '../components/ui/RegistryExplorer';
import { ContactModal } from '../components/ui/ContactModal';
import { MermaidDiagram } from '../components/ui/MermaidDiagram';
import { TriMetricFunctions } from '../components/landing/TriMetricFunctions';
import { ShieldCheck, ChevronDown, Activity, Lock } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { motion, AnimatePresence } from 'framer-motion';

export const LandingPage = () => {
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [contactType, setContactType] = useState<'investor' | 'developer'>('investor');
    const [isRegistryOpen, setIsRegistryOpen] = useState(false);
    const [registryQuery, setRegistryQuery] = useState('');



    // FAQs state
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const faqs = [
      {
        "q": "How do agents sign and execute smart contracts through the Integrity Protocol?",
        "a": "Every agent registered with the Integrity Protocol receives a hardware-bound DID identity (did:intg:<address>) linked to an on-chain wallet on Base L2. When an agent proposes a transaction — signing a contract, moving funds, or committing to an SLA — the SDK serializes the intended state, hashes it with SHA-256, and cryptographically signs it with the agent's TEE-bound private key. The BCC middleware validates the commitment against the agent's Alignment Card policies before the transaction is broadcast to the chain. Only verified, policy-compliant transactions reach on-chain execution. This gives you deterministic finality for agent actions without trusting the agent's probabilistic reasoning."
      },
      {
        "q": "Does the pre-execution gating add latency to agent transactions?",
        "a": "No. The 4-gate validation pipeline (TTL check, AIS threshold, intent hash match, OPA policy evaluation) runs locally via lightweight BCC middleware in under 15ms — negligible compared to typical L2 block confirmation times (~2s on Base). The computationally heavy ZK-proof generation is processed completely asynchronously on a background queue and anchored to the chain after execution. Your agent's transaction throughput is never bottlenecked by the verification layer."
      },
      {
        "q": "What blockchains and L2s does Xibalba support?",
        "a": "Base L2 is the primary settlement and verification layer. We chose Base for its low gas costs, fast finality, and alignment with the Coinbase ecosystem — the largest fiat on-ramp for agent-to-human payments. The Integrity Protocol's smart contracts (SovereignAgent.sol, ReputationRegistry.sol) are written in standard Solidity and are fully EVM-compatible, meaning deployment to Arbitrum, Optimism, Polygon, or Ethereum mainnet requires zero code changes. We plan to add non-EVM support (Solana SVM, Cosmos IBC) based on ecosystem demand."
      },
      {
        "q": "How does on-chain verification work without exposing proprietary agent logic?",
        "a": "This is where ZK-proofs are essential. Aztec Noir circuits with UltraPlonk backend generate a zero-knowledge proof that the agent's reasoning trace complied with its Alignment Card policies — without revealing the prompts, model weights, tool calls, or any proprietary business logic. Only the cryptographic proof and a commitment hash are published on-chain. Any third party can verify the proof's validity (the agent acted within policy) without learning how it reasoned or what data it processed. This is critical for competitive agent operators who need verifiable trust without IP exposure."
      },
      {
        "q": "Can I define custom transaction policies beyond the default templates?",
        "a": "Absolutely. The policy engine uses Rego (Open Policy Agent), giving you full declarative control over your agent's behavioral boundaries. Default templates cover common patterns — spending limits, approved contract addresses, action-class whitelists, rate limiting — but you can write arbitrarily complex custom rules. Examples: cap a DeFi agent's single-swap exposure at 2% of portfolio, restrict an insurance-claims agent to approved ICD-10 codes, or require multi-sig human approval for transactions above a USD threshold. Policies are version-controlled and hot-reloadable without redeploying your agent."
      },
      {
        "q": "Is the SDK compatible with existing agent frameworks like LangChain, CrewAI, or AutoGen?",
        "a": "Yes. The Integrity SDK operates at the function execution and network interface layers — framework-agnostic by design. We provide drop-in wrappers for popular agent frameworks (LangChain, LlamaIndex, AutoGen, CrewAI) and raw LLM providers (OpenAI, Anthropic, Gemini). We also integrate natively with on-chain agent standards like ERC-6551 (token-bound accounts). If your agent can execute in Python or Node.js and interact with an EVM chain, Xibalba can wrap it with verifiable execution in under five minutes."
      },
      {
        "q": "What happens when an agent violates its policy in a live economic environment?",
        "a": "The violation is caught pre-execution — before any transaction hits the chain. The circuit breaker fires in <15ms, killing the action and isolating the session. From there, configurable responses kick in: Self-Correction loops return the violation reasoning to the agent so it can reformulate a compliant transaction; Fallback Routing escalates to human-in-the-loop approval; or the agent is automatically downgraded to read-only mode. The violation is logged immutably, the agent's on-chain AIS score is slashed, and counterparties are notified via the Reputation Registry. No bad transaction ever reaches settlement."
      },
      {
        "q": "How does the Agent Integrity Score (AIS) reputation system work on-chain?",
        "a": "Every agent's AIS (0–1000) is a domain-weighted composite of four on-chain metrics: behavioral entropy (how predictable and stable are its actions?), grounding (how often does a human need to intervene?), computational sacrifice (verified GPU-hours), and compliance (regulatory health). The score is recalculated in real-time by the Rust Axum telemetry engine and anchored to the ReputationRegistry.sol contract on Base L2. Counterparties can query any agent's AIS before entering a contract. Below 600, the agent operates pseudonymously with limited transaction scope. Above 700, it qualifies for institutional credit lines. At 850+, it earns TEE-bound institutional trust — the on-chain equivalent of a AAA credit rating for autonomous systems."
      },
      {
        "q": "How does Xibalba compare to Ritual, Autonolas, Fetch.ai, and Phala Network?",
        "a": "Ritual focuses on on-chain inference verification — proving a model produced a specific output. Autonolas/Olas provides a framework for composing multi-agent services with token incentives. Fetch.ai builds an agent-to-agent communication and discovery layer. Phala Network offers TEE-based confidential compute for smart contracts. Xibalba is none of these — and complementary to all of them. We are the pre-execution trust layer: the gating, reputation, and policy enforcement infrastructure that sits between an agent's intent and its on-chain action. Ritual verifies what happened; we prevent what shouldn't happen. Olas orchestrates agent services; we ensure each agent in the swarm is policy-compliant before it transacts. We integrate with these ecosystems rather than compete with them."
      },
      {
        "q": "What's the go-to-market strategy? Why start with healthcare?",
        "a": "Healthcare is our first vertical, not our identity. We chose it because HIPAA creates the highest regulatory bar for autonomous agent behavior — if our protocol can enforce compliance for an AI agent writing to an EHR with PHI exposure rules, it can enforce policy for any agent in any domain. The wedge is healthcare (HIPAA-compliant agent gating), but the platform is horizontal: DeFi agents executing swaps within risk parameters, insurance agents processing claims against policy rules, supply-chain agents committing to SLAs on-chain. Every vertical where an autonomous agent needs to prove it acted within boundaries before transacting is our market. The autonomous agent economy needs trust infrastructure the same way e-commerce needed SSL."
      }
    ];

    // LaTeX formulas for Tri-Metrics
    const aisFormula = "\\Delta_{\\text{AIS}} = 1 - \\left( \\sum_{i=1}^{4} w_i S_i \\right) \\times \\text{ZK}_{\\text{boost}}";
    const bccFormula = "\\rho_{\\text{BCC}} = \\frac{N_{\\text{blocked}}}{N_{\\text{total}}} \\times 100";
    const exposureFormula = "E_{\\text{risk}} = \\int_{0}^{t} P(\\text{leak}) \\cdot C_{\\text{staked}} \\, dt";

    const validationLifecycleChart = `
sequenceDiagram
    participant Agent as Autonomous Agent
    participant SDK as Integrity SDK
    participant BCC as BCC Middleware
    participant Chain as On-chain

    Agent->>SDK: Propose transaction
    SDK->>SDK: Hash intent (SHA-256)<br/>Sign with DID key<br/>60s TTL commitment
    SDK->>BCC: Signed commitment
    BCC->>BCC: TTL check
    BCC->>BCC: AIS threshold check
    BCC->>BCC: Intent hash match
    BCC->>BCC: OPA policy evaluation
    alt any gate fails
        BCC-->>Agent: Blocked (logged, no exceptions)
    else all gates pass
        BCC->>Chain: Execute
        Chain-->>Agent: State change confirmed
    end
`;

    return (
        <div style={{ background: 'var(--bg-main)', color: 'var(--text-primary)', minHeight: '100vh', overflowX: 'hidden' }}>
            <CinematicHeader />
            
            {/* Hero Section */}
            <HeroSection setContactType={setContactType} setIsContactOpen={setIsContactOpen} />
            
                        <RegistryExplorer isOpen={isRegistryOpen} onClose={() => setIsRegistryOpen(false)} initialQuery={registryQuery} />
            
            {/* Business Proposal Content */}
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 24px', display: 'flex', flexDirection: 'column', gap: '64px' }}>
                
                {/* 1. The Problem */}
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>The Problem</div>
                            <h2 style={{ fontSize: '2.8rem', fontFamily: 'inherit', marginBottom: '32px', lineHeight: 1.1 }}>Why AI Agents Can't Participate in the Economy &mdash; Yet</h2>
                        </div>
                        <div style={{ flexShrink: 0, background: 'hsla(var(--bg-panel-hsl) / 0.3)', border: '1px solid hsla(var(--border-color-hsl) / 0.5)', padding: '24px', borderRadius: '16px', minWidth: '320px' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Agent XNS Lookup</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="agent.xns"
                                    value={registryQuery}
                                    onChange={(e) => setRegistryQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && setIsRegistryOpen(true)}
                                    style={{ flex: 1, background: 'hsla(var(--bg-body-hsl) / 0.5)', border: '1px solid hsla(var(--border-color-hsl) / 0.3)', padding: '12px 16px', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                                />
                                <button
                                    onClick={() => setIsRegistryOpen(true)}
                                    className="btn btn-primary"
                                    style={{ padding: '0 24px', borderRadius: '8px' }}
                                >
                                    Lookup
                                </button>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', color: 'var(--text-secondary)', fontSize: '1.2rem', lineHeight: 1.8 }}>
                        <p>
                            Agents can reason, plan, and execute &mdash; but they can't <strong>transact</strong>. They can't sign contracts, prove they did what they committed to, or be held accountable when they drift. Without cryptographic execution guarantees and on-chain verification, no counterparty &mdash; human or machine &mdash; will trust an agent with real economic value.
                        </p>
                    </div>
                </section>

                {/* 2. Value Prop */}
                <section>
                    <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>Our Solution</div>
                    <h2 style={{ fontSize: '2.8rem', fontFamily: 'inherit', marginBottom: '24px', lineHeight: 1.1 }}>The Trust Layer</h2>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }}>
                        <div style={{ borderTop: '4px solid var(--primary)', background: 'hsla(var(--bg-panel-hsl) / 0.3)', padding: '32px', borderRadius: '0 0 16px 16px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px' }}>Integrity Protocol</h3>
                            <p style={{ color: 'var(--primary)', fontWeight: 500, marginBottom: '16px' }}>Open Source Engine</p>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                A trustless, machine-verifiable protocol for autonomous agent transactions. Pre-execution intent gating, cryptographic commitment chains, ZK-proof verification, and on-chain settlement on Base L2 &mdash; enabling any AI agent to transact with mathematical certainty.
                            </p>
                        </div>
                        <div style={{ borderTop: '4px solid var(--gold)', background: 'hsla(var(--bg-panel-hsl) / 0.3)', padding: '32px', borderRadius: '0 0 16px 16px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px' }}>Xibalba Shield</h3>
                            <p style={{ color: 'var(--gold)', fontWeight: 500, marginBottom: '16px' }}>Agent Economy Control Plane</p>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                The SaaS layer for the agent economy. Centralized policy management, on-chain settlement orchestration, agent reputation dashboards, and compliance automation across verticals &mdash; starting with healthcare (HIPAA) and DeFi.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 3. Tri-Metric Risk Engine */}
                <section>
                    <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>Cornerstone Feature</div>
                    <h2 style={{ fontSize: '2.8rem', fontFamily: 'inherit', marginBottom: '24px', lineHeight: 1.1 }}>Closed-Loop Tri-Metric Risk Assessment</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '48px', maxWidth: '800px' }}>
                        Our architecture evaluates trust via three immutable mathematical pillars, establishing a continuous closed-loop feedback cycle between execution and observation.
                    </p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        <div style={{ background: 'hsla(var(--bg-panel-hsl) / 0.3)', border: '1px solid hsla(var(--border-color-hsl) / 0.5)', borderRadius: '16px', padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', color: 'var(--gold)' }}>
                                <ShieldCheck size={24} />
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Agent Integrity Deficit</h3>
                            </div>
                            <div style={{ background: 'hsla(var(--bg-panel-hsl) / 0.5)', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '1.1rem', color: 'var(--primary)' }}>
                                <BlockMath math={aisFormula} />
                            </div>
                        </div>

                        <div style={{ background: 'hsla(var(--bg-panel-hsl) / 0.3)', border: '1px solid hsla(var(--border-color-hsl) / 0.5)', borderRadius: '16px', padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', color: 'var(--danger)' }}>
                                <Lock size={24} />
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Intent Violation Rate</h3>
                            </div>
                            <div style={{ background: 'hsla(var(--bg-panel-hsl) / 0.5)', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '1.1rem', color: 'var(--danger)' }}>
                                <BlockMath math={bccFormula} />
                            </div>
                        </div>

                        <div style={{ background: 'hsla(var(--bg-panel-hsl) / 0.3)', border: '1px solid hsla(var(--border-color-hsl) / 0.5)', borderRadius: '16px', padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', color: 'var(--primary)' }}>
                                <Activity size={24} />
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Collateral Exposure</h3>
                            </div>
                            <div style={{ background: 'hsla(var(--bg-panel-hsl) / 0.5)', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '1.1rem', color: 'var(--primary)' }}>
                                <BlockMath math={exposureFormula} />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3b. The real AIS component score functions, plotted */}
                <TriMetricFunctions />

                {/* 4. How It Works */}
                <section>
                    <div style={{ background: 'hsla(var(--bg-panel-hsl) / 0.3)', border: '1px solid hsla(var(--border-color-hsl) / 0.5)', borderRadius: '16px', padding: '48px' }}>
                        <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>The Validation Lifecycle</div>
                        <h2 style={{ fontSize: '2.4rem', fontFamily: 'inherit', marginBottom: '24px' }}>How The Integrity Protocol Works</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '32px' }}>
                            Autonomous agents are transacting on-chain &mdash; calling smart contracts, moving funds, approving tokens. The Integrity Protocol intercepts every agent action in a local pre-execution loop, ensuring <strong>unauthorized or non-compliant transactions are blocked instantly before any on-chain state change occurs.</strong>
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div style={{ display: 'flex', gap: '24px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'var(--primary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, flexShrink: 0 }}>1</div>
                                <div>
                                    <h3 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Agent Proposes a Transaction</h3>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>An autonomous AI agent generates a reasoning trace and proposes an on-chain action &mdash; a smart contract call, a token transfer, a DEX swap, or a cross-protocol API request. The Integrity SDK serializes the intended state, hashes it with SHA-256, and signs it with the agent's hardware-bound DID private key. This signed commitment is locked to a 60-second TTL. No commitment, no execution.</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '24px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'var(--gold)', color: 'var(--navy-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, flexShrink: 0 }}>2</div>
                                <div>
                                    <h3 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>BCC Validates Against Policy + Smart Contract Pre-Conditions</h3>
                                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>The Behavioral Commitment Chain (BCC) middleware intercepts the request. It runs a validation sequence in order: TTL Check, AIS Threshold Check, Intent Hash Match, and OPA Policy Evaluation. If any gate fails, the transaction is killed and the failure is logged. No exceptions.</p>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '40px', background: 'hsla(var(--bg-panel-hsl) / 0.5)', borderRadius: '12px', padding: '24px' }}>
                            <MermaidDiagram chart={validationLifecycleChart} />
                        </div>
                    </div>
                </section>

                {/* 5. FAQ */}
                <section>
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>Documentation</div>
                        <h2 style={{ fontSize: '2.8rem', fontFamily: 'inherit', margin: 0 }}>Frequently Asked Questions</h2>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {faqs.map((faq, idx) => (
                            <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid hsla(var(--border-color-hsl) / 0.5)', borderRadius: '12px', overflow: 'hidden' }}>
                                <button 
                                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}
                                >
                                    <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{faq.q}</span>
                                    <ChevronDown size={20} style={{ transform: openFaq === idx ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
                                </button>
                                <AnimatePresence>
                                    {openFaq === idx && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            style={{ overflow: 'hidden' }}
                                        >
                                            <div style={{ padding: '0 24px 24px 24px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                                                {faq.a}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </section>


                
            </div>

            <CinematicFooter />

            {/* Modals triggered from Hero Section */}
            <ContactModal 
                isOpen={isContactOpen} 
                onClose={() => setIsContactOpen(false)} 
                initialType={contactType} 
            />
        </div>
    );
};
