import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import type { BillingDoc, CalendarDay } from '@/components/journal/journalTypes';
import { styles } from '@/components/journal/journalStyles';
import { JournalTokens } from '@/constants/journalTokens';

type Props = {
  rows: CalendarDay[];
  documents: BillingDoc[];
  onOpenDocDetail: (doc: BillingDoc) => void;
};

export function JournalDocumentsTab({ rows, documents, onOpenDocDetail }: Props) {
  const router = useRouter();
  const media = rows.filter((d) => d.has_media && d.thumbnail_url).slice(0, 18);
  const hasBilling = documents.length > 0;
  const hasRoutineMedia = media.length > 0;

  if (!hasBilling && !hasRoutineMedia) {
    return (
      <Text style={styles.empty}>
        No billing documents or routine photos yet. Capture a receipt or EOB to get started.
      </Text>
    );
  }

  return (
    <View style={{ gap: JournalTokens.spacing.md }}>
      {hasBilling ? (
        <View>
          <Text style={styles.sectionHeading}>Billing documents</Text>
          <View style={styles.mediaGrid}>
            {documents.slice(0, 24).map((doc) => (
              <Pressable
                key={doc.id}
                style={styles.docTile}
                onPress={() => onOpenDocDetail(doc)}
                accessibilityRole="button"
                accessibilityLabel={`Billing document ${doc.file_name || doc.id}`}>
                <Text style={styles.docTitle}>{doc.file_name || 'Billing document'}</Text>
                <Text style={styles.docMeta}>{new Date(doc.created_at).toLocaleDateString()}</Text>
                {doc.parse_status ? <Text style={styles.docParse}>{doc.parse_status}</Text> : null}
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {hasRoutineMedia ? (
        <View>
          <Text style={styles.sectionHeading}>Routine photos</Text>
          <Text style={styles.sectionHint}>Linked to your routine journal — not financial proof.</Text>
          <View style={styles.mediaGrid}>
            {media.map((d) => (
              <Pressable
                key={`m-${d.date}`}
                style={styles.mediaTile}
                accessibilityRole="button"
                accessibilityLabel={`Routine photo ${d.date}`}
                onPress={() => router.push({ pathname: '/check', params: { date: d.date } })}>
                <Image source={{ uri: d.thumbnail_url || '' }} style={styles.mediaImage} />
                {d.program_week ? (
                  <View style={styles.weekBadgeGrid}>
                    <Text style={styles.weekBadgeGridText}>W{d.program_week}</Text>
                  </View>
                ) : null}
                <View style={styles.mediaLabelWrap}>
                  <Text style={styles.mediaLabel}>
                    {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {d.phase_label ? ` · ${d.phase_label}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
