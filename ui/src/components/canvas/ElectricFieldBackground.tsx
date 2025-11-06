/**
 * ElectricFieldBackground - Minimal aesthetic background animation
 * Floating gradient orbs with subtle grid overlay
 */

import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  opacity: number;
}

export function ElectricFieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbsRef = useRef<Orb[]>([]);
  const animationFrameRef = useRef<number>();
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Setup
    const updateSize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initOrbs();
    };

    // Initialize floating orbs
    const initOrbs = () => {
      orbsRef.current = [];
      const orbCount = 6; // Just a few large orbs

      for (let i = 0; i < orbCount; i++) {
        orbsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 150 + 100,
          hue: Math.random() * 30 + 20, // 20-50 (warm amber/orange)
          opacity: Math.random() * 0.2 + 0.08,
        });
      }
    };

    // Animation
    const animate = (timestamp: number) => {
      timeRef.current = timestamp;

      // Clear
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const orbs = orbsRef.current;

      // Draw subtle grid
      const gridSize = 80;
      const pulse = Math.sin(timestamp * 0.001) * 0.5 + 0.5;
      ctx.strokeStyle = `rgba(205, 133, 63, ${0.02 + pulse * 0.01})`;
      ctx.lineWidth = 0.5;

      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Update and draw orbs
      orbs.forEach((orb, i) => {
        // Update position
        orb.x += orb.vx;
        orb.y += orb.vy;

        // Bounce
        if (orb.x < -orb.radius || orb.x > canvas.width + orb.radius) orb.vx *= -1;
        if (orb.y < -orb.radius || orb.y > canvas.height + orb.radius) orb.vy *= -1;

        // Pulsing effect
        const pulse = Math.sin(timestamp * 0.002 + i) * 0.2 + 0.8;
        const currentRadius = orb.radius * pulse;

        // Gradient orb
        const gradient = ctx.createRadialGradient(
          orb.x,
          orb.y,
          0,
          orb.x,
          orb.y,
          currentRadius
        );

        gradient.addColorStop(0, `hsla(${orb.hue}, 100%, 50%, ${orb.opacity * pulse})`);
        gradient.addColorStop(0.5, `hsla(${orb.hue}, 100%, 40%, ${orb.opacity * 0.3 * pulse})`);
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Scanline effect
      const scanlineY = (timestamp * 0.05) % canvas.height;
      ctx.fillStyle = `rgba(218, 165, 32, 0.03)`;
      ctx.fillRect(0, scanlineY, canvas.width, 2);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Initialize
    updateSize();
    window.addEventListener('resize', updateSize);
    animate(0);

    // Cleanup
    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </Box>
  );
}
