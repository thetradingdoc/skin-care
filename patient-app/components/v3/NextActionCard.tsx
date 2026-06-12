import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

export type NextAction = {
  type?: string;
  title: string;
  message?: string;
  route?: string;
  priority?: number;
};

type Props = {
  actions: NextAction[];
};

export function NextActionCard({ actions }: Props) {
  const router = useRouter();
  if (!actions.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Suggested for you</Text>
      {actions.map((action, idx) => (
        <Pressable
          key={`${action.type || 'action'}-${idx}`}
          style={styles.card}
          onPress={() => {
            if (action.route) router.push(action.route as never);
          }}
          accessibilityRole="button">
          <Text style={styles.title}>{action.title}</Text>
          {action.message ? <Text style={styles.message}>{action.message}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 10 },
  heading: { fontSize: 12, fontWeight: '600', color: AppTokens.color.muted, marginBottom: 2 },
  card: {
    backgroundColor: AppTokens.color.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 12,
    gap: 4,
  },
  title: { fontSize: 13, fontWeight: '600', color: AppTokens.color.ink },
  message: { fontSize: 11, color: AppTokens.color.muted, lineHeight: 16 },
});
