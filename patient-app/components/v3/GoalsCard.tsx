import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';
import { CHECK_HREF, SCAN_HREF, TRACK_HREF } from '@/constants/routes';
import type { PatientGoal } from '@/lib/goals-api';
import { goalLabel } from '@/lib/goals-api';

type Props = {
  goals: PatientGoal[];
  onDismiss: (goalId: string) => void;
};

function goalRoute(goalType: PatientGoal['goal_type']): Href {
  if (goalType === 'watch_spot') return TRACK_HREF;
  if (goalType === 'reduce_conflicts') return SCAN_HREF;
  return CHECK_HREF;
}

export function GoalsCard({ goals, onDismiss }: Props) {
  if (!goals.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Your goals</Text>
      {goals.map((goal) => (
        <View key={goal.id} style={styles.card}>
          <Text style={styles.title}>{goalLabel(goal.goal_type)}</Text>
          <View style={styles.row}>
            <GoalLink goal={goal} />
            <Pressable onPress={() => onDismiss(goal.id)} accessibilityRole="button">
              <Text style={styles.dismiss}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function GoalLink({ goal }: { goal: PatientGoal }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(goalRoute(goal.goal_type))} accessibilityRole="button">
      <Text style={styles.link}>Go</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 16 },
  heading: { fontSize: 12, fontWeight: '600', color: AppTokens.color.muted },
  card: {
    backgroundColor: AppTokens.color.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 12,
    gap: 6,
  },
  title: { fontSize: 14, fontWeight: '600', color: AppTokens.color.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 13, fontWeight: '600', color: AppTokens.color.accent },
  dismiss: { fontSize: 12, color: AppTokens.color.muted },
});
