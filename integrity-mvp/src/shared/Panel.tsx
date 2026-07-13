import React from 'react';

interface PanelProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ title, icon, action, children }) => (
  <div className="panel">
    <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon}
        {title}
      </span>
      {action}
    </div>
    {children}
  </div>
);
