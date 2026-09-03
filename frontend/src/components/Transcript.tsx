import React from 'react';

interface TranscriptProps {
  items: Array<{
    role: 'controller' | 'user' | 'system';
    text: string;
    timestamp: number;
    meta?: Record<string, any>;
  }>;
}

export function Transcript({ items }: TranscriptProps) {
  if (items.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
        Transcript will appear here...
      </div>
    );
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="transcript" role="log" aria-live="polite">
      {items.map((item, idx) => (
        <div key={idx} className={`transcript-item ${item.role}`}>
          <span className="transcript-role">
            {item.role === 'controller' ? 'CTL' : item.role === 'user' ? 'YOU' : 'SYS'}
          </span>
          <div className="transcript-text">{item.text}</div>
          <div className="transcript-meta">
            <span>{formatTime(item.timestamp)}</span>
            {item.meta?.cacheHit && <span>⚡ Cached</span>}
            {item.meta?.stepId && <span>Step: {item.meta.stepId}</span>}
            {item.meta?.templateId && <span>Template: {item.meta.templateId}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}