import { Tabs, usePathname, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { TabLineIcon } from '@/components/v4/TabLineIcon';
import { TrackFab } from '@/components/v4/TrackFab';
import { AppTokens } from '@/constants/appTokens';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { MARK_PICKER_HREF } from '@/constants/routes';
import {
  shouldHideTabBar,
  TAB_SHELL_LABELS,
} from '@/lib/tab-shell';

/**
 * P7.01 — Visible 5-tab shell: Calendar | Shelf | Track | Progress | Profile.
 * P7.02 — Hide tab bar during active capture transaction only.
 * Wave 0: line-icons + raised Track FAB (v4.1).
 */
export default function TabLayout() {
  const pathname = usePathname();
  const router = useRouter();
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
          tabBarActiveTintColor: V4DesignTokens.color.white,
          tabBarInactiveTintColor: 'rgba(255,255,255,0.42)',
          tabBarStyle,
          tabBarLabelStyle: styles.tabLabel,
          sceneStyle: { backgroundColor: AppTokens.color.pageBg },
        }}>
        <Tabs.Screen
          name="calendar"
          options={{
            title: TAB_SHELL_LABELS.calendar,
            tabBarIcon: ({ color }) => <TabLineIcon name="calendar" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="shelf"
          options={{
            title: TAB_SHELL_LABELS.shelf,
            tabBarIcon: ({ color }) => <TabLineIcon name="shelf" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="track"
          options={{
            title: TAB_SHELL_LABELS.track,
            tabBarLabel: () => null,
            tabBarIcon: () => (
              <TrackFab
                size={56}
                style={styles.fabLift}
                onPress={() => router.push(MARK_PICKER_HREF)}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: TAB_SHELL_LABELS.progress,
            tabBarIcon: ({ color }) => <TabLineIcon name="progress" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: TAB_SHELL_LABELS.account,
            tabBarIcon: ({ color }) => <TabLineIcon name="profile" size={22} color={color} />,
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
    backgroundColor: V4DesignTokens.color.wine,
    borderTopWidth: 0,
  },
  tabBarIos: {
    position: 'absolute' as const,
  },
  tabBarDefault: {},
  tabBarHidden: {
    display: 'none' as const,
    height: 0,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: V4DesignTokens.font.bodyMedium,
  },
  fabLift: {
    marginBottom: 18,
  },
});
