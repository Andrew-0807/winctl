import React from 'react';
import * as LucideIcons from 'lucide-react';

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  color?: string;
  strokeWidth?: number;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  List: LucideIcons.List,
  LayoutGrid: LucideIcons.LayoutGrid,
  Play: LucideIcons.Play,
  Square: LucideIcons.Square,
  Settings: LucideIcons.Settings,
  Folder: LucideIcons.Folder,
  FolderOpen: LucideIcons.FolderOpen,
  Plus: LucideIcons.Plus,
  X: LucideIcons.X,
  ChevronLeft: LucideIcons.ChevronLeft,
  ChevronRight: LucideIcons.ChevronRight,
  ChevronDown: LucideIcons.ChevronDown,
  RefreshCw: LucideIcons.RefreshCw,
  Trash: LucideIcons.Trash,
  Edit: LucideIcons.Edit,
  Save: LucideIcons.Save,
  Copy: LucideIcons.Copy,
  Download: LucideIcons.Download,
  Upload: LucideIcons.Upload,
  Search: LucideIcons.Search,
  Filter: LucideIcons.Filter,
  Menu: LucideIcons.Menu,
  Home: LucideIcons.Home,
  Server: LucideIcons.Server,
  Activity: LucideIcons.Activity,
  Power: LucideIcons.Power,
  PlayCircle: LucideIcons.PlayCircle,
  StopCircle: LucideIcons.StopCircle,
  RotateCcw: LucideIcons.RotateCcw,
  RotateCw: LucideIcons.RotateCw,
  Terminal: LucideIcons.Terminal,
  ExternalLink: LucideIcons.ExternalLink,
  Shield: LucideIcons.Shield,
  ShieldCheck: LucideIcons.ShieldCheck,
  Path: LucideIcons.Route,
  AlertTriangle: LucideIcons.AlertTriangle,
  AlertCircle: LucideIcons.AlertCircle,
  CheckCircle: LucideIcons.CheckCircle,
  Info: LucideIcons.Info,
  Clock: LucideIcons.Clock,
  Calendar: LucideIcons.Calendar,
  User: LucideIcons.User,
  Users: LucideIcons.Users,
  Cpu: LucideIcons.Cpu,
  HardDrive: LucideIcons.HardDrive,
  Wifi: LucideIcons.Wifi,
  Globe: LucideIcons.Globe,
  Link: LucideIcons.Link,
  Unlink: LucideIcons.Unlink,
  File: LucideIcons.File,
  FileText: LucideIcons.FileText,
  FolderMinus: LucideIcons.FolderMinus,
  FolderPlus: LucideIcons.FolderPlus,
  Minimize: LucideIcons.Minimize2,
  Maximize: LucideIcons.Maximize,
  Close: LucideIcons.X,
  Minimize2: LucideIcons.Minimize2,
  Maximize2: LucideIcons.Maximize2,
  Laptop: LucideIcons.Laptop,
  Monitor: LucideIcons.Monitor,
  Eye: LucideIcons.Eye,
  Moon: LucideIcons.Moon,
  LogOut: LucideIcons.LogOut,
  ArrowDown: LucideIcons.ArrowDown,
  ArrowUp: LucideIcons.ArrowUp,
  GripVertical: LucideIcons.GripVertical,
  Circle: LucideIcons.Circle,
};

const Icon: React.FC<IconProps> = ({ name, size = 16, className, color, strokeWidth = 2 }) => {
  const LucideIcon = iconMap[name] || LucideIcons.Circle;
  return (
    <LucideIcon
      size={size}
      className={className}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
};

export default Icon;
