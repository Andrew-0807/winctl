import React from 'react';
import * as LucideIcons from 'lucide-react';

// lucide-react re-exports helpers and `*Icon` aliases alongside the real icon
// components. Keep PascalCase names that aren't the alias duplicates or helpers.
const NON_ICON = new Set(['createLucideIcon', 'Icon', 'icons', 'default', 'LucideIcon']);

export const LUCIDE_ICON_NAMES: string[] = Object.keys(LucideIcons)
  .filter((k) => /^[A-Z][A-Za-z0-9]*$/.test(k) && !k.endsWith('Icon') && !NON_ICON.has(k))
  .sort();

interface Props {
  icon?: string | null;
  size?: number;
  className?: string;
  color?: string;
}

/** Renders a service icon: nothing if empty, <img> for a data URI, else a Lucide icon. */
const ServiceIcon: React.FC<Props> = ({ icon, size = 16, className, color }) => {
  if (!icon) return null;
  if (icon.startsWith('data:')) {
    return (
      <img
        src={icon}
        width={size}
        height={size}
        className={`rounded object-contain block shrink-0 ${className ?? ''}`}
        alt=""
      />
    );
  }
  const Cmp = (LucideIcons as any)[icon] as React.ComponentType<any> | undefined;
  if (!Cmp) return null;
  return <Cmp size={size} className={className} color={color} />;
};

export default ServiceIcon;
