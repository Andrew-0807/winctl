import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
        title="Click to flush cached memory"
      >
        <div className="sys-label">Memory{flushing ? ' …' : ''}</div>
        <div className="sys-value">{memTotal}</div>
        <div className="sys-sub">{flushing ? 'Flushing…' : `${memCached} cached`}</div>
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
