import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppTokens } from '@/constants/appTokens';
import { CALENDAR_LEGEND } from '@/lib/calendar-legend';

/** P7.28 — Legend: icon + color (never color-only). */
export function FactsCalendarLegend() {
  return (
    <View
      style={styles.wrap}
      testID="calendar-legend"
      accessibilityLabel="Calendar legend: each record type has an icon and a color">
      {CALENDAR_LEGEND.map((item) => (
        <View
          key={item.tag}
          style={styles.row}
          testID={`calendar-legend-${item.tag}`}
          accessibilityLabel={`${item.label}, icon and color`}>
          <AppIcon name={item.icon as import('@/components/ui/AppIcon').AppIconName} size={14} color={item.color} />
          <View style={[styles.swatch, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 6,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    color: AppTokens.color.muted,
    fontWeight: '500',
  },
});
