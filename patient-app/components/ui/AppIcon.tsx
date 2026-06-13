import {
  IconBook,
  IconCalendar,
  IconCamera,
  IconChartBar,
  IconChevronRight,
  IconDroplet,
  IconEye,
  IconFlame,
  IconHome,
  IconScan,
  IconUser,
} from '@tabler/icons-react-native';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type AppIconName =
  | 'home'
  | 'camera'
  | 'scan'
  | 'chart-bar'
  | 'user'
  | 'book'
  | 'droplet'
  | 'eye'
  | 'flame'
  | 'calendar'
  | 'chevron-right';

const ICONS = {
  home: IconHome,
  camera: IconCamera,
  scan: IconScan,
  'chart-bar': IconChartBar,
  user: IconUser,
  book: IconBook,
  droplet: IconDroplet,
  eye: IconEye,
  flame: IconFlame,
  calendar: IconCalendar,
  'chevron-right': IconChevronRight,
} as const;

type Props = {
  name: AppIconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/** Tabler outline icons — spec requires outline-only, never filled. */
export function AppIcon({ name, size = 24, color, strokeWidth = 1.75, style }: Props) {
  const Icon = ICONS[name];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}
