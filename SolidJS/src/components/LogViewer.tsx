import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import { toast } from '../stores/ui';
import Icon from './Icon';

interface LogViewerProps {
  serviceId: string;
  logs: Array<{ t: string; line: string }>;
}

const LogViewer: Component<LogViewerProps> = (props) => {
  const [autoScroll, setAutoScroll] = createSignal(true);
  let terminalRef: HTMLDivElement | undefined;
  
  // Auto-scroll to bottom when new logs arrive
  createEffect(() => {
    const logs = props.logs;
    if (autoScroll() && terminalRef && logs.length > 0) {
      terminalRef.scrollTop = terminalRef.scrollHeight;
    }
  });
  
  const toggleAutoScroll = () => {
    setAutoScroll(!autoScroll());
  };
  
  const copyLogs = async () => {
    const logText = props.logs.map(l => `${l.t.substring(11, 19)} ${l.line}`).join('\n');
    try {
      await navigator.clipboard.writeText(logText);
      toast('Logs copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy logs:', err);
      toast('Failed to copy logs', 'error');
    }
  };
  
  const clearLogs = () => {
    toast('Logs cleared (display only)', 'success');
  };
  
  const getLogClass = (line: string): string => {
    if (line.includes('[ERR]')) return 'err';
    if (line.includes('[SYS]')) return 'sys';
    return '';
  };
  
  const displayedLogs = () => props.logs.slice(-100);

  return (
    <div class="log-viewer">
      <div class="log-controls">
        <button class="log-btn" onClick={copyLogs} title="Copy logs to clipboard">
          <Icon name="Copy" size={12} />
          Copy
        </button>
        <button 
          class={`log-btn ${autoScroll() ? 'active' : ''}`} 
          onClick={toggleAutoScroll}
          title="Toggle auto-scroll"
        >
          <Icon name="ArrowDown" size={12} />
          Auto-scroll
        </button>
        <button class="log-btn" onClick={clearLogs} title="Clear display">
          <Icon name="Trash" size={12} />
          Clear
        </button>
      </div>
      <div 
        class="log-terminal" 
        id={`logs-${props.serviceId}`}
        data-autoscroll={autoScroll().toString()}
        ref={terminalRef}
      >
        <Show 
          when={displayedLogs().length > 0}
          fallback={<span style="color: var(--text3)">No output yet</span>}
        >
          <For each={displayedLogs()}>
            {(log) => (
              <div class={`log-line ${getLogClass(log.line)}`}>
                <span class="time">{log.t.substring(11, 19)}</span>
                {log.line}
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};

export default LogViewer;
