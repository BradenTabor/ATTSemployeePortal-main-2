/**
 * Confetti Component (Magic UI)
 * 
 * Confetti animations for celebrating user actions.
 * Adapted from Magic UI for the ATTS portal.
 */

import { memo, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { cn } from '../../lib/utils';

export interface ConfettiRef {
  fire: (options?: ConfettiOptions) => void;
}

export interface ConfettiOptions {
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
  origin?: { x: number; y: number };
  colors?: string[];
  shapes?: ('square' | 'circle')[];
  scalar?: number;
}

interface Particle {
  x: number;
  y: number;
  wobble: number;
  wobbleSpeed: number;
  velocity: number;
  angle2D: number;
  angle3D: number;
  tiltAngle: number;
  tiltAngleSpeed: number;
  color: string;
  shape: 'square' | 'circle';
  tick: number;
  totalTicks: number;
  decay: number;
  drift: number;
  gravity: number;
  scalar: number;
}

const defaultColors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669', '#047857'];

export const Confetti = memo(forwardRef<ConfettiRef, { className?: string }>(
  function Confetti({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animationRef = useRef<number | null>(null);

    const createParticle = useCallback((
      x: number,
      y: number,
      options: ConfettiOptions
    ): Particle => {
      const {
        startVelocity = 30,
        decay = 0.9,
        gravity = 3,
        drift = 0,
        ticks = 200,
        colors = defaultColors,
        shapes = ['square', 'circle'],
        scalar = 1,
        spread = 45,
      } = options;

      const angle = (spread / 2) * (Math.random() - 0.5) * (Math.PI / 180);
      
      return {
        x,
        y,
        wobble: Math.random() * 10,
        wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
        velocity: startVelocity * 0.5 + Math.random() * startVelocity,
        angle2D: -Math.PI / 2 + angle,
        angle3D: -(Math.PI / 4) + Math.random() * (Math.PI / 2),
        tiltAngle: Math.random() * Math.PI,
        tiltAngleSpeed: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        tick: 0,
        totalTicks: ticks,
        decay,
        drift,
        gravity,
        scalar,
      };
    }, []);

    // Use a ref to store the animate function to avoid temporal dead zone issues
    const animateFnRef = useRef<(() => void) | null>(null);

    const animate = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((particle) => {
        particle.tick++;
        
        if (particle.tick >= particle.totalTicks) return false;

        const progress = particle.tick / particle.totalTicks;
        const x = particle.x + Math.cos(particle.angle2D) * particle.velocity;
        const y = particle.y + Math.sin(particle.angle2D) * particle.velocity + particle.gravity * particle.tick * 0.05;
        
        particle.x = x + particle.drift + Math.sin(particle.wobble) * 2;
        particle.y = y;
        particle.wobble += particle.wobbleSpeed;
        particle.velocity *= particle.decay;
        particle.tiltAngle += particle.tiltAngleSpeed;

        const size = 10 * particle.scalar * (1 - progress * 0.5);
        const opacity = 1 - progress;

        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.tiltAngle);
        ctx.globalAlpha = opacity;
        ctx.fillStyle = particle.color;

        if (particle.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-size / 2, -size / 2, size, size);
        }

        ctx.restore();
        return true;
      });

      if (particlesRef.current.length > 0) {
        animationRef.current = requestAnimationFrame(animateFnRef.current!);
      } else {
        animationRef.current = null;
      }
    }, []);

    // Keep the ref updated with the latest animate function (in useEffect to avoid render-time ref mutation)
    useEffect(() => {
      animateFnRef.current = animate;
    }, [animate]);

    const fire = useCallback((options: ConfettiOptions = {}) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const {
        particleCount = 50,
        origin = { x: 0.5, y: 0.5 },
      } = options;

      const startX = canvas.width * origin.x;
      const startY = canvas.height * origin.y;

      for (let i = 0; i < particleCount; i++) {
        particlesRef.current.push(createParticle(startX, startY, options));
      }

      if (!animationRef.current && animateFnRef.current) {
        animateFnRef.current();
      }
    }, [createParticle]);

    useImperativeHandle(ref, () => ({ fire }), [fire]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const updateSize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };

      updateSize();
      window.addEventListener('resize', updateSize);

      return () => {
        window.removeEventListener('resize', updateSize);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        className={cn(
          'pointer-events-none fixed inset-0 z-[9999]',
          className
        )}
      />
    );
  }
));

export default Confetti;
