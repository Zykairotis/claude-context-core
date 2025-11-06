/**
 * DataEdge - Custom edge component with animations and stats
 */

import { EdgeProps, getBezierPath } from 'reactflow';
import { alpha } from '@mui/material';

export function DataEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Edge colors based on type
  const edgeColors = {
    data: '#cd853f',      // Amber/gold for data flow
    trigger: '#a78bfa',   // Purple for triggers
    control: '#f472b6',   // Pink for control flow
  };

  const edgeType = data?.type || 'data';
  const color = edgeColors[edgeType as keyof typeof edgeColors] || edgeColors.data;
  const isAnimated = data?.animated || false;

  return (
    <>
      {/* Glow effect for selected edges */}
      {selected && (
        <path
          d={edgePath}
          strokeWidth={8}
          stroke={alpha(color, 0.2)}
          fill="none"
          style={{
            filter: `blur(8px)`,
          }}
        />
      )}

      {/* Main edge path */}
      <path
        id={id}
        className={isAnimated ? 'react-flow__edge-path animated-edge' : 'react-flow__edge-path'}
        d={edgePath}
        strokeWidth={selected ? 3 : 2}
        stroke={color}
        strokeOpacity={selected ? 1 : 0.6}
        fill="none"
        style={{
          filter: `drop-shadow(0 0 4px ${alpha(color, 0.4)})`,
          transition: 'all 0.2s',
        }}
      />

      {/* Stats label */}
      {data?.label && (
        <text>
          <textPath
            href={`#${id}`}
            style={{
              fontSize: 10,
              fill: color,
              fontWeight: 600,
              filter: `drop-shadow(0 0 2px ${alpha('#000', 0.8)})`,
            }}
            startOffset="50%"
            textAnchor="middle"
          >
            {data.label}
          </textPath>
        </text>
      )}

      {/* Interactive hit area */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />

      {/* Add CSS for animated edge */}
      {isAnimated && (
        <style>
          {`
            @keyframes dash {
              to {
                stroke-dashoffset: -24;
              }
            }
            .animated-edge {
              stroke-dasharray: 8, 4;
              animation: dash 0.5s linear infinite;
            }
          `}
        </style>
      )}
    </>
  );
}
