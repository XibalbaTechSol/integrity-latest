import React, { useState } from 'react';
import { GripVertical, Trash2, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WidgetWrapperProps {
  id: string;
  isEditing: boolean;
  onDelete: () => void;
  children: React.ReactNode;
}

export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ isEditing, onDelete, children }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div 
      className="card glass-panel"
      whileHover={isEditing ? { scale: 1.01 } : { y: -2, boxShadow: '0 12px 24px -10px rgba(0, 0, 0, 0.3)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '24px',
        boxSizing: 'border-box',
        border: '1px solid var(--border-color)',
        borderTop: '2px solid rgba(255,255,255,0.05)',
        borderBottom: '2px solid rgba(0,0,0,0.2)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-panel)',
        backdropFilter: 'blur(12px)',
        zIndex: 10
      }}
    >
      {/* Subtle top inner highlight */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} />

      {/* Notion-style Drag Handle on Hover (when editing) */}
      {isEditing && (
        <div 
          className="drag-handle" 
          style={{ 
            position: 'absolute', 
            top: '8px', 
            left: '8px', 
            cursor: 'grab', 
            zIndex: 30, 
            color: 'var(--text-muted)',
            padding: '4px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s, color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <GripVertical size={16} />
        </div>
      )}

      {/* Widget Control Bar (Floating / Hover Actions) */}
      {isEditing && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 30, display: 'flex', gap: '4px' }}>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="btn btn-sm btn-icon"
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              borderRadius: '4px',
              padding: '4px',
              color: 'var(--text-muted)'
            }}
          >
            <MoreHorizontal size={14} />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                style={{
                  position: 'absolute',
                  top: '28px',
                  right: 0,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '110px',
                  zIndex: 40
                }}
              >
                <button
                  onClick={() => {
                    onDelete();
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    color: 'var(--danger)',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  className="widget-action-delete"
                >
                  <Trash2 size={12} /> Delete Block
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Actual Widget Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginTop: isEditing ? '12px' : '0' }}>
        {children}
      </div>
    </motion.div>
  );
};
