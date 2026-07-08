import React, { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../stores/ui';
import { getServiceLogs } from '../stores/socket';
import Icon from './Icon';

interface LogViewerProps {
  serviceId: string;
  logs: Array<{ t: string; line: string }>;
}

const LogViewer: React.FC<LogViewerProps> = ({ serviceId, logs }) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [localLogs, setLocalLogs] = useState<Array<{ t: string; line: string }>>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const toast = useUIStore((s) => s.toast);

  useEffect(() => {
    setLocalLogs(logs || []);
  }, [logs]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const newLogs = await getServiceLogs(serviceId);
        if (newLogs && newLogs.length > 0) {
          setLocalLogs(newLogs.slice(-500));
        }
      } catch { /* silently ignore - logs will update from WS push */ }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [serviceId]);

  useEffect(() => {
    if (autoScroll && terminalRef.current && localLogs.length > 0) {
      requestAnimationFrame(() => {
        if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      });
    }
  }, [localLogs, autoScroll]);

  const copyLogs = async () => {
    const logText = localLogs.map((l) => `${l.t.substring(11, 19)} ${l.line}`).join('\n');
    try {
      await navigator.clipboard.writeText(logText);
      toast('Logs copied to clipboard', 'success');
    } catch {
      toast('Failed to copy logs', 'error');
    }
  };

  const clearLogs = () => {
    setLocalLogs([]);
    toast('Logs cleared (display only)', 'success');
  };

  const getLogClass = (line: string): string => {
    if (line.includes('[ERR]')) return 'err';
    if (line.includes('[SYS]')) return 'sys';
    return '';
  };

  const displayedLogs = localLogs.slice(-100);

  return (
    <div className="log-viewer">
      <div className="log-controls">
        <button className="log-btn" onClick={copyLogs} title="Copy logs to clipboard">
          <Icon name="Copy" size={12} /> Copy
        </button>
        <button
          className={`log-btn ${autoScroll ? 'active' : ''}`}
          onClick={() => setAutoScroll(!autoScroll)}
          title="Toggle auto-scroll"
        >
          <Icon name="ArrowDown" size={12} /> Auto-scroll
        </button>
        <button className="log-btn" onClick={clearLogs} title="Clear display">
          <Icon name="Trash" size={12} /> Clear
        </button>
      </div>
      <div
        className="log-terminal"
        id={`logs-${serviceId}`}
        data-autoscroll={autoScroll.toString()}
        ref={terminalRef}
      >
        {displayedLogs.length > 0 ? (
          displayedLogs.map((log, i) => (
            <div key={i} className={`log-line ${getLogClass(log.line)}`}>
              <span className="time">{log.t.substring(11, 19)}</span>
              {log.line}
            </div>
          ))
        ) : (
          <span className="text-text3">No output yet</span>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
