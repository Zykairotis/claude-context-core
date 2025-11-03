import * as React from 'react';
import { AlertTriangle, X, Database, Server, Box } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ErrorMessage } from '../types';

interface ErrorDisplayProps {
  errors: ErrorMessage[];
  onDismiss: (id: string) => void;
}

export function ErrorDisplay({ errors, onDismiss }: ErrorDisplayProps): JSX.Element | null {
  if (errors.length === 0) {
    return null;
  }

  const getSourceIcon = (source: ErrorMessage['source']) => {
    switch (source) {
      case 'postgres':
        return <Database size={16} />;
      case 'crawl4ai':
        return <Server size={16} />;
      case 'qdrant':
        return <Box size={16} />;
      default:
        return <AlertTriangle size={16} />;
    }
  };

  const getSourceColor = (source: ErrorMessage['source']): string => {
    switch (source) {
      case 'postgres':
        return '#3b82f6'; // blue
      case 'crawl4ai':
        return '#f97316'; // orange
      case 'qdrant':
        return '#a855f7'; // purple
      default:
        return '#ef4444'; // red
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '1rem', 
      right: '1rem', 
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      maxWidth: '400px',
      width: '100%'
    }}>
      {errors.map((error) => (
        <Card 
          key={error.id} 
          style={{ 
            border: `1px solid ${getSourceColor(error.source)}`,
            backgroundColor: 'rgba(239, 68, 68, 0.05)'
          }}
        >
          <CardContent style={{ 
            padding: '1rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start'
          }}>
            <div style={{ color: getSourceColor(error.source), marginTop: '0.125rem' }}>
              {getSourceIcon(error.source)}
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Badge 
                  variant="outline" 
                  style={{ 
                    borderColor: getSourceColor(error.source),
                    color: getSourceColor(error.source)
                  }}
                >
                  {error.source}
                </Badge>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {error.timestamp}
                </span>
              </div>
              
              <p style={{ 
                fontSize: '0.875rem', 
                fontWeight: 500,
                marginBottom: '0.25rem',
                color: '#1e293b'
              }}>
                {error.message}
              </p>
              
              {error.details && (
                <p style={{ 
                  fontSize: '0.75rem', 
                  color: '#64748b',
                  fontFamily: 'monospace'
                }}>
                  {error.details}
                </p>
              )}
            </div>

            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onDismiss(error.id)}
              style={{ padding: '0.25rem', height: 'auto' }}
            >
              <X size={16} />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

