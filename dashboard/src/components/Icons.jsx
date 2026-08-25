import React from 'react';

// Default SVG props helper
const defaultProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
};

export const ScalesIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M12 3v18" />
    <path d="M4 7h16" />
    <path d="M4 7l-2 6a4 4 0 0 0 8 0L8 7" />
    <path d="M16 7l-2 6a4 4 0 0 0 8 0L20 7" />
    <path d="M8 21h8" />
  </svg>
);

export const GavelIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="m14 13-7.5 7.5a2.12 2.12 0 1 1-3-3L11 10" />
    <path d="m16 16 6-6" />
    <path d="m8 8 6-6" />
    <path d="m9 7 8 8" />
    <path d="m21 11-8-8" />
  </svg>
);

export const BriefcaseIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <rect width="20" height="14" x="2" y="7" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <path d="M12 12v2" />
    <path d="M2 12h20" />
  </svg>
);

export const DashboardIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);

export const CalendarIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
  </svg>
);

export const DocumentIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" x2="16" y1="13" y2="13" />
    <line x1="8" x2="14" y1="17" y2="17" />
  </svg>
);

export const LedgerIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M6 3v18" />
    <path d="M10 8h7" />
    <path d="M10 12h7" />
    <path d="M10 16h4" />
  </svg>
);

export const IngestionIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

export const WhatsAppIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export const VaultIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="m14.5 9.5 2-2" />
    <path d="m9.5 14.5-2 2" />
    <path d="m9.5 9.5-2-2" />
    <path d="m14.5 14.5 2 2" />
  </svg>
);

export const StrategyIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" />
  </svg>
);

export const AssistantIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M12 2a8 8 0 0 0-8 8c0 3.3 2 6.2 5 7.4V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.6c3-1.2 5-4.1 5-7.4a8 8 0 0 0-8-8z" />
    <path d="M9 10h.01" />
    <path d="M15 10h.01" />
    <path d="M10 14h4" />
  </svg>
);

export const ReportIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <line x1="18" x2="18" y1="20" y2="10" />
    <line x1="12" x2="12" y1="20" y2="4" />
    <line x1="6" x2="6" y1="20" y2="14" />
  </svg>
);

export const IntakeIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

export const SettingsIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const ShieldIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export const UserIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const UsersIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const ClockIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const SyncIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M21.5 2v6h-6" />
    <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
  </svg>
);

export const AlertIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

export const CheckIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const SearchIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
  </svg>
);

export const PlusIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);

export const LockIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const UnlockIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

export const BellIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export const ChevronRightIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export const ChevronLeftIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const LogOutIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </svg>
);
export const LogoutIcon = LogOutIcon;

export const EditIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

export const TrashIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const FilterIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export const DownloadIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

export const PrintIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect width="12" height="8" x="6" y="14" />
  </svg>
);

export const CopyIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

export const StarIcon = ({ size = 16, filled = false, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} fill={filled ? (color || 'currentColor') : 'none'} style={{ ...defaultProps.style, ...style }} {...props}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const FolderIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const FileCodeIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="m10 13-2 2 2 2" />
    <path d="m14 17 2-2-2-2" />
  </svg>
);

export const HistoryIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

export const SendIcon = ({ size = 16, color, style, ...props }) => (
  <svg {...defaultProps} width={size} height={size} stroke={color || 'currentColor'} style={{ ...defaultProps.style, ...style }} {...props}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

