import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useThemeStore, applyTheme } from '../stores/themes';
import { apiFetch, getInstalledFonts, completeSetup, saveSettingsAPI } from '../stores/socket';
import type { Theme } from '../stores/themes';
import GenerativeBackground from './GenerativeBackground';
import { safeRandomUUID } from '../lib/utils';

interface OnboardingFlowProps {
  onComplete: (openAccess: boolean) => void;
}

interface StepProps {
  onNext?: () => void;
  onBack?: () => void;
}

// ─── Stepper ────────────────────────────────────────────────────────────────

const STEP_LABELS = ['Theme', 'Font', 'Startup', 'Network'];

const Stepper: React.FC<{ current: number }> = ({ current }) => {
  // current = currentStep - 1 (steps 1-4 mapped to 0-3)
  const total = STEP_LABELS.length;
  return (
    <div className="py-[0.9rem] px-6 border-b border-border flex flex-col gap-[0.6rem]">
      <div className="flex items-baseline justify-between">
        <span className="text-[0.95rem] font-semibold text-text tracking-[-0.01em] leading-none">
          {STEP_LABELS[current]}
        </span>
        <span
          style={{ fontFamily: 'var(--font-mono)' }}
          className="text-[0.7rem] text-text3 tracking-[0.1em] leading-none tabular-nums"
        >
          {String(current + 1).padStart(2, '0')}
          <span className="opacity-40"> / {String(total).padStart(2, '0')}</span>
        </span>
      </div>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${current + 1} of ${total}: ${STEP_LABELS[current]}`}
      >
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className="h-[3px] flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= current ? 'var(--accent)' : 'var(--border2)' }}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Toggle ─────────────────────────────────────────────────────────────────

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({
  checked,
  onChange,
  disabled = false,
}) => (
  <div
    onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!checked); }}
    style={{
      width: 40,
      height: 22,
      borderRadius: 11,
      background: checked ? 'var(--accent)' : 'var(--border2)',
      position: 'relative',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 0.2s',
      opacity: disabled ? 0.5 : 1,
      flexShrink: 0,
    }}
  >
    <div style={{
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: '#fff',
      position: 'absolute',
      top: 3,
      left: checked ? 21 : 3,
      transition: 'left 0.18s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
    }} />
  </div>
);

// ─── ToggleRow ───────────────────────────────────────────────────────────────

const ToggleRow: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <div
    role="switch"
    aria-checked={checked}
    aria-label={label}
    tabIndex={0}
    onClick={() => onChange(!checked)}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!checked); } }}
    className={`flex items-center justify-between gap-4 py-[0.875rem] px-4 rounded-lg cursor-pointer border transition-[border-color,background] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${checked ? 'border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface2))]' : 'border-border bg-surface2'}`}
  >
    <div>
      <div className="text-[0.875rem] font-medium text-text leading-[1.3]">
        {label}
      </div>
      {description && (
        <div className="text-[0.775rem] text-text3 mt-[3px] leading-[1.4]">
          {description}
        </div>
      )}
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

// ─── WarningBox ──────────────────────────────────────────────────────────────

const WarningBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-[color-mix(in_srgb,var(--yellow)_10%,transparent)] border border-yellow rounded-md py-3 px-[0.875rem] text-yellow text-[0.8rem] leading-[1.5]">
    {children}
  </div>
);

// ─── NavButtons ──────────────────────────────────────────────────────────────

const NavButtons: React.FC<{
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}> = ({ onBack, onNext, nextLabel = 'Continue', nextDisabled = false, loading = false, fullWidth = false }) => (
  <div className={`flex items-center pt-1 ${onBack ? 'justify-between' : 'justify-end'}`}>
    {onBack && (
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 bg-transparent text-text2 border border-border rounded-lg py-[0.65rem] px-5 text-[0.875rem] font-medium cursor-pointer transition-[border-color,color] duration-150 hover:border-border2 hover:text-text"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>
    )}
    {onNext && (
      <button
        onClick={onNext}
        disabled={nextDisabled || loading}
        className={`flex items-center justify-center gap-1.5 border-none rounded-lg py-[0.7rem] px-5 text-[0.875rem] font-semibold transition-[background,color] duration-150 ${fullWidth && !onBack ? 'w-full' : ''} ${nextDisabled || loading ? 'bg-surface2 text-text3 cursor-not-allowed' : 'bg-accent text-white cursor-pointer'}`}
      >
        {loading ? (
          <>
            <span className="onboarding-spinner" />
            Setting up…
          </>
        ) : (
          <>
            {nextLabel}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </>
        )}
      </button>
    )}
  </div>
);

// ─── Step header (left-aligned, steps 1-5) ──────────────────────────────────

const StepHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="mb-1">
    <div className="text-[1.5rem] font-bold text-text leading-[1.15] tracking-[-0.02em]" style={{ textWrap: 'balance' }}>
      {title}
    </div>
    <div className="text-[0.875rem] text-text2 mt-[0.45rem] leading-[1.45]">
      {subtitle}
    </div>
  </div>
);

// ─── Step 0: Welcome ─────────────────────────────────────────────────────────

const Step0Welcome: React.FC<StepProps> = ({ onNext }) => (
  <div className="pt-9 px-7 pb-7 flex flex-col gap-7">
    <div className="text-center">
      <div className="w-[72px] h-[72px] rounded-[18px] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,var(--border))] flex items-center justify-center mx-auto mb-5">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
          <path d="M7 7h4M7 11h6" strokeLinecap="round" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M17 9v.01" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-[2.25rem] font-bold text-text tracking-[-0.03em] leading-[1.08]" style={{ textWrap: 'balance' }}>
        Welcome to WinCTL
      </div>
      <div className="text-[0.9375rem] text-text2 mt-2.5 max-w-[38ch] mx-auto leading-[1.5]">
        Your process manager for Windows. Fast, local, and in control.
      </div>
    </div>

    <div className="flex flex-col bg-surface2 rounded-xl border border-border overflow-hidden">
      {[
        {
          icon: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
          title: 'Spawn & supervise processes',
          desc: 'Auto-restart crashed services and capture logs in real time.',
        },
        {
          icon: <><circle cx="13.5" cy="6.5" r=".5" fill="var(--accent)" /><circle cx="17.5" cy="10.5" r=".5" fill="var(--accent)" /><circle cx="8.5" cy="7.5" r=".5" fill="var(--accent)" /><circle cx="6.5" cy="12.5" r=".5" fill="var(--accent)" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></>,
          title: 'Fully customizable',
          desc: 'Themes, fonts, and layout settings that stick.',
        },
        {
          icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
          title: 'Secure by default',
          desc: 'Runs locally, with a private access key for remote sign-in.',
        },
      ].map(({ icon, title, desc }, i) => (
        <div key={title} className={`flex items-center gap-3.5 py-[0.85rem] px-4 ${i > 0 ? 'border-t border-border' : ''}`}>
          <div className="w-9 h-9 rounded-lg bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {icon}
            </svg>
          </div>
          <div>
            <div className="text-[0.875rem] font-semibold text-text">{title}</div>
            <div className="text-[0.8rem] text-text3 mt-0.5 leading-[1.4]">{desc}</div>
          </div>
        </div>
      ))}
    </div>

    <NavButtons onNext={onNext} nextLabel="Get started" fullWidth />
  </div>
);

// ─── ThemeMiniPreview ─────────────────────────────────────────────────────────

const ThemeMiniPreview: React.FC<{ theme: Theme; selected: boolean; onClick: () => void }> = ({
  theme,
  selected,
  onClick,
}) => {
  const c = theme.colors;
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-label={theme.name}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{
        borderRadius: 8,
        border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
        transform: selected ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Preview area */}
      <div style={{ height: 64, background: c.bg || '#0d0f14', padding: '6px 6px 0', boxSizing: 'border-box' }}>
        {/* Header strip */}
        <div style={{
          height: 10,
          background: c.surface || '#13161d',
          borderRadius: '3px 3px 0 0',
          marginBottom: 4,
        }} />
        {/* Body row: sidebar + content */}
        <div style={{ display: 'flex', gap: 3, height: 'calc(100% - 14px)' }}>
          <div style={{ width: 14, background: c.surface || '#13161d', borderRadius: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, justifyContent: 'center' }}>
            <div style={{ height: 3, background: c.text || '#e8ecf5', borderRadius: 2, opacity: 0.5, width: '80%' }} />
            <div style={{ height: 3, background: c.text || '#e8ecf5', borderRadius: 2, opacity: 0.3, width: '55%' }} />
            <div style={{ height: 3, background: c.accent || '#3b82f6', borderRadius: 2, opacity: 0.8, width: '40%' }} />
          </div>
        </div>
      </div>
      {/* Label bar */}
      <div style={{
        padding: '5px 7px',
        background: c.surface || '#13161d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: `1px solid ${c.border || '#252a38'}`,
      }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: c.text || '#e8ecf5', opacity: 0.9 }}>
          {theme.name}
        </span>
        {selected && (
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: c.accent || '#3b82f6',
          }} />
        )}
      </div>
    </div>
  );
};

// ─── Step 1: Theme ────────────────────────────────────────────────────────────

const Step1Theme: React.FC<StepProps & { selectedTheme: string; onSelectTheme: (id: string) => void }> = ({
  onNext,
  onBack,
  selectedTheme,
  onSelectTheme,
}) => {
  const { themes, loadThemes, themesLoading } = useThemeStore();

  useEffect(() => {
    if (themes.length === 0) loadThemes();
  }, [themes.length, loadThemes]);

  const built_in = [...themes].filter((t) => t.built_in).sort((a, b) => a.name.localeCompare(b.name));
  const custom = [...themes].filter((t) => !t.built_in).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-7 flex flex-col gap-5">
      <StepHeader title="Choose your theme" subtitle="Pick a visual style that suits your workflow." />
      {themesLoading ? (
        <div className="text-center text-text3 py-8 text-[0.875rem]">
          Loading themes…
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto flex flex-col gap-4" role="radiogroup" aria-label="Theme">
            {built_in.length > 0 && (
              <div>
                <div className="text-[0.7rem] text-text3 mb-2.5 uppercase tracking-[0.07em] font-semibold">
                  Built-in
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {built_in.map((t) => (
                    <ThemeMiniPreview key={t.id} theme={t} selected={selectedTheme === t.id} onClick={() => { onSelectTheme(t.id); applyTheme(t.colors); }} />
                  ))}
                </div>
              </div>
            )}
            {custom.length > 0 && (
              <div>
                <div className="text-[0.7rem] text-text3 mb-2.5 uppercase tracking-[0.07em] font-semibold">
                  Custom
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {custom.map((t) => (
                    <ThemeMiniPreview key={t.id} theme={t} selected={selectedTheme === t.id} onClick={() => { onSelectTheme(t.id); applyTheme(t.colors); }} />
                  ))}
                </div>
              </div>
            )}
        </div>
      )}
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
};

// ─── Step 2: Font ─────────────────────────────────────────────────────────────

const Step2Font: React.FC<StepProps & { selectedFont: string; onSelectFont: (f: string) => void }> = ({
  onNext,
  onBack,
  selectedFont,
  onSelectFont,
}) => {
  const [fonts, setFonts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getInstalledFonts()
      .then(setFonts)
      .catch(() => setFonts([]))
      .finally(() => setLoading(false));
  }, []);

  const previewFont = selectedFont || 'system-ui';
  const filtered = fonts.filter((f) => f.toLowerCase().includes(search.toLowerCase()));

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '0.575rem 0.75rem',
    color: 'var(--text)',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-sans)',
  };

  return (
    <div className="p-7 flex flex-col gap-5">
      <StepHeader title="Choose your font" subtitle="Select a system font for the interface." />

      {/* Live preview */}
      <div className="py-[0.875rem] px-4 bg-surface2 rounded-lg border border-border">
        <div className="text-[0.65rem] text-text3 mb-[0.4rem] uppercase tracking-[0.07em] font-semibold">
          Preview — {selectedFont || 'System default'}
        </div>
        <div style={{ fontFamily: `"${previewFont}", system-ui, sans-serif`, color: 'var(--text)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
          The quick brown fox jumps over the lazy dog.
        </div>
        <div style={{ fontFamily: `"${previewFont}", system-ui, sans-serif`, color: 'var(--text2)', fontSize: '0.8rem', marginTop: 4 }}>
          0123456789 — Service manager, process control
        </div>
      </div>

      <input
        type="text"
        placeholder="Search fonts…"
        aria-label="Search fonts"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={inputStyle}
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0"
      />

      {loading ? (
        <div className="text-center text-text3 py-6 text-[0.875rem]">
          Loading fonts…
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto" role="radiogroup" aria-label="Interface font">
          {/* System default option */}
          <button
            type="button"
            role="radio"
            aria-checked={selectedFont === ''}
            onClick={() => onSelectFont('')}
            className={`flex items-center justify-between w-full text-left py-[0.6rem] px-3 rounded-md cursor-pointer border transition-[border-color,background] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${selectedFont === '' ? 'bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface2))] border-[color-mix(in_srgb,var(--accent)_35%,var(--border))]' : 'bg-surface2 border-border'}`}
          >
            <span className="text-[0.875rem] text-text">System default</span>
            <span className="text-[0.75rem] text-text3">Segoe UI</span>
          </button>
          {filtered.map((font) => (
            <button
              key={font}
              type="button"
              role="radio"
              aria-checked={selectedFont === font}
              onClick={() => onSelectFont(font)}
              className={`flex items-center justify-between w-full text-left py-[0.6rem] px-3 rounded-md cursor-pointer border transition-[border-color,background] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${selectedFont === font ? 'bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface2))] border-[color-mix(in_srgb,var(--accent)_35%,var(--border))]' : 'bg-surface2 border-border'}`}
            >
              <span style={{ fontFamily: `"${font}", sans-serif`, fontSize: '0.875rem', color: 'var(--text)' }}>
                {font}
              </span>
              {selectedFont === font && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
      <NavButtons onBack={onBack} onNext={onNext} />
    </div>
  );
};

// ─── Step 3: Autostart ────────────────────────────────────────────────────────

const Step3Autostart: React.FC<StepProps & { autostart: boolean; onToggleAutostart: (v: boolean) => void }> = ({
  onNext,
  onBack,
  autostart,
  onToggleAutostart,
}) => (
  <div className="p-7 flex flex-col gap-5">
    <StepHeader title="Start with Windows" subtitle="Choose how WinCTL launches at login." />
    <ToggleRow
      label="Launch WinCTL when Windows starts"
      description="Runs silently in the background so your services are always available."
      checked={autostart}
      onChange={onToggleAutostart}
    />
    {!autostart && (
      <div className="text-[0.775rem] text-text3 pl-0.5">
        You can enable autostart later in Settings → General.
      </div>
    )}
    <NavButtons onBack={onBack} onNext={onNext} />
  </div>
);

// ─── Step 4: Network ──────────────────────────────────────────────────────────

const ModeCard: React.FC<{
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}> = ({ selected, onClick, icon, label, description }) => (
  <div
    role="radio"
    aria-checked={selected}
    aria-label={label}
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    className={`flex-1 p-4 rounded-[10px] cursor-pointer transition-all duration-150 flex flex-col gap-2 border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${selected ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface2))]' : 'border-border bg-surface2'}`}
  >
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-[background] duration-150 ${selected ? 'bg-accent' : 'bg-border'}`}>
      {icon}
    </div>
    <div className="font-semibold text-[0.875rem] text-text">{label}</div>
    <div className="text-[0.775rem] text-text3 leading-[1.4]">{description}</div>
  </div>
);

const Step4Network: React.FC<StepProps & {
  lanMode: boolean;
  requirePassword: boolean;
  lanPort: string;
  useRandomPassword: boolean;
  lanPassword: string;
  onSetLanMode: (v: boolean) => void;
  onSetRequirePassword: (v: boolean) => void;
  onSetLanPort: (v: string) => void;
  onSetUseRandomPassword: (v: boolean) => void;
  onSetLanPassword: (v: string) => void;
  submitting: boolean;
}> = ({
  onNext, onBack,
  lanMode, requirePassword, lanPort, useRandomPassword, lanPassword,
  onSetLanMode, onSetRequirePassword, onSetLanPort, onSetUseRandomPassword, onSetLanPassword,
  submitting,
}) => {
  const [showPw, setShowPw] = useState(false);

  const portNum = parseInt(lanPort, 10);
  const portValid = !lanMode || (Number.isInteger(portNum) && portNum >= 1024 && portNum <= 65535);
  const passwordValid = !(lanMode && requirePassword && !useRandomPassword) || lanPassword.length >= 8;
  const canContinue = portValid && passwordValid;

  return (
  <div className="p-7 flex flex-col gap-5">
    <StepHeader title="Network access" subtitle="Where should WinCTL be reachable?" />

    <div className="flex gap-3">
      <ModeCard
        selected={!lanMode}
        onClick={() => onSetLanMode(false)}
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        }
        label="This machine only"
        description="Only accessible from localhost. Most secure."
      />
      <ModeCard
        selected={lanMode}
        onClick={() => onSetLanMode(true)}
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        }
        label="Local network (LAN)"
        description="Accessible from other devices on your network."
      />
    </div>

    <AnimatePresence>
      {lanMode && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-3">
            {/* Port */}
            <div>
              <label className="block text-text2 text-[0.775rem] font-medium mb-[0.4rem]">
                Port
              </label>
              <input
                type="number"
                min={1024}
                max={65535}
                value={lanPort}
                onChange={(e) => onSetLanPort(e.target.value)}
                aria-invalid={!portValid}
                className={`bg-surface2 border rounded-lg py-[0.6rem] px-[0.875rem] text-text text-[0.875rem] outline-none w-full box-border font-mono ${portValid ? 'border-border' : 'border-red'}`}
              />
              {!portValid && (
                <div className="text-[0.7rem] text-red mt-1">Enter a port between 1024 and 65535.</div>
              )}
            </div>

            {/* Require password toggle */}
            <ToggleRow
              label="Require an access key"
              description="Anyone on the LAN must authenticate with the access key."
              checked={requirePassword}
              onChange={onSetRequirePassword}
            />

            {/* Password config — shown when requirePassword is on */}
            <AnimatePresence>
              {requirePassword && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-2.5">
                    {/* Auto / Custom segmented control */}
                    <div className="flex bg-surface2 border border-border rounded-lg p-[3px]">
                      {(['auto', 'custom'] as const).map((mode) => {
                        const active = mode === 'auto' ? useRandomPassword : !useRandomPassword;
                        return (
                          <button
                            key={mode}
                            onClick={() => onSetUseRandomPassword(mode === 'auto')}
                            role="tab"
                            aria-selected={active}
                            className={`flex-1 p-[0.45rem] border-none rounded-md text-[0.8rem] cursor-pointer transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${active ? 'bg-surface text-text font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.3)]' : 'bg-transparent text-text3 font-normal shadow-none'}`}
                          >
                            {mode === 'auto' ? 'Auto-generate' : 'Choose my own'}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom password input */}
                    <AnimatePresence>
                      {!useRandomPassword && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden relative"
                        >
                          <input
                            type={showPw ? 'text' : 'password'}
                            placeholder="At least 8 characters"
                            value={lanPassword}
                            onChange={(e) => onSetLanPassword(e.target.value)}
                            aria-invalid={!passwordValid}
                            className={`bg-surface2 border rounded-lg py-[0.6rem] pr-10 pl-[0.875rem] text-text text-[0.875rem] outline-none w-full box-border ${passwordValid ? 'border-border' : 'border-red'} ${showPw ? '' : 'font-mono'}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-text3 p-0.5 flex"
                          >
                            {showPw ? (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </svg>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {useRandomPassword && (
                      <div className="text-[0.775rem] text-text3 leading-[1.4]">
                        A secure access key will be generated when you finish. It's shown once on the next screen, so copy it then. It's stored only as a hash and can't be recovered.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!requirePassword && (
              <WarningBox>
                ⚠ No password required. Anyone on your local network can fully control WinCTL. Only enable this on a trusted private network.
              </WarningBox>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!canContinue} loading={submitting} />
  </div>
  );
};



// ─── Step 5: Done / access key ────────────────────────────────────────────────

const Step5Done: React.FC<{ accessKey: string; openAccess: boolean; lanMode: boolean; onFinish: () => void }> = ({
  accessKey,
  openAccess,
  lanMode,
  onFinish,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(accessKey).then(() => {
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => setCopyFailed(true));
  };

  const note = openAccess
    ? 'Open access is enabled on your LAN — no password needed. Keep this key in case you enable access control later.'
    : lanMode
      ? 'Use this key to sign in from other devices on your network. It’s stored only as a hash — save it now, it can’t be shown again.'
      : 'Local-only for now. Save this key if you might enable remote access later — it can’t be shown again.';

  return (
    <div className="pt-9 px-7 pb-7 flex flex-col gap-6">
      <div className="text-center">
        <div className="w-[60px] h-[60px] rounded-full bg-[color-mix(in_srgb,var(--green)_14%,transparent)] border border-[color-mix(in_srgb,var(--green)_30%,var(--border))] flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div className="text-[1.4rem] font-bold text-text">You’re all set</div>
        <div className="text-[0.9rem] text-text2 mt-[0.4rem]">
          WinCTL is configured and ready to go.
        </div>
      </div>

      <div>
        <label className="block text-text2 text-[0.775rem] font-medium mb-[0.4rem]">
          Your access key
        </label>
        <div className="flex gap-2">
          <code className="flex-1 bg-surface2 border border-border rounded-lg py-[0.6rem] px-[0.875rem] text-text text-[0.9rem] font-mono tracking-[0.03em] break-all">
            {accessKey}
          </code>
          <button
            type="button"
            onClick={copy}
            className={`text-white border-none rounded-lg py-0 px-4 text-[0.8rem] font-semibold cursor-pointer transition-[background] duration-150 whitespace-nowrap ${copied ? 'bg-green' : 'bg-accent'}`}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="text-[0.775rem] text-text3 mt-2 leading-[1.45]">
          {note}
        </div>
        {copyFailed && (
          <div role="alert" className="text-[0.75rem] text-yellow mt-1.5">
            Couldn't access the clipboard. Select the key above and copy it manually.
          </div>
        )}
      </div>

      <NavButtons onNext={onFinish} nextLabel="Finish" />
    </div>
  );
};

// ─── Slide variants ───────────────────────────────────────────────────────────

const makeSlideVariants = (reduce: boolean) => ({
  initial: (dir: number) => ({ x: reduce ? 0 : dir * 24, opacity: 0 }),
  animate: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: reduce ? 0 : dir * -24, opacity: 0 }),
});

// ─── Main flow ────────────────────────────────────────────────────────────────

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedTheme, setSelectedTheme] = useState('winctl');
  const [selectedFont, setSelectedFont] = useState('');
  const [autostart, setAutostart] = useState(false);
  const [lanMode, setLanMode] = useState(false);
  const [requirePassword, setRequirePassword] = useState(true);
  const [lanPort, setLanPort] = useState('8888');
  const [useRandomPassword, setUseRandomPassword] = useState(true);
  const [lanPassword, setLanPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessKey, setAccessKey] = useState('');
  const [resolvedOpenAccess, setResolvedOpenAccess] = useState(false);
  const inFlight = useRef(false);
  const headingRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const slideVariants = makeSlideVariants(reduce);

  const go = (step: number) => {
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  };

  // Move focus to the panel on each step change so keyboard/AT users don't get
  // dropped to <body> when the previous step's buttons unmount.
  useEffect(() => {
    headingRef.current?.focus();
  }, [currentStep]);

  const handleComplete = async () => {
    if (inFlight.current) return;   // synchronous double-submit guard
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const resolvedSecret = lanMode && requirePassword
        ? (useRandomPassword ? safeRandomUUID().split('-').join('').slice(0, 16) : lanPassword)
        : safeRandomUUID().split('-').join('').slice(0, 16);

      // Save preferences BEFORE the irreversible complete_setup, so a failure
      // here leaves setup un-committed and retryable (settings merge preserves
      // secrets and network fields, which complete_setup writes last anyway).
      await saveSettingsAPI({
        theme: selectedTheme,
        customFont: selectedFont || null,
        autoStart: autostart,
      } as any);

      await completeSetup({
        api_secret: resolvedSecret,
        open_access: lanMode ? !requirePassword : false,
        bind_host: lanMode ? '0.0.0.0' : '127.0.0.1',
        port: lanMode ? parseInt(lanPort, 10) : undefined,
      });

      const openAccess = lanMode && !requirePassword;
      // Show the access key before finishing — it's stored only as a hash, so
      // this is the one chance to save an auto-generated password.
      setAccessKey(resolvedSecret);
      setResolvedOpenAccess(openAccess);
      setDirection(1);
      setCurrentStep(5);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Setup failed. Please try again.';
      // 409: setup already completed server-side (lost response, reload, or a
      // second instance). No dead-end — move the user forward to sign in.
      if (/already complete/i.test(msg)) {
        onComplete(false);
        return;
      }
      console.error('Setup failed:', e);
      setError(msg);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const showStepper = currentStep > 0 && currentStep <= STEP_LABELS.length;

  return (
    <>
      <style>{`
        @keyframes onboarding-spin {
          to { transform: rotate(360deg); }
        }
        .onboarding-spinner {
          display: inline-block;
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: onboarding-spin 0.7s linear infinite;
        }
      `}</style>
      <div className="flex items-center justify-center min-h-screen bg-bg p-6 relative overflow-hidden">
        <GenerativeBackground />
        <div className="w-full max-w-[500px] relative z-[1]">
          <div className="bg-[var(--glass-bg)] bg-[image:var(--glass-sheen)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl shadow-[var(--glass-highlight),var(--shadow-modal)] overflow-hidden max-h-[92vh] overflow-y-auto">
            {showStepper && <Stepper current={currentStep - 1} />}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                ref={headingRef}
                tabIndex={-1}
                custom={direction}
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="outline-none"
              >
                {currentStep === 0 && (
                  <Step0Welcome onNext={() => go(1)} />
                )}
                {currentStep === 1 && (
                  <Step1Theme
                    onNext={() => go(2)}
                    onBack={() => go(0)}
                    selectedTheme={selectedTheme}
                    onSelectTheme={setSelectedTheme}
                  />
                )}
                {currentStep === 2 && (
                  <Step2Font
                    onNext={() => go(3)}
                    onBack={() => go(1)}
                    selectedFont={selectedFont}
                    onSelectFont={setSelectedFont}
                  />
                )}
                {currentStep === 3 && (
                  <Step3Autostart
                    onNext={() => go(4)}
                    onBack={() => go(2)}
                    autostart={autostart}
                    onToggleAutostart={setAutostart}
                  />
                )}
                {currentStep === 4 && (
                  <Step4Network
                    onNext={handleComplete}
                    onBack={() => go(3)}
                    lanMode={lanMode}
                    requirePassword={requirePassword}
                    lanPort={lanPort}
                    useRandomPassword={useRandomPassword}
                    lanPassword={lanPassword}
                    onSetLanMode={setLanMode}
                    onSetRequirePassword={setRequirePassword}
                    onSetLanPort={setLanPort}
                    onSetUseRandomPassword={setUseRandomPassword}
                    onSetLanPassword={setLanPassword}
                    submitting={loading}
                  />
                )}
                {currentStep === 5 && (
                  <Step5Done
                    accessKey={accessKey}
                    openAccess={resolvedOpenAccess}
                    lanMode={lanMode}
                    onFinish={() => onComplete(resolvedOpenAccess)}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {error && (
              <motion.div
                role="alert"
                aria-live="assertive"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 py-3 px-4 bg-[color-mix(in_srgb,var(--red)_15%,transparent)] border border-red rounded-lg text-red text-[0.875rem]"
              >
                {error}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingFlow;
