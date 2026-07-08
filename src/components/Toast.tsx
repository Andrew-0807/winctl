import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore, type Toast as ToastType } from '../stores/ui';

const ToastContainer: React.FC = () => {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div id="toast">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast-item ${t.type}`}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.36, bounce: 0.1 }}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
