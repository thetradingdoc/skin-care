import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { BillingBadge, StatusDot } from '@/components/billing-ui';
import type { BillingEvent } from '@/components/journal/journalTypes';
import { amountColorForStatus } from '@/components/journal/journalTypes';
import { styles } from '@/components/journal/journalStyles';
import { BillingLifecycleStatus, BillingV1 } from '@/constants/billingV1';

type Props = {
  filteredEvents: BillingEvent[];
  selectedEvent: BillingEvent | null;
  selectedEventId: string | null;
  statusFilter: string;
  duplicateIds: Set<string>;
  statusSaving: boolean;
  onStatusFilterChange: (label: string) => void;
  onSelectEvent: (id: string) => void;
  onPersistStatus: (next: BillingLifecycleStatus | string) => void;
};

export function JournalListTab({
  filteredEvents,
  selectedEvent,
  selectedEventId,
  statusFilter,
  duplicateIds,
  statusSaving,
  onStatusFilterChange,
  onSelectEvent,
  onPersistStatus,
}: Props) {
  const router = useRouter();

  if (!filteredEvents.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>No billing events yet</Text>
        <Text style={styles.cardBody}>
          Capture a bill or receipt to build your timeline — no skincare routine required.
        </Text>
        <Pressable style={styles.inlineBtnPrimary} onPress={() => router.push('/scan-entry')}>
          <Text style={styles.inlineBtnPrimaryText}>Capture first bill</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.listWrap}>
      <View style={styles.filterRow}>
        {['all', ...BillingV1.lifecycleStatuses].map((label) => (
          <Pressable
            key={label}
            onPress={() => onStatusFilterChange(label)}
            style={[styles.filterPill, statusFilter === label && styles.filterPillActive]}>
            <Text style={[styles.filterText, statusFilter === label && styles.filterTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {filteredEvents.map((event) => (
        <Pressable
          key={`l-${event.id}`}
          style={[styles.listRow, selectedEventId === event.id && styles.listRowSelected]}
          accessibilityRole="button"
          accessibilityLabel={`Open billing event ${event.title}`}
          onPress={() => onSelectEvent(event.id)}>
          <View style={styles.listLeft}>
            <Text style={styles.listDate}>{event.service_date || 'Unknown date'}</Text>
            <View style={styles.listSummaryRow}>
              <StatusDot
                state={
                  event.status === 'paid' ? 'completed' : event.status === 'due' ? 'pending' : 'default'
                }
              />
              <Text style={styles.listSummary} numberOfLines={2}>
                {event.provider_name || 'Unknown provider'} ·{' '}
                <Text style={amountColorForStatus(event.status)}>
                  ${(Number(event.amount_cents || 0) / 100).toFixed(2)}
                </Text>
              </Text>
            </View>
            {duplicateIds.has(event.id) ? <Text style={styles.dupWarning}>Possible duplicate</Text> : null}
          </View>
          <BillingBadge
            tone={
              event.status === 'paid'
                ? 'success'
                : event.status === 'due'
                  ? 'warning'
                  : event.status === 'disputed'
                    ? 'error'
                    : 'info'
            }
            label={String(event.status)}
          />
        </Pressable>
      ))}
      {selectedEvent ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Event detail</Text>
          <Text style={styles.cardBody}>
            {selectedEvent.title} · {selectedEvent.provider_name || 'Unknown provider'} ·{' '}
            {selectedEvent.service_date || 'Unknown date'}
          </Text>
          <Text style={styles.cardBody}>
            Amount{' '}
            <Text style={amountColorForStatus(selectedEvent.status)}>
              ${(Number(selectedEvent.amount_cents || 0) / 100).toFixed(2)}
            </Text>{' '}
            · Confidence {Math.round((selectedEvent.confidence_score || 0) * 100)}%
          </Text>
          <View style={styles.actionRow}>
            {BillingV1.lifecycleStatuses.map((status) => (
              <Pressable
                key={status}
                disabled={statusSaving}
                onPress={() => onPersistStatus(status)}
                style={[styles.filterPill, selectedEvent.status === status && styles.filterPillActive]}>
                <Text style={[styles.filterText, selectedEvent.status === status && styles.filterTextActive]}>
                  {status}
                </Text>
              </Pressable>
            ))}
            {statusSaving ? <ActivityIndicator style={{ marginLeft: 8 }} /> : null}
          </View>
          <Pressable style={styles.inlineBtnPrimary} onPress={() => router.push('/scan-entry')}>
            <Text style={styles.inlineBtnPrimaryText}>Add another capture</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
