/**
 * v4.1 tab line-icons — calendar grid, bottle (Shelf), trending-up (Progress), person (Profile).
 * Track uses TrackFab separately — not an icon glyph.
 */
import {
  IconBottle,
  IconCalendar,
  IconTrendingUp,
  IconUser,
} from '@tabler/icons-react-native';
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type TabLineIconName = 'calendar' | 'shelf' | 'progress' | 'profile';

const ICONS = {
  calendar: IconCalendar,
  shelf: IconBottle,
  progress: IconTrendingUp,
  profile: IconUser,
} as const;

type Props = {
  name: TabLineIconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function TabLineIcon({
  name,
  size = 22,
  color,
  strokeWidth = 1.75,
  style,
  testID,
}: Props) {
  const Icon = ICONS[name];
  return (
    <View testID={testID ?? `tab-line-icon-${name}`} style={style}>
      <Icon size={size} color={color} strokeWidth={strokeWidth} />
    </View>
  );
}
