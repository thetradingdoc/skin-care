import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppFontFamilies } from '@/components/ui/AppFontsProvider';
import { AppTokens } from '@/constants/appTokens';
import type { JournalConditionTag } from '@/lib/journal-api';
import type { TriggerInsight } from '@/lib/journal-api';

const CONDITION_OPTIONS: { tag: JournalConditionTag; label: string; tone?: 'calm' | 'flare' | 'dry' | 'warn' }[] = [
  { tag: 'calm', label: 'Calm', tone: 'calm' },
  { tag: 'breaking_out', label: 'Breaking out', tone: 'flare' },
  { tag: 'dry', label: 'Dry', tone: 'dry' },
  { tag: 'oily', label: 'Oily' },
  { tag: 'irritated', label: 'Irritated', tone: 'warn' },
];

type JournalLogCtaProps = {
  onPress: () => void;
};

export function JournalLogCta({ onPress }: JournalLogCtaProps) {
  return (
    <Pressable style={styles.logCard} onPress={onPress} accessibilityRole="button">
      <Text style={styles.logEyebrow}>Daily skin check</Text>
      <Text style={styles.logTitle}>Log today&apos;s photo</Text>
      <Text style={styles.logSub}>One photo. See how your skin changes over time.</Text>
      <View style={styles.logBtn}>
        <AppIcon name="camera" size={16} color="#fff" />
        <Text style={styles.logBtnText}>Take photo</Text>
      </View>
    </Pressable>
  );
}

type ConditionChipRowProps = {
  selected: JournalConditionTag[];
  onChange: (tags: JournalConditionTag[]) => void;
  disabled?: boolean;
};

export function ConditionChipRow({ selected, onChange, disabled }: ConditionChipRowProps) {
  const toggle = (tag: JournalConditionTag) => {
    if (disabled) return;
    const set = new Set(selected);
    if (set.has(tag)) set.delete(tag);
    else set.add(tag);
    onChange([...set]);
  };

  return (
    <View style={styles.chipRow}>
      {CONDITION_OPTIONS.map((opt) => {
        const active = selected.includes(opt.tag);
        return (
          <Pressable
            key={opt.tag}
            onPress={() => toggle(opt.tag)}
            style={[
              styles.chip,
              opt.tone === 'calm' && styles.chipCalm,
              opt.tone === 'flare' && styles.chipFlare,
              opt.tone === 'dry' && styles.chipDry,
              opt.tone === 'warn' && styles.chipWarn,
              active && styles.chipSelected,
            ]}
            accessibilityRole="button">
            <Text style={[styles.chipText, active && styles.chipTextSelected]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type JournalNoteFieldProps = {
  value: string;
  onChange: (text: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
};

export function JournalNoteField({ value, onChange, onBlur, disabled }: JournalNoteFieldProps) {
  return (
    <TextInput
      style={styles.noteInput}
      placeholder="Add a note... tried a new product? Slept late?"
      placeholderTextColor={AppTokens.color.muted}
      value={value}
      onChangeText={onChange}
      onBlur={onBlur}
      editable={!disabled}
      multiline
    />
  );
}

type TriggerInsightCardProps = {
  insight: TriggerInsight;
};

export function TriggerInsightCard({ insight }: TriggerInsightCardProps) {
  return (
    <View style={styles.triggerCard}>
      <Text style={styles.triggerTitle}>{insight.label}</Text>
      <Text style={styles.triggerBody}>{insight.body}</Text>
    </View>
  );
}

type JournalLoggedCardProps = {
  conditionLabel?: string | null;
  note?: string | null;
  thumbnailUrl?: string | null;
};

export function JournalLoggedCard({ conditionLabel, note, thumbnailUrl }: JournalLoggedCardProps) {
  return (
    <View style={styles.loggedCard}>
      <View style={styles.loggedThumb}>
        {thumbnailUrl ? (
          <AppIcon name="camera" size={28} color={AppTokens.color.muted} />
        ) : (
          <AppIcon name="book" size={28} color={AppTokens.color.success} />
        )}
      </View>
      <View style={styles.loggedBody}>
        <Text style={styles.loggedTitle}>Today&apos;s photo logged</Text>
        {conditionLabel ? <Text style={styles.loggedSub}>Feeling {conditionLabel.toLowerCase()}</Text> : null}
        {note ? <Text style={styles.loggedNote}>&ldquo;{note}&rdquo;</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logCard: {
    backgroundColor: AppTokens.color.ink,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  logEyebrow: {
    fontSize: 11,
    color: AppTokens.color.hint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  logTitle: {
    fontFamily: AppFontFamilies.display,
    fontSize: 22,
    color: '#fff',
    marginBottom: 4,
  },
  logSub: { fontSize: 13, color: AppTokens.color.hint, marginBottom: 14, fontFamily: AppFontFamilies.body },
  logBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AppTokens.color.brandBlue,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    backgroundColor: AppTokens.color.card,
  },
  chipCalm: { backgroundColor: '#E1F5EE', borderColor: '#A7F3D0' },
  chipFlare: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  chipDry: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  chipWarn: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  chipSelected: { borderColor: AppTokens.color.brandBlue, backgroundColor: '#EEF1FB' },
  chipText: { fontSize: 13, color: AppTokens.color.muted, fontFamily: AppFontFamilies.body },
  chipTextSelected: { color: AppTokens.color.brandBlue, fontWeight: '600' },
  noteInput: {
    backgroundColor: AppTokens.color.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 12,
    fontSize: 13,
    color: AppTokens.color.ink,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  triggerCard: {
    backgroundColor: '#FFFBF0',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  triggerTitle: { fontSize: 13, fontWeight: '600', color: '#78350F', marginBottom: 3 },
  triggerBody: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  loggedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E1F5EE',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  loggedThumb: {
    width: 54,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F0E9DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggedBody: { flex: 1 },
  loggedTitle: { fontSize: 14, fontWeight: '600', color: '#065F46' },
  loggedSub: { fontSize: 12, color: '#065F46', opacity: 0.85, marginTop: 2 },
  loggedNote: { fontSize: 12, color: '#065F46', opacity: 0.75, marginTop: 2, fontStyle: 'italic' },
});
