import { Tabs, usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppTokens } from '@/constants/appTokens';
import {
  shouldHideTabBar,
  TAB_SHELL_LABELS,
  type TabShellRoute,
} from '@/lib/tab-shell';

const TAB_ICONS: Record<TabShellRoute, AppIconName> = {
  calendar: 'calendar',
  shelf: 'droplet',
  track: 'camera',
  progress: 'chart-bar',
  account: 'user',
};

/**
 * P7.01 — Visible 5-tab shell: Calendar | Shelf | Track | Progress | Profile.
 * P7.02 — Hide tab bar during active capture transaction only.
 */
export default function TabLayout() {
  const pathname = usePathname();
  const hideForCapture = shouldHideTabBar(pathname);

  const tabBarStyle = useMemo(
    () =>
      hideForCapture
        ? styles.tabBarHidden
        : [
            styles.tabBar,
            Platform.select({
              ios: styles.tabBarIos,
              default: styles.tabBarDefault,
            }),
          ],
    [hideForCapture],
  );

  return (
    <View
      style={styles.root}
      testID="auth-shell-five-tabs"
      accessibilityLabel={
        hideForCapture ? 'auth-shell-tabs-hidden-for-capture' : 'auth-shell-tabs-visible'
      }>
      <Tabs
        initialRouteName="progress"
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: AppTokens.color.ink,
          tabBarInactiveTintColor: AppTokens.color.hint,
          tabBarStyle,
          tabBarLabelStyle: styles.tabLabel,
          sceneStyle: { backgroundColor: AppTokens.color.pageBg },
        }}>
        <Tabs.Screen
          name="calendar"
          options={{
            title: TAB_SHELL_LABELS.calendar,
            tabBarIcon: ({ color }) => (
              <AppIcon name={TAB_ICONS.calendar} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="shelf"
          options={{
            title: TAB_SHELL_LABELS.shelf,
            tabBarIcon: ({ color }) => <AppIcon name={TAB_ICONS.shelf} size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="track"
          options={{
            title: TAB_SHELL_LABELS.track,
            tabBarIcon: ({ color }) => <AppIcon name={TAB_ICONS.track} size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: TAB_SHELL_LABELS.progress,
            tabBarIcon: ({ color }) => (
              <AppIcon name={TAB_ICONS.progress} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: TAB_SHELL_LABELS.account,
            tabBarIcon: ({ color }) => (
              <AppIcon name={TAB_ICONS.account} size={22} color={color} />
            ),
          }}
        />
        {/* Not in the 5-tab shell — addressable via router only */}
        <Tabs.Screen name="scan" options={{ href: null }} />
        <Tabs.Screen name="_journal" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppTokens.color.pageBg,
  },
  tabBar: {
    backgroundColor: AppTokens.color.pageBg,
    borderTopColor: AppTokens.color.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabBarIos: {
    position: 'absolute',
  },
  tabBarDefault: {
    height: 60,
    paddingBottom: 6,
  },
  tabBarHidden: {
    display: 'none',
    height: 0,
    overflow: 'hidden',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
