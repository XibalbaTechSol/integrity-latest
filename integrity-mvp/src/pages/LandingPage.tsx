import React, { useState } from 'react';
import { CinematicHeader } from '../components/landing/CinematicHeader';
import { HeroSection } from '../components/landing/HeroSection';
import { CinematicFooter } from '../components/landing/CinematicFooter';
import { RegistryExplorer } from '../components/ui/RegistryExplorer';
import { ContactModal } from '../components/ui/ContactModal';
import { MermaidDiagram } from '../components/ui/MermaidDiagram';
import { ShieldCheck, ChevronDown, CheckCircle, Activity, Lock, Send, Loader2 } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { motion, AnimatePresence } from 'framer-motion';

export const LandingPage = () => {
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [contactType, setContactType] = useState<'investor' | 'developer'>('investor');
    const [isRegistryOpen, setIsRegistryOpen] = useState(false);

    // Contact Form State for the inline form at the bottom
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        organization: '',
        inquiry_type: 'Investment & Institutional',
        message: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        try {
            const response = await fetch('https://integrity-protocol-backend.onrender.com/v1/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (response.ok) {
                setStatus('success');
                setTimeout(() => {
                    setStatus('idle');
                    setFormData({ ...formData, message: '' });
                }, 4000);
            } else {
                throw new Error('Form submission failed');
            }
        } catch (error) {
            console.error(error);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    // FAQs state
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const faqs = [
        { q: "How is the Agent Integrity Score (AIS) computed?", a: "AIS is a composite trust score computed exclusively by the Integrity Oracle. It weights four telemetry vectors (Entropy, Grounding, Sacrifice, and Compliance) and applies a 15% cryptographic boost when a valid Zero-Knowledge Proof (Barretenberg circuit) verifies the agent's behavior." },
        { q: "What is the Behavioral Commitment Chain (BCC)?", a: "The BCC is a pre-execution intent-locking protocol. Before acting, agents cryptographically sign a sorted-JSON commitment of their intended action and submit it to the BCC Middleware (an OPA policy gate). This enforces domain-specific guardrails before any API calls are made." },
        { q: "How does Xibalba Shield handle HIPAA compliance?", a: "Shield introduces Smart Business Associate Agreements (BAAs). These are on-chain parametric escrows where agents post slashable collateral (ITK tokens). Paired with the EHRGate, Shield enforces that Patient Consent, Active Smart BAAs, and a minimum AIS threshold are all met simultaneously." },
        { q: "Can an agent spoof its compliance or telemetry?", a: "No. Agent DID fingerprints strictly bind to their Ed25519 public keys. Telemetry is verified via ZK-Proofs preventing falsification, and the ComplianceGate performs live reads against the CoveredEntityRegistry and SmartBAAFactory to prevent self-declared compliance." }
    ];

    // LaTeX formulas for Tri-Metrics
    const aisFormula = "\\Delta_{AIS} = 1 - \\left( \\sum_{i=1}^{4} w_i S_i \\right) \\times ZK_{boost}";
    const bccFormula = "\\rho_{BCC} = \\frac{N_{blocked}}{N_{total}} \\times 100";
    const exposureFormula = "E_{risk} = \\int_{0}^{t} P(leak) \\cdot C_{staked} \\, dt";

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
        <div style={{ background: 'var(--navy-deep)', color: 'white', minHeight: '100vh', overflowX: 'hidden' }}>
            <CinematicHeader />
            
            {/* Hero Section */}
            <HeroSection setContactType={setContactType} setIsContactOpen={setIsContactOpen} />
            
                        <RegistryExplorer isOpen={isRegistryOpen} onClose={() => setIsRegistryOpen(false)} />
            
            {/* Business Proposal Content */}
            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 24px', display: 'flex', flexDirection: 'column', gap: '64px' }}>
                
                {/* 1. The Problem */}
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                        <div>
                            <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>The Problem</div>
                            <h2 style={{ fontSize: '2.8rem', fontFamily: 'Playfair Display, serif', marginBottom: '32px', lineHeight: 1.1 }}>Why AI Agents Can't Participate in the Economy &mdash; Yet</h2>
                        </div>
                        <button
                            onClick={() => setIsRegistryOpen(true)}
                            className="btn btn-secondary"
                            style={{ flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                        >
                            Look Up an Agent
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', color: 'rgba(255,255,255,0.7)', fontSize: '1.2rem', lineHeight: 1.8 }}>
                        <p>
                            Agents can reason, plan, and execute &mdash; but they can't <strong>transact</strong>. They can't sign contracts, prove they did what they committed to, or be held accountable when they drift. Without cryptographic execution guarantees and on-chain verification, no counterparty &mdash; human or machine &mdash; will trust an agent with real economic value.
                        </p>
                    </div>
                </section>

                {/* 2. Value Prop */}
                <section>
                    <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>Our Solution</div>
                    <h2 style={{ fontSize: '2.8rem', fontFamily: 'Playfair Display, serif', marginBottom: '24px', lineHeight: 1.1 }}>The Trust Layer</h2>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }}>
                        <div style={{ borderTop: '4px solid var(--primary)', background: 'rgba(255,255,255,0.03)', padding: '32px', borderRadius: '0 0 16px 16px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px' }}>Integrity Protocol</h3>
                            <p style={{ color: 'var(--primary)', fontWeight: 500, marginBottom: '16px' }}>Open Source Engine</p>
                            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                                A trustless, machine-verifiable protocol for autonomous agent transactions. Pre-execution intent gating, cryptographic commitment chains, ZK-proof verification, and on-chain settlement on Base L2 &mdash; enabling any AI agent to transact with mathematical certainty.
                            </p>
                        </div>
                        <div style={{ borderTop: '4px solid var(--gold)', background: 'rgba(255,255,255,0.03)', padding: '32px', borderRadius: '0 0 16px 16px' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px' }}>Xibalba Shield</h3>
                            <p style={{ color: 'var(--gold)', fontWeight: 500, marginBottom: '16px' }}>Agent Economy Control Plane</p>
                            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                                The SaaS layer for the agent economy. Centralized policy management, on-chain settlement orchestration, agent reputation dashboards, and compliance automation across verticals &mdash; starting with healthcare (HIPAA) and DeFi.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 3. Tri-Metric Risk Engine */}
                <section>
                    <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>Cornerstone Feature</div>
                    <h2 style={{ fontSize: '2.8rem', fontFamily: 'Playfair Display, serif', marginBottom: '24px', lineHeight: 1.1 }}>Closed-Loop Tri-Metric Risk Assessment</h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '48px', maxWidth: '800px' }}>
                        Our architecture evaluates trust via three immutable mathematical pillars, establishing a continuous closed-loop feedback cycle between execution and observation.
                    </p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', color: 'var(--gold)' }}>
                                <ShieldCheck size={24} />
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Agent Integrity Deficit</h3>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '1.1rem', color: 'var(--primary)' }}>
                                <BlockMath math={aisFormula} />
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', color: 'var(--danger)' }}>
                                <Lock size={24} />
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Intent Violation Rate</h3>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '1.1rem', color: 'var(--danger)' }}>
                                <BlockMath math={bccFormula} />
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', color: 'var(--primary)' }}>
                                <Activity size={24} />
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Collateral Exposure</h3>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '1.1rem', color: 'var(--primary)' }}>
                                <BlockMath math={exposureFormula} />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. How It Works */}
                <section>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '48px' }}>
                        <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>The Validation Lifecycle</div>
                        <h2 style={{ fontSize: '2.4rem', fontFamily: 'Playfair Display, serif', marginBottom: '24px' }}>How The Integrity Protocol Works</h2>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '32px' }}>
                            Autonomous agents are transacting on-chain &mdash; calling smart contracts, moving funds, approving tokens. The Integrity Protocol intercepts every agent action in a local pre-execution loop, ensuring <strong>unauthorized or non-compliant transactions are blocked instantly before any on-chain state change occurs.</strong>
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            <div style={{ display: 'flex', gap: '24px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, flexShrink: 0 }}>1</div>
                                <div>
                                    <h3 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Agent Proposes a Transaction</h3>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>An autonomous AI agent generates a reasoning trace and proposes an on-chain action &mdash; a smart contract call, a token transfer, a DEX swap, or a cross-protocol API request. The Integrity SDK serializes the intended state, hashes it with SHA-256, and signs it with the agent's hardware-bound DID private key. This signed commitment is locked to a 60-second TTL. No commitment, no execution.</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '24px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'var(--gold)', color: 'var(--navy-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, flexShrink: 0 }}>2</div>
                                <div>
                                    <h3 style={{ fontSize: '1.4rem', marginBottom: '12px' }}>BCC Validates Against Policy + Smart Contract Pre-Conditions</h3>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>The Behavioral Commitment Chain (BCC) middleware intercepts the request. It runs a validation sequence in order: TTL Check, AIS Threshold Check, Intent Hash Match, and OPA Policy Evaluation. If any gate fails, the transaction is killed and the failure is logged. No exceptions.</p>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '40px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '24px' }}>
                            <MermaidDiagram chart={validationLifecycleChart} />
                        </div>
                    </div>
                </section>

                {/* 5. FAQ */}
                <section>
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <div style={{ color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.8rem', fontWeight: 800, marginBottom: '16px' }}>Documentation</div>
                        <h2 style={{ fontSize: '2.8rem', fontFamily: 'Playfair Display, serif', margin: 0 }}>Frequently Asked Questions</h2>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {faqs.map((faq, idx) => (
                            <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                                <button 
                                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', textAlign: 'left' }}
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

                {/* 6. Contact Form (Proposal Acceptance) */}
                <section id="contact-proposal" style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: '100%', maxWidth: '800px', background: 'rgba(5, 13, 24, 0.8)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '24px', padding: '64px', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>
                        {status === 'success' ? (
                            <div style={{ textAlign: 'center', padding: '80px 0' }}>
                                <CheckCircle size={64} style={{ color: 'var(--gold)', margin: '0 auto 24px' }} />
                                <h2 style={{ fontSize: '2.5rem', marginBottom: '16px', fontFamily: 'Playfair Display, serif' }}>Proposal Inquiry Received</h2>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem' }}>Thank you. Our institutional onboarding team will review your requirements and respond shortly.</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                                    <span style={{ color: 'var(--gold)', fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Partnerships & Integration</span>
                                    <h2 style={{ fontSize: '2.8rem', marginTop: '16px', fontFamily: 'Playfair Display, serif' }}>Initiate Proposal</h2>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', marginTop: '16px' }}>Secure your autonomous infrastructure today.</p>
                                </div>

                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '700px', margin: '0 auto' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Full Name</label>
                                            <input required name="name" value={formData.name} onChange={handleChange} type="text" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Email Address</label>
                                            <input required name="email" value={formData.email} onChange={handleChange} type="email" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none' }} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Organization</label>
                                            <input name="organization" value={formData.organization} onChange={handleChange} type="text" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none' }} />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Inquiry Type</label>
                                            <select name="inquiry_type" value={formData.inquiry_type} onChange={handleChange} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none', appearance: 'none' }}>
                                                <option value="Investment & Institutional">Investment & Institutional</option>
                                                <option value="Developer Integration">Developer Integration</option>
                                                <option value="General Inquiry">General Inquiry</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Message Requirements</label>
                                        <textarea required name="message" value={formData.message} onChange={handleChange} rows={5} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: 'white', fontSize: '1rem', outline: 'none', resize: 'vertical' }} />
                                    </div>

                                    {status === 'error' && (
                                        <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>
                                            There was an error sending your message. Please try again.
                                        </div>
                                    )}

                                    <button 
                                        type="submit" 
                                        disabled={status === 'loading'}
                                        className="btn btn-primary" 
                                        style={{ padding: '20px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '1.1rem', fontWeight: 600 }}
                                    >
                                        {status === 'loading' ? (
                                            <><Loader2 className="animate-spin" size={20} /> Transmitting...</>
                                        ) : (
                                            <><Send size={20} /> Submit Proposal</>
                                        )}
                                    </button>
                                </form>
                            </>
                        )}
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
