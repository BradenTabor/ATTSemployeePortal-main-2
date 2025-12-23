import { memo, useEffect, useRef, useCallback } from 'react';

interface BackgroundParticlesProps {
  /** Number of particles to render */
  count?: number;
  /** Base color for particles (CSS color) */
  color?: string;
  /** Secondary accent color for variety */
  accentColor?: string;
  /** Minimum particle size in pixels */
  minSize?: number;
  /** Maximum particle size in pixels */
  maxSize?: number;
  /** Additional CSS class names */
  className?: string;
  /** Enable connecting lines between nearby particles */
  enableConnections?: boolean;
  /** Enable shooting star effects */
  enableShootingStars?: boolean;
  /** Enable mouse interaction */
  enableMouseInteraction?: boolean;
  /** Number of depth layers for parallax effect */
  layers?: number;
  /** Enable sparkle burst effects */
  enableSparkles?: boolean;
  /** Enable firefly pulsing behavior */
  enableFireflies?: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  baseSpeedY: number;
  baseSpeedX: number;
  opacity: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  layer: number;
  hue: number;
  pulsePhase: number;
  trail: { x: number; y: number; opacity: number }[];
  // Organic noise motion
  noiseOffsetX: number;
  noiseOffsetY: number;
  noiseSpeed: number;
  // Firefly behavior
  isFirefly: boolean;
  fireflyPhase: number;
  fireflySpeed: number;
  fireflyIntensity: number;
  // Color shift
  colorPhase: number;
  colorSpeed: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  life: number;
  maxLife: number;
}

interface Sparkle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotationSpeed: number;
}

interface MouseState {
  x: number;
  y: number;
  active: boolean;
  velocity: { x: number; y: number };
  lastX: number;
  lastY: number;
}

// Simple pseudo-random noise function for organic motion
const noise = (x: number, y: number, seed: number): number => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
};

// Smooth interpolation
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

// Lerp color components
const lerpColor = (
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number },
  t: number
) => ({
  r: Math.round(c1.r + (c2.r - c1.r) * t),
  g: Math.round(c1.g + (c2.g - c1.g) * t),
  b: Math.round(c1.b + (c2.b - c1.b) * t),
});

/**
 * Premium canvas-based animated floating particles background effect.
 * Features: multi-layer parallax, organic noise motion, connecting lines,
 * shooting stars, sparkles, fireflies, mouse interaction, and luxurious glow effects.
 */
function EnhancedCanvasParticles({
  count = 80,
  color = 'rgba(247, 228, 189, 1)',
  accentColor = 'rgba(255, 215, 120, 1)',
  minSize = 1,
  maxSize = 4,
  className = '',
  enableConnections = true,
  enableShootingStars = true,
  enableMouseInteraction = true,
  layers = 3,
  enableSparkles = true,
  enableFireflies = true,
}: BackgroundParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const sparklesRef = useRef<Sparkle[]>([]);
  const mouseRef = useRef<MouseState>({ 
    x: 0, y: 0, active: false, 
    velocity: { x: 0, y: 0 }, 
    lastX: 0, lastY: 0 
  });
  const timeRef = useRef(0);
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const frameCountRef = useRef(0);

  // Parse color to extract RGB values
  const parseColor = useCallback((colorStr: string) => {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    }
    // Premium gold default (matches ATTS branding)
    return { r: 247, g: 228, b: 189 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const baseColor = parseColor(color);
    const accent = parseColor(accentColor);
    
    // Create highlight color (brighter version)
    const highlight = {
      r: Math.min(255, baseColor.r + 40),
      g: Math.min(255, baseColor.g + 40),
      b: Math.min(255, baseColor.b + 20),
    };

    // Resize handler with proper DPR support
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const width = rect.width;
      const height = Math.max(
        rect.height,
        parent.scrollHeight,
        document.documentElement.scrollHeight,
        window.innerHeight
      );

      if (canvas.width === Math.floor(width * dpr) && 
          canvas.height === Math.floor(height * dpr)) {
        return;
      }

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      dimensionsRef.current = { width, height };

      if (particlesRef.current.length === 0) {
        initParticles(width, height);
      } else {
        particlesRef.current.forEach(p => {
          if (p.y > height) p.y = Math.random() * height;
          if (p.x > width) p.x = Math.random() * width;
        });
      }
    };

    // Initialize particles across multiple layers with enhanced properties
    const initParticles = (width: number, height: number) => {
      particlesRef.current = Array.from({ length: count }, (_, i) => {
        const layer = i % layers;
        const layerFactor = (layer + 1) / layers;
        const isFirefly = enableFireflies && Math.random() > 0.85; // 15% are fireflies
        
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          size: (Math.random() * (maxSize - minSize) + minSize) * layerFactor,
          speedY: -(Math.random() * 0.35 + 0.06) * layerFactor,
          speedX: (Math.random() - 0.5) * 0.2 * layerFactor,
          baseSpeedY: -(Math.random() * 0.35 + 0.06) * layerFactor,
          baseSpeedX: (Math.random() - 0.5) * 0.2 * layerFactor,
          opacity: (Math.random() * 0.5 + 0.3) * layerFactor,
          baseOpacity: (Math.random() * 0.5 + 0.3) * layerFactor,
          twinkleSpeed: Math.random() * 0.012 + 0.006,
          twinkleOffset: Math.random() * Math.PI * 2,
          layer,
          hue: Math.random() > 0.7 ? 1 : 0,
          pulsePhase: Math.random() * Math.PI * 2,
          trail: [],
          // Organic noise motion
          noiseOffsetX: Math.random() * 1000,
          noiseOffsetY: Math.random() * 1000,
          noiseSpeed: Math.random() * 0.0008 + 0.0004,
          // Firefly behavior
          isFirefly,
          fireflyPhase: Math.random() * Math.PI * 2,
          fireflySpeed: Math.random() * 0.03 + 0.015,
          fireflyIntensity: Math.random() * 0.5 + 0.5,
          // Color shift
          colorPhase: Math.random() * Math.PI * 2,
          colorSpeed: Math.random() * 0.002 + 0.001,
        };
      });
    };

    // Create shooting star
    const createShootingStar = (width: number, height: number) => {
      if (Math.random() > 0.0015) return;
      
      shootingStarsRef.current.push({
        x: Math.random() * width * 0.8,
        y: Math.random() * height * 0.25,
        length: Math.random() * 100 + 50,
        speed: Math.random() * 10 + 8,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.4,
        opacity: 1,
        life: 0,
        maxLife: Math.random() * 35 + 25,
      });
    };

    // Create sparkle burst
    const createSparkle = (x: number, y: number) => {
      if (sparklesRef.current.length > 20) return; // Limit sparkles
      
      const count = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < count; i++) {
        sparklesRef.current.push({
          x: x + (Math.random() - 0.5) * 30,
          y: y + (Math.random() - 0.5) * 30,
          size: Math.random() * 4 + 2,
          opacity: 1,
          life: 0,
          maxLife: Math.random() * 20 + 15,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
        });
      }
    };

    // Draw a 4-pointed star shape
    const drawStar = (x: number, y: number, size: number, rotation: number, opacity: number, color: { r: number; g: number; b: number }) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
      gradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.8})`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const outerX = Math.cos(angle) * size * 2;
        const outerY = Math.sin(angle) * size * 2;
        const innerAngle = angle + Math.PI / 4;
        const innerX = Math.cos(innerAngle) * size * 0.4;
        const innerY = Math.sin(innerAngle) * size * 0.4;
        
        if (i === 0) {
          ctx.moveTo(outerX, outerY);
        } else {
          ctx.lineTo(outerX, outerY);
        }
        ctx.lineTo(innerX, innerY);
      }
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Center glow
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.fill();
      
      ctx.restore();
    };

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      if (!enableMouseInteraction) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top + window.scrollY;
      
      const isWithinBounds = x >= 0 && x <= rect.width && 
                             e.clientY >= rect.top && e.clientY <= rect.bottom;
      
      // Calculate velocity for trail effects
      const vx = x - mouseRef.current.lastX;
      const vy = y - mouseRef.current.lastY;
      
      mouseRef.current = {
        x,
        y,
        active: isWithinBounds,
        velocity: { x: vx * 0.3 + mouseRef.current.velocity.x * 0.7, y: vy * 0.3 + mouseRef.current.velocity.y * 0.7 },
        lastX: x,
        lastY: y,
      };
      
      // Trigger sparkles on fast mouse movement
      if (enableSparkles && isWithinBounds && Math.abs(vx) + Math.abs(vy) > 15) {
        if (Math.random() > 0.7) {
          createSparkle(x, y);
        }
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    let resizeObserver: ResizeObserver | null = null;
    const parent = canvas.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(resizeCanvas);
      });
      resizeObserver.observe(parent);
    }

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(resizeCanvas);
    });
    mutationObserver.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: false 
    });
    
    if (enableMouseInteraction) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    // Main animation loop - optimized
    const animate = () => {
      const { width, height } = dimensionsRef.current;
      if (width === 0 || height === 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      timeRef.current += 0.016;
      frameCountRef.current++;
      const time = timeRef.current;

      // Shooting stars (optimized - skip some frames for creation check)
      if (enableShootingStars && frameCountRef.current % 2 === 0) {
        createShootingStar(width, height);
      }
      
      // Update and draw shooting stars
      shootingStarsRef.current = shootingStarsRef.current.filter(star => {
        star.life++;
        star.x += Math.cos(star.angle) * star.speed;
        star.y += Math.sin(star.angle) * star.speed;
        
        // Smooth fade out with easing
        const lifeProgress = star.life / star.maxLife;
        star.opacity = 1 - smoothstep(lifeProgress);

        if (star.opacity <= 0.01) return false;

        // Draw shooting star with enhanced gradient trail
        const tailX = star.x - Math.cos(star.angle) * star.length;
        const tailY = star.y - Math.sin(star.angle) * star.length;
        
        const gradient = ctx.createLinearGradient(star.x, star.y, tailX, tailY);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`);
        gradient.addColorStop(0.15, `rgba(${highlight.r}, ${highlight.g}, ${highlight.b}, ${star.opacity * 0.9})`);
        gradient.addColorStop(0.4, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${star.opacity * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.beginPath();
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Bright glowing head
        const headGradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 8);
        headGradient.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`);
        headGradient.addColorStop(0.5, `rgba(${highlight.r}, ${highlight.g}, ${highlight.b}, ${star.opacity * 0.5})`);
        headGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = headGradient;
        ctx.fill();

        return true;
      });

      // Update and draw sparkles
      if (enableSparkles) {
        sparklesRef.current = sparklesRef.current.filter(sparkle => {
          sparkle.life++;
          sparkle.rotation += sparkle.rotationSpeed;
          
          const lifeProgress = sparkle.life / sparkle.maxLife;
          sparkle.opacity = 1 - smoothstep(lifeProgress);
          
          if (sparkle.opacity <= 0.01) return false;
          
          drawStar(sparkle.x, sparkle.y, sparkle.size * (1 - lifeProgress * 0.5), sparkle.rotation, sparkle.opacity, highlight);
          
          return true;
        });
      }

      // Sort particles by layer for proper rendering order
      const sortedParticles = [...particlesRef.current].sort((a, b) => a.layer - b.layer);

      // Update and draw particles
      sortedParticles.forEach((particle) => {
        // Organic noise-based motion
        const noiseX = noise(
          particle.noiseOffsetX + time * particle.noiseSpeed * 100,
          particle.noiseOffsetY,
          particle.layer
        ) * 0.5;
        const noiseY = noise(
          particle.noiseOffsetX,
          particle.noiseOffsetY + time * particle.noiseSpeed * 100,
          particle.layer + 100
        ) * 0.3;

        // Mouse interaction with smooth attraction/repulsion
        if (enableMouseInteraction && mouseRef.current.active) {
          const dx = particle.x - mouseRef.current.x;
          const dy = particle.y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 180;
          
          if (dist < maxDist && dist > 0) {
            const force = (1 - dist / maxDist) * 0.6;
            const smoothForce = smoothstep(force);
            particle.speedX = particle.baseSpeedX + (dx / dist) * smoothForce;
            particle.speedY = particle.baseSpeedY + (dy / dist) * smoothForce * 0.5;
            
            // Boost opacity near cursor
            particle.opacity = particle.baseOpacity * (1 + smoothForce * 0.5);
          } else {
            particle.speedX += (particle.baseSpeedX - particle.speedX) * 0.03;
            particle.speedY += (particle.baseSpeedY - particle.speedY) * 0.03;
            particle.opacity += (particle.baseOpacity - particle.opacity) * 0.02;
          }
        }

        // Store trail position with opacity
        if (particle.trail.length > 6) {
          particle.trail.shift();
        }
        particle.trail.push({ x: particle.x, y: particle.y, opacity: particle.opacity });

        // Update position with noise influence
        particle.y += particle.speedY + noiseY;
        particle.x += particle.speedX + noiseX;

        // Smooth sine wave motion
        const waveX = Math.sin(time * 0.4 + particle.twinkleOffset) * (0.5 + particle.layer * 0.25);
        const waveY = Math.cos(time * 0.25 + particle.pulsePhase) * 0.2;

        // Wrap around screen
        if (particle.y < -30) {
          particle.y = height + 30;
          particle.x = Math.random() * width;
          particle.trail = [];
        }
        if (particle.x < -30) particle.x = width + 30;
        if (particle.x > width + 30) particle.x = -30;

        // Firefly pulsing behavior
        let fireflyMultiplier = 1;
        if (particle.isFirefly) {
          particle.fireflyPhase += particle.fireflySpeed;
          const fireflyPulse = Math.sin(particle.fireflyPhase);
          fireflyMultiplier = 0.3 + (fireflyPulse * 0.5 + 0.5) * particle.fireflyIntensity * 0.7;
          
          // Occasional bright flash
          if (Math.sin(particle.fireflyPhase * 3) > 0.95) {
            fireflyMultiplier = 1.5;
          }
        }

        // Calculate twinkle and pulse effects
        const twinkle = Math.sin(time * particle.twinkleSpeed * 60 + particle.twinkleOffset);
        const pulse = Math.sin(time * 1.5 + particle.pulsePhase) * 0.12 + 1;
        const currentOpacity = particle.opacity * (0.6 + twinkle * 0.4) * pulse * fireflyMultiplier;

        // Color shifting
        particle.colorPhase += particle.colorSpeed;
        const colorShift = (Math.sin(particle.colorPhase) + 1) * 0.5;
        const particleBaseColor = particle.hue === 1 ? accent : baseColor;
        const shiftedColor = lerpColor(particleBaseColor, highlight, colorShift * 0.3);

        const drawX = particle.x + waveX;
        const drawY = particle.y + waveY;

        // Draw gradient trail for front-layer particles
        if (particle.layer >= layers - 1 && particle.trail.length > 2) {
          ctx.beginPath();
          ctx.moveTo(particle.trail[0].x + waveX, particle.trail[0].y + waveY);
          
          for (let i = 1; i < particle.trail.length; i++) {
            ctx.lineTo(particle.trail[i].x + waveX, particle.trail[i].y + waveY);
          }
          
          const trailGradient = ctx.createLinearGradient(
            particle.trail[0].x, particle.trail[0].y,
            drawX, drawY
          );
          trailGradient.addColorStop(0, `rgba(${shiftedColor.r}, ${shiftedColor.g}, ${shiftedColor.b}, 0)`);
          trailGradient.addColorStop(1, `rgba(${shiftedColor.r}, ${shiftedColor.g}, ${shiftedColor.b}, ${currentOpacity * 0.2})`);
          
          ctx.strokeStyle = trailGradient;
          ctx.lineWidth = particle.size * 0.6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
        }

        // Multi-layer bloom/glow effect
        const glowLayers = [
          { radius: particle.size * 5, opacity: currentOpacity * 0.08 },
          { radius: particle.size * 3.5, opacity: currentOpacity * 0.15 },
          { radius: particle.size * 2.2, opacity: currentOpacity * 0.3 },
          { radius: particle.size * 1.4, opacity: currentOpacity * 0.5 },
        ];

        glowLayers.forEach(({ radius, opacity }) => {
          const gradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, radius);
          gradient.addColorStop(0, `rgba(${shiftedColor.r}, ${shiftedColor.g}, ${shiftedColor.b}, ${opacity})`);
          gradient.addColorStop(0.6, `rgba(${shiftedColor.r}, ${shiftedColor.g}, ${shiftedColor.b}, ${opacity * 0.3})`);
          gradient.addColorStop(1, `rgba(${shiftedColor.r}, ${shiftedColor.g}, ${shiftedColor.b}, 0)`);

          ctx.beginPath();
          ctx.arc(drawX, drawY, radius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        });

        // Draw bright core with inner highlight
        const coreSize = particle.size * 0.7 * pulse;
        const coreGradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, coreSize);
        coreGradient.addColorStop(0, `rgba(255, 255, 255, ${currentOpacity})`);
        coreGradient.addColorStop(0.5, `rgba(255, 255, 255, ${currentOpacity * 0.6})`);
        coreGradient.addColorStop(1, `rgba(${shiftedColor.r}, ${shiftedColor.g}, ${shiftedColor.b}, ${currentOpacity * 0.3})`);
        
        ctx.beginPath();
        ctx.arc(drawX, drawY, coreSize, 0, Math.PI * 2);
        ctx.fillStyle = coreGradient;
        ctx.fill();

        // Occasional sparkle effect on random particles
        if (enableSparkles && particle.layer === layers - 1 && Math.random() > 0.9995) {
          createSparkle(drawX, drawY);
        }
      });

      // Draw connecting lines between nearby particles (optimized)
      if (enableConnections && frameCountRef.current % 2 === 0) {
        const connectionDistance = 110;
        ctx.lineWidth = 0.6;
        
        // Only check subset of particles for performance
        const checkCount = Math.min(particlesRef.current.length, 50);
        for (let i = 0; i < checkCount; i++) {
          const p1 = particlesRef.current[i];
          
          for (let j = i + 1; j < checkCount; j++) {
            const p2 = particlesRef.current[j];
            
            if (Math.abs(p1.layer - p2.layer) > 1) continue;

            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            
            // Quick distance check before sqrt
            if (Math.abs(dx) > connectionDistance || Math.abs(dy) > connectionDistance) continue;
            
            const distSq = dx * dx + dy * dy;
            const maxDistSq = connectionDistance * connectionDistance;

            if (distSq < maxDistSq) {
              const dist = Math.sqrt(distSq);
              const opacity = (1 - dist / connectionDistance) * 0.12 * 
                ((p1.opacity + p2.opacity) / 2);
              
              const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
              gradient.addColorStop(0, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${opacity})`);
              gradient.addColorStop(0.5, `rgba(${highlight.r}, ${highlight.g}, ${highlight.b}, ${opacity * 0.8})`);
              gradient.addColorStop(1, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${opacity})`);
              
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = gradient;
              ctx.stroke();
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      mutationObserver.disconnect();
      if (enableMouseInteraction) {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [count, color, accentColor, minSize, maxSize, enableConnections, enableShootingStars, enableMouseInteraction, layers, enableSparkles, enableFireflies, parseColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%',
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Premium animated floating particles background effect.
 * Creates luxurious, multi-layered particles with connections,
 * shooting stars, sparkles, fireflies, and mouse interaction
 * for an elite ambient effect.
 */
function BackgroundParticlesComponent(props: BackgroundParticlesProps) {
  return <EnhancedCanvasParticles {...props} />;
}

export const BackgroundParticles = memo(BackgroundParticlesComponent);
export default BackgroundParticles;
