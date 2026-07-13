import { ShieldCheck, Globe, Mail, MessageCircle } from 'lucide-react';

export const CinematicFooter = () => {
    return (
        <footer style={{ 
            background: 'var(--navy-deep)', 
            borderTop: '1px solid rgba(255,255,255,0.05)', 
            padding: '80px 40px 40px',
            color: 'white'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img 
                            src="/XibalbaSolutionsLogo.png" 
                            alt="Xibalba" 
                            style={{ height: '32px', filter: 'drop-shadow(0 0 10px rgba(212, 175, 55, 0.5))' }} 
                        />
                        <div>
                             <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.15em' }}>INTEGRITY</div>
                            <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.4)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em' }}>Xibalba Sovereign Protocol</div>
                        </div>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                        The deterministic trust layer for autonomous agents. Cryptographic guarantees over AI behavior for regulated industries.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                        <Globe size={20} color="rgba(255,255,255,0.6)" style={{ cursor: 'pointer' }} />
                        <MessageCircle size={20} color="rgba(255,255,255,0.6)" style={{ cursor: 'pointer' }} />
                        <Mail size={20} color="rgba(255,255,255,0.6)" style={{ cursor: 'pointer' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ color: 'var(--gold)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '8px' }}>Product</h4>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Xibalba Shield</a>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Integrity Oracle</a>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Smart BAAs</a>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Developer API</a>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ color: 'var(--gold)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '8px' }}>Resources</h4>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Documentation</a>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Whitepaper</a>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>ZK Circuits Wiki</a>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Status Page</a>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ color: 'var(--gold)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '8px' }}>Company</h4>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>About Us</a>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Careers</a>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Privacy Policy</a>
                    <a href="#" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.9rem' }}>Terms of Service</a>
                </div>
            </div>

            <div style={{ maxWidth: '1200px', margin: '60px auto 0', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                <div>&copy; {new Date().getFullYear()} Xibalba Technologies. All rights reserved.</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={14} color="var(--success)" />
                    <span>System Status: Fully Attested</span>
                </div>
            </div>
        </footer>
    );
};
