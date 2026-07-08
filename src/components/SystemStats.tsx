import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useServiceStore } from '../stores/services';
import { useUIStore } from '../stores/ui';
import { flushMemoryAPI } from '../stores/socket';

const SystemStats: React.FC = () => {
  const systemInfo = useServiceStore((s) => s.systemInfo);
  const services = useServiceStore((s) => s.services);
  const loadSystem = useServiceStore((s) => s.loadSystem);
  const toast = useUIStore((s) => s.toast);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    loadSystem();
  }, []);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatMem = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const handleFlushMemory = async () => {
    if (flushing) return;
    setFlushing(true);
    try {
      const before = systemInfo?.cachedMem ?? 0;
      await flushMemoryAPI();
      await loadSystem();
      const after = useServiceStore.getState().systemInfo?.cachedMem ?? 0;
      const freedGb = (before - after) / (1024 * 1024 * 1024);
      if (freedGb < 0.01) {
        toast('Memory flushed — nothing significant to reclaim', 'success');
      } else {
        toast(`Freed ${freedGb.toFixed(2)} GB of cached memory`, 'success');
      }
    } catch {
      toast('Failed to flush memory', 'error');
    } finally {
      setFlushing(false);
    }
  };

  const cpuCores = systemInfo?.cpuCount || '—';
  const hostname = systemInfo?.hostname || '—';
  const memTotal = systemInfo?.totalMem != null ? formatMem(systemInfo.totalMem) : '—';
  const memCached = systemInfo?.cachedMem != null ? formatMem(systemInfo.cachedMem) : '—';
  const uptime = systemInfo?.uptime != null ? formatUptime(systemInfo.uptime) : '—';
  
  const serviceCount = services.length;

  // Spring 3D Tilt + scale motion values
  const rotateXVal = useMotionValue(0);
  const rotateYVal = useMotionValue(0);
  const scaleVal = useMotionValue(1);

  const rotateX = useSpring(rotateXVal, { stiffness: 80, damping: 15 });
  const rotateY = useSpring(rotateYVal, { stiffness: 80, damping: 15 });
  const scale = useSpring(scaleVal, { stiffness: 120, damping: 18 });

  // Mouse radial glow coordinates and opacity
  const glowXVal = useMotionValue(0);
  const glowYVal = useMotionValue(0);
  const glowOpacityVal = useMotionValue(0);

  const glowX = useSpring(glowXVal, { stiffness: 100, damping: 18 });
  const glowY = useSpring(glowYVal, { stiffness: 100, damping: 18 });
  const glowOpacity = useSpring(glowOpacityVal, { stiffness: 100, damping: 18 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (flushing) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    rotateXVal.set(-y * 6);
    rotateYVal.set(x * 6);
    scaleVal.set(1.015); // Subtle scale lift

    glowXVal.set(e.clientX - rect.left);
    glowYVal.set(e.clientY - rect.top);
    glowOpacityVal.set(0.35); // Subtle glow
  };

  const handleMouseLeave = () => {
    rotateXVal.set(0);
    rotateYVal.set(0);
    scaleVal.set(1);
    glowOpacityVal.set(0);
  };

  const handleMouseDown = () => {
    if (flushing) return;
    scaleVal.set(0.97);
  };

  const handleMouseUp = () => {
    if (flushing) return;
    scaleVal.set(1.015);
  };

  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.04
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 90,
        damping: 14
      } as const
    }
  };

  const cardStyle = {
    rotateX,
    rotateY,
    scale,
    transformStyle: 'preserve-3d' as const,
    perspective: 800,
    position: 'relative' as const,
  };

  const glowStyle = {
    position: 'absolute' as const,
    inset: 0,
    borderRadius: 'inherit',
    pointerEvents: 'none' as const,
    opacity: glowOpacity,
    background: useTransform(
      [glowX, glowY],
      ([x, y]) => `radial-gradient(circle 140px at ${x}px ${y}px, var(--accent-glow), transparent 70%)`
    ),
    zIndex: 1,
  };

  return (
    <motion.div
      className="sysbar"
      id="sysbar"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div className="sys-card" variants={cardVariants}>
        <div className="sys-label">CPU Cores</div>
        <div className="sys-value">{cpuCores}</div>
        <div className="sys-sub">{hostname}</div>
      </motion.div>
      <motion.div
        className={`sys-card sys-card-clickable${flushing ? ' flushing' : ''}`}
        variants={cardVariants}
        onClick={handleFlushMemory}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={cardStyle}
        title="Click to flush cached memory"
      >
        <motion.div style={glowStyle} />
        <div className="relative z-[2]">
          <div className="sys-label">Memory{flushing ? ' …' : ''}</div>
          <div className="sys-value">{memTotal}</div>
          <div className="sys-sub">{flushing ? 'Flushing…' : `${memCached} cached`}</div>
        </div>
      </motion.div>
      <motion.div className="sys-card" variants={cardVariants}>
        <div className="sys-label">Services</div>
        <div className="sys-value">{serviceCount}</div>
        <div className="sys-sub">total registered</div>
      </motion.div>
      <motion.div className="sys-card" variants={cardVariants}>
        <div className="sys-label">Uptime</div>
        <div className="sys-value">{uptime}</div>
        <div className="sys-sub">system uptime</div>
      </motion.div>
    </motion.div>
  );
};

export default SystemStats;
