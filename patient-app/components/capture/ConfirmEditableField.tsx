/**
 * Confirm field row with pencil → inline TextInput (mock 5-* affordance).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type Props = {
  label: string;
  value: string;
  testID: string;
  onChange: (next: string) => void;
  /** Optional keyboard for amounts */
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
};

export function ConfirmEditableField({
  label,
  value,
  testID,
  onChange,
  keyboardType = 'default',
}: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          autoFocus
          onBlur={() => setEditing(false)}
          onSubmitEditing={() => setEditing(false)}
          keyboardType={keyboardType}
          testID={`${testID}-input`}
        />
      ) : (
        <Pressable
          style={styles.valueHit}
          onPress={() => setEditing(true)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${label}`}
          testID={`${testID}-edit`}>
          <Text style={styles.value}>{value || '—'}</Text>
          <Text style={styles.pencil} testID={`${testID}-pencil`}>
            ✎
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  label: { fontSize: 15, color: AppTokens.color.muted, minWidth: 88 },
  valueHit: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  value: { fontSize: 16, color: AppTokens.color.ink, textAlign: 'right', flexShrink: 1 },
  pencil: { fontSize: 14, color: AppTokens.color.fabBg },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppTokens.color.fabBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
    color: AppTokens.color.ink,
    textAlign: 'right',
  },
});
