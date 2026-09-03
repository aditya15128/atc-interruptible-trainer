import React from 'react';

interface ProviderBadgeProps {
  provider: 'rime' | 'fallback';
}

export function ProviderBadge({ provider }: ProviderBadgeProps) {
  return (
    <span className={`provider-badge ${provider}`}>
      {provider === 'rime' ? '🟢 Rime' : '🟡 Fallback'}
    </span>
  );
}