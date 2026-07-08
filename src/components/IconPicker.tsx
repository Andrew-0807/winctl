import React, { useState, useRef, useMemo } from 'react';
import ServiceIcon, { LUCIDE_ICON_NAMES } from './ServiceIcon';
import Icon from './Icon';

const MAX_UPLOAD_BYTES = 256 * 1024;
const ICON_PX = 64;
const GRID_LIMIT = 120;

/** Convert an uploaded file to a small data URI. SVG embedded as-is; raster downscaled to 64px PNG. */
async function fileToIcon(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Image too large (max 256 KB)');
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  if (isSvg) {
    const text = await file.text();
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Invalid image'));
    i.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = ICON_PX;
  canvas.height = ICON_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  const scale = Math.min(ICON_PX / img.width, ICON_PX / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (ICON_PX - w) / 2, (ICON_PX - h) / 2, w, h);
  return canvas.toDataURL('image/png');
}

interface Props {
  value?: string | null;
  onChange: (icon: string | null) => void;
}

const IconPicker: React.FC<Props> = ({ value, onChange }) => {
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? LUCIDE_ICON_NAMES.filter((n) => n.toLowerCase().includes(q)) : LUCIDE_ICON_NAMES;
    return list.slice(0, GRID_LIMIT);
  }, [search]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      onChange(await fileToIcon(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="form-group full">
      <label>Icon</label>
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-10 h-10 rounded-lg border border-border bg-surface2 flex items-center justify-center text-text2 shrink-0">
          {value ? <ServiceIcon icon={value} size={24} /> : <span className="text-[11px] text-text3">None</span>}
        </div>
        <button type="button" className="btn-cancel" onClick={() => fileRef.current?.click()}>
          <Icon name="Upload" size={13} /> Upload PNG/SVG
        </button>
        {value && (
          <button type="button" className="btn-cancel" onClick={() => onChange(null)}>
            <Icon name="X" size={13} /> Remove
          </button>
        )}
        <input ref={fileRef} type="file" accept=".png,.svg,.jpg,.jpeg,image/*" onChange={handleUpload} className="hidden" />
      </div>

      {error && <div className="text-red text-xs mb-1.5">{error}</div>}

      <input
        type="text"
        className="form-input"
        placeholder="Search icons…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
      />
      <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto mt-2 p-1.5 bg-surface2 rounded-lg border border-border">
        {matches.map((name) => {
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onChange(name)}
              className={`aspect-square flex items-center justify-center rounded-md cursor-pointer text-text2 border ${selected ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]' : 'border-transparent bg-surface'}`}
            >
              <ServiceIcon icon={name} size={18} />
            </button>
          );
        })}
        {matches.length === 0 && (
          <div className="col-span-full text-center text-text3 text-xs p-3">
            No icons match “{search}”.
          </div>
        )}
      </div>
    </div>
  );
};

export default IconPicker;
