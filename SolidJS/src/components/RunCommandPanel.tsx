import { Component, For, Show, createEffect } from 'solid-js';
import { execState, setExecCommand, setExecRunning, clearExec } from '../stores/ui';
import { postExec, killExecSession } from '../stores/socket';
import Icon from './Icon';

const RunCommandPanel: Component = () => {
  let outputRef: HTMLDivElement | undefined;

  // Auto-scroll to bottom when new lines arrive
  createEffect(() => {
    const lines = execState().lines;
    if (outputRef && lines.length > 0) {
      setTimeout(() => {
        if (outputRef) outputRef.scrollTop = outputRef.scrollHeight;
      }, 0);
    }
  });

  const isRunning = () => execState().execId !== null;

  const handleRun = async () => {
    const cmd = execState().command.trim();
    if (!cmd || isRunning()) return;
    try {
      const { execId } = await postExec(cmd);
      setExecRunning(execId);
    } catch (err) {
      console.error('[RunCommand] Failed to start exec:', err);
    }
  };

  const handleKill = async () => {
    const execId = execState().execId;
    if (!execId) return;
    try {
      await killExecSession(execId);
    } catch {
      // ignore — process may have already exited
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRun();
    }
  };

  const exitCodeClass = () => {
    const code = execState().exitCode;
    if (code === null) return '';
    return code === 0 ? 'exec-exit-ok' : 'exec-exit-err';
  };

  const exitCodeText = () => {
    const code = execState().exitCode;
    if (code === null) return '';
    return code === 0 ? 'Exited with code 0' : `Exited with code ${code}`;
  };

  return (
    <div class="run-command-panel">
      <div class="run-command-header">
        <Icon name="Terminal" size={14} />
        <span>Run Command</span>
        <span style="font-size: 11px; color: var(--text3); margin-left: 6px;">(no interactive input)</span>
        <Show when={execState().lines.length > 0 && !isRunning()}>
          <button class="log-btn" style="margin-left: auto;" onClick={clearExec} title="Clear output">
            <Icon name="Trash" size={12} />
            Clear
          </button>
        </Show>
      </div>

      <div class="run-command-input-row">
        <input
          type="text"
          class="run-command-input"
          placeholder="Enter command…"
          value={execState().command}
          onInput={(e) => setExecCommand((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning()}
        />
        <Show
          when={isRunning()}
          fallback={
            <button
              class="btn btn-primary run-command-btn"
              onClick={handleRun}
              disabled={!execState().command.trim()}
              title="Run command (Enter)"
            >
              <Icon name="Play" size={13} />
              Run
            </button>
          }
        >
          <button
            class="btn btn-danger run-command-btn"
            onClick={handleKill}
            title="Kill process"
          >
            <Icon name="Square" size={13} />
            Kill
          </button>
        </Show>
      </div>

      <Show when={execState().lines.length > 0 || isRunning() || execState().exitCode !== null}>
        <div class="log-terminal run-command-output" ref={outputRef}>
          <Show
            when={execState().lines.length > 0}
            fallback={
              <Show when={isRunning()}>
                <span style="color: var(--text3)">Running…</span>
              </Show>
            }
          >
            <For each={execState().lines}>
              {(entry) => (
                <div class={`log-line ${entry.stream === 'stderr' ? 'err' : ''}`}>
                  {entry.line}
                </div>
              )}
            </For>
          </Show>
          <Show when={execState().exitCode !== null}>
            <div class={`log-line exec-exit ${exitCodeClass()}`} style="margin-top: 4px; font-weight: 600;">
              {exitCodeText()}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default RunCommandPanel;
