import React, { useEffect, useRef } from 'react';
import { useThemeStore } from '../stores/themes';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
}

const GenerativeBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, active: false, clickBurst: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check prefers-reduced-motion for accessibility
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let width = document.documentElement.clientWidth;
    let height = document.documentElement.clientHeight;
    const pixelRatio = window.devicePixelRatio || 1;

    const resize = () => {
      width = document.documentElement.clientWidth;
      height = document.documentElement.clientHeight;
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      ctx.scale(pixelRatio, pixelRatio);
    };

    window.addEventListener('resize', resize);
    resize();

    // Resolve Theme Colors from Computed Styles dynamically
    const getColors = () => {
      const computed = getComputedStyle(document.documentElement);
      const bg = computed.getPropertyValue('--bg').trim() || '#0d0f14';
      const accent = computed.getPropertyValue('--accent').trim() || '#3b82f6';
      const green = computed.getPropertyValue('--green').trim() || '#22d47a';
      const border = computed.getPropertyValue('--border').trim() || '#252a38';
      return { bg, accent, green, border };
    };

    let colors = getColors();

    const particles: Particle[] = [];
    const particleCount = prefersReducedMotion ? 20 : 120;

    const createParticle = (initRandom = false): Particle => {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * 1.5 + 0.8;
      const maxLife = Math.random() * 200 + 100;
      
      // Dynamic colors from our theme palette
      const colorRand = Math.random();
      let color = colors.accent;
      if (colorRand > 0.85) {
        color = colors.green;
      } else if (colorRand > 0.7) {
        color = '#a78bfa'; // Purple highlight for nice cyber aesthetic
      }

      return {
        x,
        y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size,
        color,
        alpha: 0,
        maxLife,
        life: initRandom ? Math.random() * maxLife : 0,
      };
    };

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle(true));
    }

    // Mouse events
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleMouseDown = () => {
      mouseRef.current.clickBurst = 1.0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousedown', handleMouseDown);

    let time = 0;

    // Draw tech grid blueprint overlay
    const drawGrid = (ctx: CanvasRenderingContext2D, t: number) => {
      ctx.save();
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 0.5;
      
      // Radar lines rotating slowly in center
      const cx = width / 2;
      const cy = height / 2;
      
      // Concentric structural rings
      ctx.globalAlpha = 0.05;
      for (let r = 100; r < Math.max(width, height); r += 150) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + Math.sin(t * 0.0005 + r) * 10, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Drawing rotating blueprint diagonals
      ctx.globalAlpha = 0.03;
      ctx.beginPath();
      const angle = t * 0.00005;
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 4;
        const dx = Math.cos(a) * Math.max(width, height);
        const dy = Math.sin(a) * Math.max(width, height);
        ctx.moveTo(cx - dx, cy - dy);
        ctx.lineTo(cx + dx, cy + dy);
      }
      ctx.stroke();
      ctx.restore();
    };

    // Render loop
    const render = () => {
      time++;
      
      // Smoothly update theme colors in case they changed
      if (time % 30 === 0) {
        colors = getColors();
      }

      // Clear the canvas. We use solid fill since alpha-trails are handled
      // by custom fading particles and rendering properties.
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, width, height);

      // Blueprint tech grid
      if (!prefersReducedMotion) {
        drawGrid(ctx, time);
      }

      // Smooth mouse interpolation
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;
      
      if (mouse.clickBurst > 0.01) {
        mouse.clickBurst *= 0.93; // Decay factor
      }

      // Update & Draw particles
      particles.forEach((p, idx) => {
        // Flow field vector based on trigonometric wave functions
        const angle = 
          Math.sin(p.x * 0.003 + time * 0.002) * Math.cos(p.y * 0.003 - time * 0.001) * Math.PI * 2;
        
        // Base flow field forces
        let fx = Math.cos(angle) * 0.06;
        let fy = Math.sin(angle) * 0.06;

        // Interaction with mouse
        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);
          const limit = 240;

          if (dist < limit) {
            const force = (limit - dist) / limit;
            
            // Swirl + attract forces
            const swirlAngle = Math.atan2(dy, dx) + Math.PI / 2;
            const swirlX = Math.cos(swirlAngle) * force * 0.28;
            const swirlY = Math.sin(swirlAngle) * force * 0.28;
            
            const attractX = (dx / dist) * force * 0.12;
            const attractY = (dy / dist) * force * 0.12;

            fx += swirlX + attractX;
            fy += swirlY + attractY;

            // Handle click shockwave burst
            if (mouse.clickBurst > 0.01) {
              const repelX = -(dx / dist) * mouse.clickBurst * 6.0;
              const repelY = -(dy / dist) * mouse.clickBurst * 6.0;
              p.vx += repelX;
              p.vy += repelY;
            }
          }
        }

        // Apply force with inertia
        p.vx += fx;
        p.vy += fy;

        // Drag/friction to prevent infinite acceleration
        p.vx *= 0.95;
        p.vy *= 0.95;

        // Apply velocity
        p.x += p.vx;
        p.y += p.vy;

        // Life cycle
        p.life++;
        if (p.life < 40) {
          p.alpha = p.life / 40; // Fade in
        } else if (p.life > p.maxLife - 40) {
          p.alpha = (p.maxLife - p.life) / 40; // Fade out
        } else {
          p.alpha = 1;
        }

        // Out of bounds or dead check
        if (
          p.x < -20 || p.x > width + 20 || 
          p.y < -20 || p.y > height + 20 || 
          p.life >= p.maxLife
        ) {
          particles[idx] = createParticle();
        }

        // Draw particle / vector trail
        ctx.save();
        ctx.beginPath();
        ctx.shadowBlur = 4;
        ctx.shadowColor = p.color;
        ctx.globalAlpha = p.alpha * 0.45;
        ctx.fillStyle = p.color;
        
        const len = Math.hypot(p.vx, p.vy);
        if (!prefersReducedMotion && len > 0.01) {
          // Draw as a short vector velocity line for slick movement streak
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          ctx.strokeStyle = p.color;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - (p.vx / len) * (4 + len * 2), p.y - (p.vy / len) * (4 + len * 2));
          ctx.stroke();
        } else {
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (!prefersReducedMotion) {
      render();
    } else {
      // Just render static canvas elements for low energy/accessibility
      colors = getColors();
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, width, height);
      drawGrid(ctx, 42);
      // draw static points
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.2;
        ctx.fill();
      });
    }

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousedown', handleMouseDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, [currentTheme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
};

export default GenerativeBackground;
