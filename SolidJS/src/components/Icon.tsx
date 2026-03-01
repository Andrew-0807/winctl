import { Component, JSX } from 'solid-js';
import * as LucideIcons from 'lucide-solid';

export interface IconProps {
  name: string;
  size?: number;
  class?: string;
  color?: string;
  strokeWidth?: number;
}

const Icon: Component<IconProps> = (props) => {
  const size = () => props.size ?? 16;
  
  const iconMap: Record<string, any> = {
    'LayoutGrid': LucideIcons.LayoutGrid,
    'Play': LucideIcons.Play,
    'Square': LucideIcons.Square,
    'Settings': LucideIcons.Settings,
    'Folder': LucideIcons.Folder,
    'FolderOpen': LucideIcons.FolderOpen,
    'Plus': LucideIcons.Plus,
    'X': LucideIcons.X,
    'ChevronLeft': LucideIcons.ChevronLeft,
    'ChevronRight': LucideIcons.ChevronRight,
    'RefreshCw': LucideIcons.RefreshCw,
    'Trash': LucideIcons.Trash,
    'Edit': LucideIcons.Edit,
    'Save': LucideIcons.Save,
    'Copy': LucideIcons.Copy,
    'Download': LucideIcons.Download,
    'Upload': LucideIcons.Upload,
    'Search': LucideIcons.Search,
    'Filter': LucideIcons.Filter,
    'Menu': LucideIcons.Menu,
    'Home': LucideIcons.Home,
    'Server': LucideIcons.Server,
    'Activity': LucideIcons.Activity,
    'Power': LucideIcons.Power,
    'PlayCircle': LucideIcons.PlayCircle,
    'StopCircle': LucideIcons.StopCircle,
    'RotateCcw': LucideIcons.RotateCcw,
    'RotateCw': LucideIcons.RotateCcw,
    'Terminal': LucideIcons.Terminal,
    'ExternalLink': LucideIcons.ExternalLink,
    'Shield': LucideIcons.Shield,
    'ShieldCheck': LucideIcons.ShieldCheck,
    'Path': LucideIcons.Route,
    'AlertCircle': LucideIcons.AlertCircle,
    'CheckCircle': LucideIcons.CheckCircle,
    'Info': LucideIcons.Info,
    'Clock': LucideIcons.Clock,
    'Calendar': LucideIcons.Calendar,
    'User': LucideIcons.User,
    'Users': LucideIcons.Users,
    'Cpu': LucideIcons.Cpu,
    'HardDrive': LucideIcons.HardDrive,
    'Wifi': LucideIcons.Wifi,
    'Globe': LucideIcons.Globe,
    'Link': LucideIcons.Link,
    'Unlink': LucideIcons.Unlink,
    'File': LucideIcons.File,
    'FileText': LucideIcons.FileText,
    'FolderMinus': LucideIcons.FolderMinus,
    'FolderPlus': LucideIcons.FolderPlus,
    'Minimize': LucideIcons.Minimize2,
    'Maximize': LucideIcons.Maximize,
    'Close': LucideIcons.X,
    'Minimize2': LucideIcons.Minimize2,
    'Maximize2': LucideIcons.Maximize2,
    'Laptop': LucideIcons.Laptop,
    'Monitor': LucideIcons.Laptop,
    'ArrowDown': LucideIcons.ArrowDown,
    'ArrowUp': LucideIcons.ArrowUp,
  };

  const getIcon = () => {
    return iconMap[props.name] || LucideIcons.Circle;
  };

  const iconProps = (): JSX.HTMLAttributes<SVGSVGElement> => {
    const baseProps: any = {
      width: size(),
      height: size(),
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: props.color || 'currentColor',
      'stroke-width': props.strokeWidth ?? 2,
      'stroke-linecap': 'round' as const,
      'stroke-linejoin': 'round' as const,
    };
    if (props.class) {
      baseProps.class = props.class;
    }
    return baseProps;
  };

  const LucideIcon = getIcon();
  
  return (
    <LucideIcon {...iconProps()} />
  );
};

export default Icon;
