import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../utils/useIsMobile';

export const CinematicHeader = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const isMobile = useIsMobile();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header style={{ 
            position: 'fixed', top: 0, width: '100%', zIndex: 100, 
            background: scrolled ? 'rgba(5, 13, 24, 0.9)' : 'transparent',
            backdropFilter: scrolled ? 'blur(20px)' : 'none',
            borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: scrolled ? (isMobile ? '12px 20px' : '12px 60px') : (isMobile ? '20px 20px' : '32px 60px')
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
                    <img 
                        src="/XibalbaSolutionsLogo.png" 
                        alt="Xibalba" 
                        style={{ height: isMobile ? '24px' : (scrolled ? '32px' : '48px'), transition: 'all 0.4s', filter: 'drop-shadow(0 0 10px rgba(212, 175, 55, 0.5))' }} 
                    />
                </div>
                
                {isMobile ? (
                    <button 
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <button onClick={() => { navigate('/settings'); window.scrollTo(0, 0); }} className="btn btn-outline" style={{ fontSize: '0.85rem', borderColor: 'rgba(255,255,255,0.3)', color: 'var(--text-primary)' }}>Sign In</button>
                        <button onClick={() => { navigate('/'); window.scrollTo(0, 0); }} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Launch Dashboard</button>
                    </div>
                )}
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobile && isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ 
                            background: 'var(--bg-main)', 
                            overflow: 'hidden',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            marginTop: '12px',
                            padding: '24px 0'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <button onClick={() => { navigate('/'); setIsMobileMenuOpen(false); window.scrollTo(0, 0); }} className="btn btn-primary">Launch Dashboard</button>
                            <button onClick={() => { window.open('https://github.com/XibalbaTechSol/integrity-master/tree/master/docs/wiki', '_blank'); setIsMobileMenuOpen(false); }} className="btn btn-outline" style={{ color: 'var(--text-primary)', borderColor: 'rgba(255,255,255,0.2)' }}>Protocol Blog</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
};
