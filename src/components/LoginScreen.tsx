import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useServiceStore } from '../stores/services';
import GenerativeBackground from './GenerativeBackground';

const LoginScreen: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const login = useServiceStore((s) => s.login);
  const registerDevice = useServiceStore((s) => s.registerDevice);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      await login(password);
      if (trustDevice) {
        const deviceId = crypto.randomUUID();
        const hostname = window.navigator.userAgent;
        await registerDevice(deviceId, hostname);
      }
    } catch {
      setError('Invalid access key. Make sure the WinCTL daemon is running and check ~/.config/winctl/settings.json for your key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center h-screen bg-bg overflow-hidden">
      <GenerativeBackground />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.6, bounce: 0.12 }}
        className="relative z-[1] bg-[var(--glass-bg)] bg-[image:var(--glass-sheen)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)] rounded-2xl px-8 py-10 w-full max-w-[340px] flex flex-col gap-6 shadow-[var(--glass-highlight),var(--shadow-modal)]"
      >
        <div className="text-center flex flex-col gap-2">
          <div className="text-[1.8rem] font-extrabold text-text tracking-[-0.03em] flex justify-center gap-[0.02em] [text-shadow:0_2px_10px_rgba(0,0,0,0.2)]">
            {"WinCTL".split("").map((char, i) => (
              <motion.span
                key={i}
                initial={{ y: 15, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: i * 0.04, stiffness: 160, damping: 10 }}
              >
                {char}
              </motion.span>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-text2 text-[0.85rem]"
          >
            Enter your access key to continue
          </motion.div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label htmlFor="login-password" className="sr-only">Access key</label>
          <input
            id="login-password"
            type="password"
            placeholder="Access key"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="bg-surface2 border border-border rounded-lg py-[0.7rem] px-[0.9rem] text-text text-[0.9rem] outline-none w-full box-border font-mono transition-[border-color] duration-200"
            autoComplete="current-password"
          />
          {error && <div className="text-red text-[0.8rem] leading-[1.4]">{error}</div>}

          <label className="flex items-start gap-3 cursor-pointer py-1">
            <div
              role="checkbox"
              aria-checked={trustDevice}
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setTrustDevice(!trustDevice); }}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setTrustDevice(!trustDevice); } }}
              className={`w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0 mt-0.5 cursor-pointer border transition-[background,border-color] duration-200 ${trustDevice ? 'bg-accent border-accent' : 'bg-surface2 border-border'}`}
            >
              {trustDevice && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
            <div>
              <div className="text-text text-[0.8rem] font-medium">Trust this device</div>
              <div className="text-text3 text-[0.7rem]">Skip re-authentication on this device</div>
            </div>
          </label>
          
          <motion.button
            type="submit"
            disabled={loading || !password}
            whileHover={{ scale: 1.02, backgroundColor: 'var(--accent)' }}
            whileTap={{ scale: 0.98 }}
            className={`bg-accent text-white border-none rounded-lg p-[0.7rem] text-[0.9rem] font-semibold cursor-pointer shadow-[0_4px_12px_var(--accent-glow)] transition-[opacity,background-color] ${loading || !password ? 'opacity-60' : 'opacity-100'}`}
          >
            {loading ? 'Connecting…' : 'Connect'}
          </motion.button>
        </form>

        <div className="text-text3 text-[0.75rem] text-center leading-[1.4]">
          Your access key is printed in the daemon console on first startup,
          or find it in <code className="text-[0.7rem]">~/.config/winctl/settings.json</code>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginScreen;
