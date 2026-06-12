import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppTokens } from '@/constants/appTokens';

export default function TabLayout() {
  return (
    <View style={styles.root}>
      <Tabs
        initialRouteName="home"
        screenOptions={{
          tabBarActiveTintColor: AppTokens.color.brandAccent,
          tabBarInactiveTintColor: '#94a3b8',
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
            tabBarIcon: ({ color }) => <IconSymbol size={22} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="track"
          options={{
            title: 'Track',
            tabBarIcon: ({ color }) => <IconSymbol size={22} name="camera.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="barcode.viewfinder" color={color} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.bar.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <IconSymbol size={22} name="person.fill" color={color} />,
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
