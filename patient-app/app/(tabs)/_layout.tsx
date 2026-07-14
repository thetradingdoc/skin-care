import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

/**
 * TOUCH-032 — No persistent tab bar. Screens remain addressable via router.
 * Proof/Profile via Check gear / contextual navigation only.
 */
export default function TabLayout() {
  return (
    <View style={styles.root} testID="auth-shell-no-tab-bar">
      <Tabs
        initialRouteName="track"
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none', height: 0 },
          sceneStyle: { backgroundColor: AppTokens.color.pageBg },
        }}>
        <Tabs.Screen name="track" options={{ href: null }} />
        <Tabs.Screen name="scan" options={{ href: null }} />
        <Tabs.Screen name="progress" options={{ href: null }} />
        <Tabs.Screen name="account" options={{ href: null }} />
        <Tabs.Screen name="timeline" options={{ href: null }} />
        <Tabs.Screen name="money" options={{ href: null }} />
        <Tabs.Screen name="shelf" options={{ href: null }} />
        <Tabs.Screen name="_journal" options={{ href: null }} />
        <Tabs.Screen name="today" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppTokens.color.pageBg,
  },
});
