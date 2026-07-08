import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServiceStore } from '../stores/services';
import { useUIStore } from '../stores/ui';
import { getAvailableTools, runFetchTool } from '../stores/socket';

// ── Terminal grid renderer (framework-agnostic) ─────────────────────────────

const ANSI16 = [
  '#1a1a1a','#c0392b','#27ae60','#f39c12','#2980b9','#8e44ad','#16a085','#bdc3c7',
  '#7f8c8d','#e74c3c','#2ecc71','#f1c40f','#3498db','#9b59b6','#1abc9c','#ecf0f1',
];

function ansi256(n: number): string {
  if (n < 16) return ANSI16[n];
  if (n >= 232) { const v = (n - 232) * 10 + 8; return `rgb(${v},${v},${v})`; }
  const idx = n - 16;
  const b = idx % 6, g = Math.floor(idx / 6) % 6, r = Math.floor(idx / 36);
  const ch = (v: number) => v === 0 ? 0 : 55 + v * 40;
  return `rgb(${ch(r)},${ch(g)},${ch(b)})`;
}

interface Cell { char: string; fg: string | null; bold: boolean; }

function renderTerminalOutput(raw: string): string {
  const rows: Cell[][] = [];
  let row = 0, col = 0;
  let fg: string | null = null, bold = false;

  const cell = (r: number, c: number, ch: string) => {
    while (rows.length <= r) rows.push([]);
    while (rows[r].length <= c) rows[r].push({ char: ' ', fg: null, bold: false });
    rows[r][c] = { char: ch, fg, bold };
  };

  const sgr = (codes: number[]) => {
    let i = 0;
    while (i < codes.length) {
      const c = codes[i];
      if (c === 0) { fg = null; bold = false; }
      else if (c === 1) bold = true;
      else if (c === 22) bold = false;
      else if (c === 39) fg = null;
      else if (c >= 30 && c <= 37) fg = ANSI16[c - 30];
      else if (c >= 90 && c <= 97) fg = ANSI16[c - 90 + 8];
      else if (c === 38 && codes[i + 1] === 5) { fg = ansi256(codes[i + 2]); i += 2; }
      else if (c === 38 && codes[i + 1] === 2) { fg = `rgb(${codes[i+2]},${codes[i+3]},${codes[i+4]})`; i += 4; }
      i++;
    }
  };

  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '\x1B') {
      const next = raw[i + 1];
      if (next === '[') {
        i += 2;
        let params = '';
        while (i < raw.length && raw.charCodeAt(i) >= 0x20 && raw.charCodeAt(i) <= 0x3F) params += raw[i++];
        const cmd = raw[i++] ?? '';
        const nums = params.replace(/[^0-9;]/g, '').split(';').map(n => parseInt(n) || 0);
        if (cmd === 'm') sgr(params ? params.split(';').map(Number) : [0]);
        else if (cmd === 'C') col += nums[0] || 1;
        else if (cmd === 'D') col = Math.max(0, col - (nums[0] || 1));
        else if (cmd === 'A') row = Math.max(0, row - (nums[0] || 1));
        else if (cmd === 'B') row += nums[0] || 1;
        else if (cmd === 'G') col = Math.max(0, (nums[0] || 1) - 1);
        else if (cmd === 'H' || cmd === 'f') { row = Math.max(0, (nums[0] || 1) - 1); col = Math.max(0, (nums[1] || 1) - 1); }
      } else if (next === ']') {
        i += 2;
        while (i < raw.length && raw[i] !== '\x07' && !(raw[i] === '\x1B' && raw[i+1] === '\\')) i++;
        if (raw[i] === '\x07') i++; else if (raw[i] === '\x1B') i += 2;
      } else { i += 2; }
    } else if (ch === '\r') { col = 0; i++; }
    else if (ch === '\n') { row++; col = 0; i++; }
    else if (ch === '\t') { col = Math.floor(col / 8) * 8 + 8; i++; }
    else if (ch >= ' ') { cell(row, col, ch); col++; i++; }
    else i++;
  }

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const r_ = rows[r] || [];
    let end = r_.length;
    while (end > 0 && r_[end-1].char === ' ' && !r_[end-1].fg && !r_[end-1].bold) end--;
    let line = '', ci = 0;
    while (ci < end) {
      const { fg: f, bold: b } = r_[ci];
      let run = ci + 1;
      while (run < end && r_[run].fg === f && r_[run].bold === b) run++;
      const text = esc(r_.slice(ci, run).map(c => c.char).join(''));
      if (f || b) {
        const style = [f ? `color:${f}` : '', b ? 'font-weight:bold' : ''].filter(Boolean).join(';');
        line += `<span style="${style}">${text}</span>`;
      } else { line += text; }
      ci = run;
    }
    lines.push(line);
  }
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines.join('\n');
}

const SystemInfoModal: React.FC = () => {
  const settings = useServiceStore((s) => s.settings);
  const updateSettings = useServiceStore((s) => s.updateSettings);
  const systemInfoModalOpen = useUIStore((s) => s.systemInfoModalOpen);
  const closeSystemInfoModal = useUIStore((s) => s.closeSystemInfoModal);

  const [showPicker, setShowPicker] = useState(false);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchOutput = async () => {
    setLoading(true); setErrorMsg(null); setOutput('');
    try { const result = await runFetchTool(); setOutput(result.output); }
    catch (e) { setErrorMsg(e instanceof Error ? e.message : 'Failed to run fetch tool'); }
    finally { setLoading(false); }
  };

  const loadTools = async () => {
    setLoading(true); setErrorMsg(null);
    try {
      const result = await getAvailableTools();
      setAvailableTools(result.tools);
      if (result.tools.length > 0) setSelectedTool(result.tools[0]);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : 'Failed to detect tools'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!systemInfoModalOpen) return;
    if (settings.fetchTool) { setShowPicker(false); fetchOutput(); }
    else { setShowPicker(true); loadTools(); }
  }, [systemInfoModalOpen]);

  const handleConfirm = async () => {
    if (!selectedTool) return;
    await updateSettings({ fetchTool: selectedTool });
    setShowPicker(false); fetchOutput();
  };

  const handleChangeTool = async () => {
    setShowPicker(true); setOutput(''); await loadTools();
  };

  return (
    <AnimatePresence>
      {systemInfoModalOpen && (
        <div className="modal-backdrop open" id="sysinfo-modal" onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains('modal-backdrop')) closeSystemInfoModal();
        }}>
          <motion.div className="modal max-w-[1100px] w-[96%]" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', duration: 0.38, bounce: 0.12 }}>
            <div className="modal-header">
              <div className="modal-title">System Info</div>
              <button className="modal-close" onClick={closeSystemInfoModal} title="Close">×</button>
            </div>
            <div className="modal-body">
              {showPicker ? (
                loading ? <p className="sysinfo-status">Detecting tools…</p> : (
                  availableTools.length > 0 ? (
                    <>
                      <p className="mt-0 mx-0 mb-3 text-text2 text-[13px]">Choose a fetch tool to display system information:</p>
                      <div className="sysinfo-tool-list">
                        {availableTools.map((tool) => (
                          <label key={tool} className="sysinfo-tool-option">
                            <input type="radio" name="fetchTool" value={tool} checked={selectedTool === tool} onChange={() => setSelectedTool(tool)} />
                            <span>{tool}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 flex gap-2 justify-end">
                        <button className="btn btn-secondary" onClick={closeSystemInfoModal}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleConfirm} disabled={!selectedTool}>Confirm</button>
                      </div>
                    </>
                  ) : (
                    <p className="sysinfo-status">No supported tool found. Install <strong>fastfetch</strong>, <strong>neofetch</strong>, or <strong>winfetch</strong> and restart WinCTL.</p>
                  )
                )
              ) : (
                <>
                  {loading && <p className="sysinfo-status">Running {settings.fetchTool}…</p>}
                  {errorMsg && <p className="sysinfo-error">{errorMsg}</p>}
                  {output && <pre className="sysinfo-output" dangerouslySetInnerHTML={{ __html: renderTerminalOutput(output) }} />}
                  {!loading && (
                    <div className="mt-3 text-right">
                      <button className="btn btn-secondary text-xs py-1 px-2.5" onClick={handleChangeTool}>Change tool</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SystemInfoModal;
