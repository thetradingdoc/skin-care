import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { JournalTokens } from '@/constants/journalTokens';

export default function TabLayout() {
  return (
    <View style={styles.root}>
      <Tabs
        initialRouteName="today"
        screenOptions={{
          tabBarActiveTintColor: JournalTokens.color.brandAccent,
          tabBarInactiveTintColor: '#94a3b8',
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          sceneStyle: { backgroundColor: JournalTokens.color.cream },
        }}>
        <Tabs.Screen
          name="today"
          options={{
            title: 'Today',
            tabBarIcon: ({ color }) => <IconSymbol size={22} name="sun.max.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.line.uptrend.xyaxis" color={color} />,
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plan',
            tabBarIcon: ({ color }) => <IconSymbol size={22} name="calendar" color={color} />,
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
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="home" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="products" options={{ href: null }} />
        <Tabs.Screen name="routine" options={{ href: null }} />
        <Tabs.Screen name="more" options={{ href: null }} />
        <Tabs.Screen name="shelf" options={{ href: null }} />
        <Tabs.Screen name="insights" options={{ href: null }} />
        <Tabs.Screen name="explore" options={{ href: null }} />
        <Tabs.Screen name="calendar" options={{ href: null }} />
        <Tabs.Screen name="journal" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: JournalTokens.color.cream,
  },
  tabBar: {
    height: 72,
    paddingBottom: 10,
    backgroundColor: JournalTokens.color.card,
    borderTopColor: JournalTokens.color.line,
  },
  tabLabel: {
    fontFamily: JournalTokens.font.body,
    fontSize: 12,
    marginBottom: 2,
  },
});
