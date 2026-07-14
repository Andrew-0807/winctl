import React from 'react';

interface ToggleProps {
  on: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name — what this switch controls (announced by screen readers). */
  label: string;
  disabled?: boolean;
}

/**
 * Accessible on/off switch. Replaces the old inline `<div className="toggle">`
 * that keyboard and screen-reader users could not operate. Same classes, so the
 * neu/glass styling is unchanged.
 */
const Toggle: React.FC<ToggleProps> = ({ on, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    className={`toggle ${on ? 'on' : ''}`}
    onClick={() => !disabled && onChange(!on)}
  />
);

export default Toggle;
