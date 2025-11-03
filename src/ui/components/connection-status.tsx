import * as React from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface ConnectionStatusProps {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  onReconnect?: () => void;
  lastUpdate?: string;
}

export function ConnectionStatus({ status, onReconnect, lastUpdate }: ConnectionStatusProps): JSX.Element {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <Wifi size={14} />,
          label: 'Live',
          variant: 'default' as const,
          color: '#22c55e'
        };
      case 'connecting':
        return {
          icon: <RefreshCw size={14} className="animate-spin" />,
          label: 'Connecting...',
          variant: 'secondary' as const,
          color: '#eab308'
        };
      case 'error':
        return {
          icon: <AlertTriangle size={14} />,
          label: 'Error',
          variant: 'accent' as const,
          color: '#ef4444'
        };
      case 'disconnected':
      default:
        return {
          icon: <WifiOff size={14} />,
          label: 'Offline',
          variant: 'outline' as const,
          color: '#94a3b8'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {/* Heartbeat indicator dot */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: config.color,
          animation: status === 'connected' ? 'heartbeat 1.5s ease-in-out infinite' : 'none',
          boxShadow: status === 'connected' ? `0 0 8px ${config.color}` : 'none'
        }}
      />
      
      <Badge variant={config.variant} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {config.icon}
        {config.label}
      </Badge>
      
      {lastUpdate && status === 'connected' && (
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Last update: {lastUpdate}
        </span>
      )}

      {(status === 'disconnected' || status === 'error') && onReconnect && (
        <Button variant="outline" size="sm" onClick={onReconnect}>
          <RefreshCw size={14} /> Reconnect
        </Button>
      )}
      
      {/* Inject heartbeat animation */}
      <style>{`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

