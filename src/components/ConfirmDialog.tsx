import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../stores/ui';

const ConfirmDialog: React.FC = () => {
  const confirmState = useUIStore((s) => s.confirmState);
  const resolveConfirm = useUIStore((s) => s.resolveConfirm);

  return (
    <AnimatePresence>
      {confirmState && (
        <div
          className="modal-backdrop open"
          onClick={(e) => {
            if ((e.target as HTMLElement).classList.contains('modal-backdrop')) resolveConfirm(false);
          }}
        >
          <motion.div
            className="modal max-w-[420px] w-[92%]"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.32, bounce: 0.12 }}
          >
            <div className="modal-header">
              <div className="modal-title">{confirmState.title ?? 'Confirm'}</div>
              <button className="modal-close" onClick={() => resolveConfirm(false)} title="Close">×</button>
            </div>
            <div className="modal-body">
              <p className="mt-0 mx-0 mb-4 text-text2 text-[13px] leading-relaxed">{confirmState.message}</p>
              <div className="flex gap-2 justify-end">
                <button className="btn-cancel" onClick={() => resolveConfirm(false)}>
                  {confirmState.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  className="btn-confirm"
                  style={{ '--tone': confirmState.danger ? 'var(--red)' : 'var(--accent)' } as React.CSSProperties}
                  onClick={() => resolveConfirm(true)}
                >
                  {confirmState.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
