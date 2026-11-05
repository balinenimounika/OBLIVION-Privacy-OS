import React, { useEffect, useRef, useState } from 'react';
import { Shield } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
}

interface DataFragment {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  progress: number;
  speed: number;
  label: string;
  opacity: number;
}

export const PrivacyShield3D: React.FC<{ className?: string }> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Mouse tilt target and current smoothed values
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleMotionChange);
    return () => mediaQuery.removeEventListener('change', handleMotionChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      setIsSupported(false);
      return;
    }
    if (!ctx) {
      setIsSupported(false);
      return;
    }

    let isVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Set dimensions with DPI scaling
    let width = (canvas.width = 460);
    let height = (canvas.height = 460);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const size = Math.min(rect.width || 460, 480);
      width = canvas.width = size * dpr;
      height = canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // 3D Shield vertices (isometric wireframe polygon)
    const baseShieldPoints: [number, number, number][] = [
      [0, -95, 0],       // 0: Top center peak
      [75, -65, 15],     // 1: Top right outer
      [80, 20, 20],      // 2: Mid right outer
      [0, 105, 0],       // 3: Bottom apex
      [-80, 20, 20],     // 4: Mid left outer
      [-75, -65, 15],    // 5: Top left outer
      [0, -75, 25],      // 6: Inner top peak
      [55, -50, 30],     // 7: Inner top right
      [60, 15, 30],      // 8: Inner mid right
      [0, 80, 20],       // 9: Inner bottom
      [-60, 15, 30],     // 10: Inner mid left
      [-55, -50, 30],    // 11: Inner top left
    ];

    // Background floating particles
    const particleCount = 45;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 400,
        z: (Math.random() - 0.5) * 300,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        color: Math.random() > 0.4 ? '#8B5CF6' : '#06B6D4',
      });
    }

    // Inward data fragments dissolving into the shield
    const labels = ['EMAIL', 'PHONE', 'NAME', 'IP_ADDR', 'PASS', 'LOCATION', 'COOKIE'];
    const dataFragments: DataFragment[] = [];

    const spawnFragment = (): DataFragment => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 180 + Math.random() * 60;
      return {
        x: Math.cos(angle) * distance,
        y: (Math.random() - 0.5) * 160,
        z: Math.sin(angle) * distance,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        progress: 0,
        speed: 0.007 + Math.random() * 0.006,
        label: labels[Math.floor(Math.random() * labels.length)],
        opacity: 0.8,
      };
    };

    for (let i = 0; i < 6; i++) {
      const frag = spawnFragment();
      frag.progress = Math.random();
      dataFragments.push(frag);
    }

    let angleY = 0;
    let angleX = 0.15;
    let floatTimer = 0;

    // 3D projection helper
    const project = (x: number, y: number, z: number, cx: number, cy: number, scale: number) => {
      // Perspective division
      const fov = 380;
      const depth = fov + z;
      const factor = depth > 0 ? (fov / depth) * scale : 0;
      return {
        px: cx + x * factor,
        py: cy + y * factor,
        scale: factor,
      };
    };

    // 3D rotation helper around Y and X
    const rotate3D = (x: number, y: number, z: number, radY: number, radX: number) => {
      // Rotate Y
      const cosY = Math.cos(radY);
      const sinY = Math.sin(radY);
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;

      // Rotate X
      const cosX = Math.cos(radX);
      const sinX = Math.sin(radX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      return [x1, y2, z2] as const;
    };

    // Render loop
    const render = () => {
      if (!isVisible) {
        animFrameId.current = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const scale = (width / 460) * 1.1;

      // Smooth mouse interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      if (!reducedMotion) {
        angleY += 0.008;
        floatTimer += 0.02;
      }

      const currentAngleY = angleY + mouseRef.current.x * 0.4;
      const currentAngleX = angleX + mouseRef.current.y * 0.3;
      const floatOffsetY = Math.sin(floatTimer) * 8;

      // 1. Draw glowing background radial aura
      const auraGradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, 160 * scale);
      auraGradient.addColorStop(0, 'rgba(139, 92, 246, 0.18)');
      auraGradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.08)');
      auraGradient.addColorStop(1, 'rgba(11, 19, 43, 0)');
      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, 180 * scale, 0, Math.PI * 2);
      ctx.fill();

      // 2. Draw rotating orbital data rings
      const drawRing = (radius: number, tiltX: number, tiltY: number, rotation: number, color: string, dashes = false) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2 * dpr;
        if (dashes) ctx.setLineDash([4 * dpr, 6 * dpr]);

        ctx.beginPath();
        const segments = 48;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const rx = Math.cos(theta) * radius;
          const ry = 0;
          const rz = Math.sin(theta) * radius;

          const [rx1, ry1, rz1] = rotate3D(rx, ry, rz, rotation, tiltX);
          const p = project(rx1, ry1 + floatOffsetY, rz1, cx, cy, scale);

          if (i === 0) ctx.moveTo(p.px, p.py);
          else ctx.lineTo(p.px, p.py);
        }
        ctx.stroke();
        ctx.restore();
      };

      drawRing(145, 0.4, 0, currentAngleY * 0.8, 'rgba(139, 92, 246, 0.35)', true);
      drawRing(165, -0.3, 0, -currentAngleY * 0.6, 'rgba(6, 182, 212, 0.25)', false);

      // 3. Draw & update particles with connection lines
      for (let i = 0; i < particles.length; i++) {
        const pt = particles[i];
        if (!reducedMotion) {
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.z += pt.vz;
          if (pt.x > 200 || pt.x < -200) pt.vx *= -1;
          if (pt.y > 200 || pt.y < -200) pt.vy *= -1;
          if (pt.z > 150 || pt.z < -150) pt.vz *= -1;
        }

        const [rx, ry, rz] = rotate3D(pt.x, pt.y, pt.z, currentAngleY * 0.4, currentAngleX * 0.4);
        const p = project(rx, ry + floatOffsetY, rz, cx, cy, scale);

        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0.15, Math.min(0.8, (rz + 150) / 300));
        ctx.beginPath();
        ctx.arc(p.px, p.py, pt.size * dpr, 0, Math.PI * 2);
        ctx.fill();

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(pt.x - p2.x, pt.y - p2.y, pt.z - p2.z);
          if (dist < 60) {
            const [rx2, ry2, rz2] = rotate3D(p2.x, p2.y, p2.z, currentAngleY * 0.4, currentAngleX * 0.4);
            const p2Proj = project(rx2, ry2 + floatOffsetY, rz2, cx, cy, scale);

            ctx.strokeStyle = 'rgba(139, 92, 246, 0.12)';
            ctx.lineWidth = 0.8 * dpr;
            ctx.beginPath();
            ctx.moveTo(p.px, p.py);
            ctx.lineTo(p2Proj.px, p2Proj.py);
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1.0;

      // 4. Project and render 3D Faceted Shield
      const projPoints = baseShieldPoints.map(([x, y, z]) => {
        const [rx, ry, rz] = rotate3D(x, y + floatOffsetY, z, currentAngleY, currentAngleX);
        return {
          ...project(rx, ry, rz, cx, cy, scale),
          z: rz,
        };
      });

      // Outer shield fill with translucent gradient
      ctx.beginPath();
      ctx.moveTo(projPoints[0].px, projPoints[0].py);
      ctx.lineTo(projPoints[1].px, projPoints[1].py);
      ctx.lineTo(projPoints[2].px, projPoints[2].py);
      ctx.lineTo(projPoints[3].px, projPoints[3].py);
      ctx.lineTo(projPoints[4].px, projPoints[4].py);
      ctx.lineTo(projPoints[5].px, projPoints[5].py);
      ctx.closePath();

      const shieldGrad = ctx.createLinearGradient(cx - 50, cy - 80, cx + 50, cy + 80);
      shieldGrad.addColorStop(0, 'rgba(139, 92, 246, 0.28)');
      shieldGrad.addColorStop(0.5, 'rgba(30, 41, 59, 0.45)');
      shieldGrad.addColorStop(1, 'rgba(6, 182, 212, 0.22)');
      ctx.fillStyle = shieldGrad;
      ctx.fill();

      // Outer glow boundary stroke
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
      ctx.lineWidth = 2.2 * dpr;
      ctx.shadowColor = '#8B5CF6';
      ctx.shadowBlur = 12 * dpr;
      ctx.stroke();

      // Inner shield faceted lines
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
      ctx.lineWidth = 1.4 * dpr;

      ctx.beginPath();
      ctx.moveTo(projPoints[6].px, projPoints[6].py);
      ctx.lineTo(projPoints[7].px, projPoints[7].py);
      ctx.lineTo(projPoints[8].px, projPoints[8].py);
      ctx.lineTo(projPoints[9].px, projPoints[9].py);
      ctx.lineTo(projPoints[10].px, projPoints[10].py);
      ctx.lineTo(projPoints[11].px, projPoints[11].py);
      ctx.closePath();
      ctx.stroke();

      // Connect outer to inner vertices for 3D bevel look
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
      ctx.lineWidth = 1.0 * dpr;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(projPoints[i].px, projPoints[i].py);
        ctx.lineTo(projPoints[i + 6].px, projPoints[i + 6].py);
        ctx.stroke();
      }

      // Center keyhole / lock motif projected
      const [kx, ky, kz] = rotate3D(0, 0 + floatOffsetY, 28, currentAngleY, currentAngleX);
      const kp = project(kx, ky, kz, cx, cy, scale);

      ctx.fillStyle = '#06B6D4';
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 8 * dpr;
      ctx.beginPath();
      ctx.arc(kp.px, kp.py - 6 * dpr, 6 * dpr, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(kp.px - 3.5 * dpr, kp.py - 2 * dpr);
      ctx.lineTo(kp.px + 3.5 * dpr, kp.py - 2 * dpr);
      ctx.lineTo(kp.px + 5 * dpr, kp.py + 8 * dpr);
      ctx.lineTo(kp.px - 5 * dpr, kp.py + 8 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // 5. Data fragments moving towards shield and dissolving into erasure trail
      if (!reducedMotion) {
        dataFragments.forEach((frag, idx) => {
          frag.progress += frag.speed;

          if (frag.progress >= 1) {
            // Respawn
            dataFragments[idx] = spawnFragment();
            return;
          }

          // Interpolate current pos towards origin
          const currentDist = (1 - frag.progress);
          const curX = frag.x * currentDist;
          const curY = frag.y * currentDist;
          const curZ = frag.z * currentDist;

          const [rx, ry, rz] = rotate3D(curX, curY + floatOffsetY, curZ, currentAngleY, currentAngleX);
          const p = project(rx, ry, rz, cx, cy, scale);

          // As it gets close to the shield (< 0.25 dist), fade out dramatically (erasure effect)
          let opacity = 0.8;
          if (frag.progress > 0.65) {
            opacity = (1 - frag.progress) / 0.35;
          }

          ctx.save();
          ctx.globalAlpha = Math.max(0, opacity);

          // Data badge pill
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = frag.progress > 0.65 ? 'rgba(244, 63, 94, 0.7)' : 'rgba(139, 92, 246, 0.6)';
          ctx.lineWidth = 1 * dpr;

          const textWidth = 38 * dpr;
          const textHeight = 14 * dpr;
          const rectX = p.px - textWidth / 2;
          const rectY = p.py - textHeight / 2;

          ctx.beginPath();
          ctx.roundRect(rectX, rectY, textWidth, textHeight, 4 * dpr);
          ctx.fill();
          ctx.stroke();

          // Micro label text
          ctx.fillStyle = frag.progress > 0.65 ? '#FDA4AF' : '#E2E8F0';
          ctx.font = `600 ${7.5 * dpr}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(frag.label, p.px, p.py);

          // Disappearing erasure spark trail
          if (frag.progress > 0.65) {
            ctx.fillStyle = '#F43F5E';
            for (let s = 0; s < 3; s++) {
              const sparkX = p.px + (Math.random() - 0.5) * 16 * dpr;
              const sparkY = p.py + (Math.random() - 0.5) * 16 * dpr;
              ctx.beginPath();
              ctx.arc(sparkX, sparkY, 1.2 * dpr, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          ctx.restore();
        });
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [reducedMotion]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || reducedMotion) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseRef.current.targetX = x * 1.2;
    mouseRef.current.targetY = y * 1.2;
  };

  const handleMouseLeave = () => {
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative flex items-center justify-center select-none ${className}`}
      aria-label="3D Interactive Digital Privacy Shield Animation"
    >
      {/* 3D Hardware Accelerated Canvas */}
      {isSupported ? (
        <canvas
          ref={canvasRef}
          className="w-full max-w-[460px] aspect-square block pointer-events-none drop-shadow-[0_0_35px_rgba(139,92,246,0.3)]"
        />
      ) : (
        /* Static High-Fidelity SVG Fallback for unsupported devices */
        <div className="w-80 h-80 rounded-3xl bg-navy-900/80 border border-electric-500/30 flex flex-col items-center justify-center p-8 text-center shadow-glow-purple">
          <div className="p-4 rounded-2xl bg-electric-600/20 text-electric-400 border border-electric-500/40 mb-4 animate-pulse">
            <Shield className="w-14 h-14" />
          </div>
          <div className="text-base font-bold text-slate-100 font-mono">Digital Privacy Shield</div>
          <p className="text-xs text-slate-400 mt-2">Active statutory privacy protection & data erasure</p>
        </div>
      )}

      {/* Subtle Caption / Visual Meaning */}
      <div className="absolute -bottom-2 text-center pointer-events-none">
        <span className="text-[11px] font-mono text-slate-400/80 tracking-wide bg-navy-900/90 px-3 py-1 rounded-full border border-navy-800 shadow-sm backdrop-blur-sm">
          Personal Data Fragments Dissolve Upon Protected Boundary
        </span>
      </div>
    </div>
  );
};
