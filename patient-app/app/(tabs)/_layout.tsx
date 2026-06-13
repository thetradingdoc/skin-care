import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppTokens } from '@/constants/appTokens';

export default function TabLayout() {
  return (
    <View style={styles.root}>
      <Tabs
        initialRouteName="home"
        screenOptions={{
          tabBarActiveTintColor: AppTokens.color.brandAccent,
          tabBarInactiveTintColor: AppTokens.color.hint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          sceneStyle: { backgroundColor: AppTokens.color.pageBg },
        }}>
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <AppIcon name="home" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="track"
          options={{
            title: 'Track',
            tabBarIcon: ({ color }) => <AppIcon name="camera" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarIcon: ({ color }) => <AppIcon name="scan" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color }) => <AppIcon name="chart-bar" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <AppIcon name="user" size={22} color={color} />,
          }}
        />
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
  tabBar: {
    height: 72,
    paddingBottom: 10,
    backgroundColor: AppTokens.color.card,
    borderTopColor: AppTokens.color.line,
  },
  tabLabel: {
    fontFamily: AppTokens.font.body,
    fontSize: 12,
    marginBottom: 2,
  },
});
