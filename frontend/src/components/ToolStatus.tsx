import React from 'react';

interface ToolStatusProps {
  tools: Array<{
    name: string;
    status: 'idle' | 'active' | 'completed' | 'cancelled';
    detail?: string;
    startTime?: number;
  }>;
  onCancel: (toolName: string) => void;
}

export function ToolStatus({ tools, onCancel }: ToolStatusProps) {
  const activeTools = tools.filter(t => t.status === 'active');
  const completedTools = tools.filter(t => t.status === 'completed');
  const cancelledTools = tools.filter(t => t.status === 'cancelled');
  const allTools = [...activeTools, ...completedTools, ...cancelledTools];

  if (allTools.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
        No tool activity yet. Try saying "Book a flight to Tokyo" or "Find hotels in Paris".
      </div>
    );
  }

  return (
    <div className="tool-status">
      {allTools.map((tool) => (
        <div key={tool.name} className={`tool-status-item ${tool.status}`}>
          <span className="tool-status-indicator" />
          <div className="tool-status-info">
            <div className="tool-status-name">
              {tool.name === 'search_flights' ? '✈️ Flight Search' : '🏨 Hotel Search'}
            </div>
            <div className="tool-status-detail">
              {tool.detail || (
                tool.status === 'active' 
                  ? `Running for ${Math.floor((Date.now() - (tool.startTime || Date.now())) / 1000)}s...`
                  : tool.status === 'completed'
                    ? 'Completed'
                    : 'Cancelled by user'
              )}
            </div>
          </div>
          {tool.status === 'active' && (
            <button
              className="tool-status-cancel"
              onClick={() => onCancel(tool.name)}
              aria-label={`Cancel ${tool.name}`}
            >
              Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  );
}