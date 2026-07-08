import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/ui';
import { postExec, killExecSession } from '../stores/socket';
import Icon from './Icon';

const RunCommandPanel: React.FC = () => {
  const execState = useUIStore((s) => s.execState);
  const setExecCommand = useUIStore((s) => s.setExecCommand);
  const setExecRunning = useUIStore((s) => s.setExecRunning);
  const clearExec = useUIStore((s) => s.clearExec);
  const toast = useUIStore((s) => s.toast);
  const outputRef = useRef<HTMLDivElement>(null);

  const isRunning = execState.execId !== null;

  useEffect(() => {
    if (outputRef.current && execState.lines.length > 0) {
      requestAnimationFrame(() => {
        if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
      });
    }
  }, [execState.lines]);

  const handleRun = async () => {
    const cmd = execState.command.trim();
    if (!cmd || isRunning) return;
    try {
      const { execId } = await postExec(cmd);
      setExecRunning(execId);
    } catch (err) {
      console.error('[RunCommand] Failed to start exec:', err);
      toast('Failed to start process', 'error');
      clearExec();
    }
  };

  const handleKill = async () => {
    if (!execState.execId) return;
    try { await killExecSession(execState.execId); } catch { toast('Failed to kill process', 'error'); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun(); }
  };

  const exitCodeClass = execState.exitCode === null ? '' : execState.exitCode === 0 ? 'exec-exit-ok' : 'exec-exit-err';
  const exitCodeText = execState.exitCode === null ? '' : execState.exitCode === 0 ? 'Exited with code 0' : `Exited with code ${execState.exitCode}`;

  return (
    <div className="run-command-panel">
      <div className="run-command-header">
        <Icon name="Terminal" size={14} />
        <span>Run Command</span>
        <span className="text-[11px] text-text3 ml-1.5">(no interactive input)</span>
        {execState.lines.length > 0 && !isRunning && (
          <button className="log-btn ml-auto" onClick={clearExec} title="Clear output">
            <Icon name="Trash" size={12} /> Clear
          </button>
        )}
      </div>

      <div className="run-command-input-row">
        <input
          type="text" className="run-command-input" placeholder="Enter command…"
          value={execState.command}
          onChange={(e) => setExecCommand(e.target.value)}
          onKeyDown={handleKeyDown} disabled={isRunning}
        />
        {isRunning ? (
          <button className="btn btn-danger run-command-btn" onClick={handleKill} title="Kill process">
            <Icon name="Square" size={13} /> Kill
          </button>
        ) : (
          <button className="btn btn-primary run-command-btn" onClick={handleRun} disabled={!execState.command.trim()} title="Run command (Enter)">
            <Icon name="Play" size={13} /> Run
          </button>
        )}
      </div>

      {(execState.lines.length > 0 || isRunning || execState.exitCode !== null) && (
        <div className="log-terminal run-command-output" ref={outputRef}>
          {execState.lines.length > 0 ? (
            execState.lines.map((entry, i) => (
              <div key={i} className={`log-line ${entry.stream === 'stderr' ? 'err' : ''}`}>
                {entry.line}
              </div>
            ))
          ) : isRunning ? (
            <span className="text-text3">Running…</span>
          ) : null}
          {execState.exitCode !== null && (
            <div className={`log-line exec-exit mt-1 font-semibold ${exitCodeClass}`}>
              {exitCodeText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RunCommandPanel;
