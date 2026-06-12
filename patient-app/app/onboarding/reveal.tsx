import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsumerPrimaryButton, ConsumerSecondaryButton } from '@/components/billing-ui';
import { AppTokens } from '@/constants/appTokens';
import { JournalTokens } from '@/constants/journalTokens';
import { ONBOARDING_CONCERNS_HREF, ONBOARDING_SCAN_HREF } from '@/constants/routes';
import {
  HEALTH_SCORE_KEYS,
  HEALTH_SCORE_LABELS,
  meterColor,
  resolveHealthScores,
} from '@/lib/computeHealthScores';
import { computeSkinAge } from '@/lib/computeSkinAge';
import { isLiveFaceRead } from '@/lib/face-read-api';
import type { FaceReadPayload } from '@/lib/onboarding-storage';
import {
  getConfirmedAge,
  getFacePhotoUri,
  getFaceRead,
  setConfirmedAge,
  setFacePhotoUri,
  setFaceRead,
} from '@/lib/onboarding-storage';
import {
  buildZoneOverlays,
  concernScoresToFindingCards,
  findingIcon,
  fitzDisplay,
  isVisionFailed,
  scanInsightText,
  severityLabel,
  zoneCentroids,
} from '@/lib/revealHelpers';

export default function OnboardingRevealScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [faceRead, setFaceReadState] = useState<FaceReadPayload | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [editingAge, setEditingAge] = useState(false);
  const [ageInput, setAgeInput] = useState('');
  const [confirmedAge, setConfirmedAgeState] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const [fr, confirmed, photo] = await Promise.all([
        getFaceRead(),
        getConfirmedAge(),
        getFacePhotoUri(),
      ]);
      if (!isLiveFaceRead(fr)) {
        await setFaceRead(null);
        router.replace(ONBOARDING_SCAN_HREF);
        return;
      }
      setFaceReadState(fr);
      setPhotoUri(photo);
      setConfirmedAgeState(confirmed);
      if (confirmed) setAgeInput(String(confirmed));
      setLoading(false);
    })();
  }, [router]);

  const faceAge = faceRead?.apparent_age_estimate;
  const concernScores = faceRead?.concern_scores ?? {};
  const findings = Array.isArray(faceRead?.findings) ? faceRead.findings : [];
  const visionFailed = isVisionFailed(faceRead);
  const skinAge = useMemo(
    () => (faceAge != null && !visionFailed ? computeSkinAge(faceAge, concernScores) : null),
    [faceAge, concernScores, visionFailed],
  );
  const healthScores = useMemo(
    () => (!visionFailed ? resolveHealthScores(faceRead) : null),
    [faceRead, visionFailed],
  );
  const displayFindings = useMemo(() => {
    if (visionFailed) return [];
    if (findings.length > 0) return findings;
    return concernScoresToFindingCards(concernScores);
  }, [findings, concernScores, visionFailed]);
  const zoneOverlays = useMemo(
    () => (visionFailed ? [] : buildZoneOverlays(findings, zoneCentroids(faceRead?.zone_polygons))),
    [findings, faceRead?.zone_polygons, visionFailed],
  );
  const fitz = useMemo(
    () => fitzDisplay(faceRead?.fitzpatrick_estimate, faceRead?.fit_skin_tone),
    [faceRead?.fitzpatrick_estimate, faceRead?.fit_skin_tone],
  );
  const insight = useMemo(
    () =>
      !visionFailed ? scanInsightText(faceRead?.scan_summary, faceRead?.positive_observations) : null,
    [faceRead, visionFailed],
  );

  const retake = useCallback(async () => {
    await setFaceRead(null);
    await setFacePhotoUri(null);
    router.replace(ONBOARDING_SCAN_HREF);
  }, [router]);

  const continueNext = useCallback(() => {
    router.push(ONBOARDING_CONCERNS_HREF);
  }, [router]);

  const saveAge = useCallback(async () => {
    const n = Number(ageInput);
    if (!Number.isFinite(n) || n < 13 || n > 99) return;
    await setConfirmedAge(n);
    setConfirmedAgeState(n);
    setEditingAge(false);
  }, [ageInput]);

  if (loading || faceAge == null) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  const skinDelta = skinAge != null && faceAge != null ? skinAge - faceAge : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <Text style={styles.tag}>Your scan</Text>
        </View>

        <View style={[styles.photoFrame, visionFailed && styles.photoDim]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} accessibilityLabel="Your scan" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="person" size={48} color={JournalTokens.color.muted} />
            </View>
          )}
          {zoneOverlays.map((o) => {
            const dotStyle: ViewStyle = {
              left: o.dot.left as DimensionValue,
              top: o.dot.top as DimensionValue,
              backgroundColor: o.dot.color,
            };
            const lineStyle: ViewStyle = {
              left: o.line.left as DimensionValue,
              top: o.line.top as DimensionValue,
              width: o.line.width,
              transform: [{ rotate: `${o.line.rotate}deg` }],
            };
            const labelStyle: ViewStyle = {
              top: o.label.top as DimensionValue,
              ...(o.label.left ? { left: o.label.left as DimensionValue } : {}),
              ...(o.label.right ? { right: o.label.right as DimensionValue } : {}),
            };
            return (
            <View key={o.key} pointerEvents="none">
              <View style={[styles.zoneDot, dotStyle]} />
              <View style={[styles.zoneLine, lineStyle]} />
              <View style={[styles.zoneLabel, labelStyle]}>
                <Text style={styles.zoneLabelText}>{o.label.text}</Text>
              </View>
            </View>
            );
          })}
          <View style={[styles.badge, visionFailed && styles.badgeWarn]}>
            <Ionicons name={visionFailed ? 'warning' : 'checkmark-circle'} size={14} color="#fff" />
            <Text style={styles.badgeText}>
              {visionFailed ? 'Needs better lighting' : 'Scan complete'}
            </Text>
          </View>
        </View>

        {!visionFailed ? (
          <View style={styles.scoreRow}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreN}>{faceAge}</Text>
              <Text style={styles.scoreL}>Face age</Text>
              {faceRead?.age_unreliable ? (
                <Text style={styles.scoreNote}>
                  Estimate may vary on deep skin tones — retake in good light for best results.
                </Text>
              ) : null}
            </View>
            {skinAge != null ? (
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreN, skinDelta > 0 && styles.scoreWarn]}>{skinAge}</Text>
                <Text style={styles.scoreL}>Skin age</Text>
                <Text style={[styles.scoreDelta, skinDelta <= 0 && styles.scoreDeltaOk]}>
                  {skinDelta > 0 ? `+${skinDelta} yrs` : skinDelta < 0 ? `${skinDelta} yrs` : 'Aligned'}
                </Text>
              </View>
            ) : null}
            {faceRead?.fitzpatrick_estimate ? (
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreN, styles.scoreSm]}>{fitz.short}</Text>
                <Text style={styles.scoreL}>{fitz.toneLine || 'tone'}</Text>
                {fitz.skinLine ? <Text style={styles.scoreDeltaMuted}>{fitz.skinLine}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {!visionFailed && insight ? <Text style={styles.insight}>{insight}</Text> : null}

        {visionFailed ? (
          <View style={styles.retryBlock}>
            <View style={styles.retryIcon}>
              <Ionicons name="camera" size={24} color={JournalTokens.color.muted} />
            </View>
            <Text style={styles.retryTitle}>We couldn&apos;t read your skin clearly</Text>
            <Text style={styles.retryBody}>
              Your face was detected but lighting made it hard to spot details. Try again — better
              light gives us a lot more to work with.
            </Text>
            <View style={styles.tipsBox}>
              {[
                'Face a window or lamp — natural front-light works best',
                'For deep skin tones, avoid backlit or dim rooms',
                'No glasses, hair away from face',
                'Hold still for 2 seconds before capturing',
              ].map((tip) => (
                <Text key={tip} style={styles.tipRow}>
                  • {tip}
                </Text>
              ))}
            </View>
            <ConsumerPrimaryButton label="Scan again" onPress={() => void retake()} />
          </View>
        ) : null}

        {!visionFailed && displayFindings.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>What we found</Text>
            {displayFindings.map((f, i) => {
              const { icon, bg, color } = findingIcon(f.id);
              const description = f.plain_language || ('detail' in f ? f.detail : '') || '';
              return (
                <View key={f.id || i} style={styles.findingCard}>
                  <View style={[styles.findingIcon, { backgroundColor: bg }]}>
                    <Ionicons name={icon} size={16} color={color} />
                  </View>
                  <View style={styles.findingBody}>
                    <Text style={styles.findingTitle}>{f.label || f.id || 'Finding'}</Text>
                    {description ? <Text style={styles.findingDesc}>{description}</Text> : null}
                  </View>
                  {f.severity ? (
                    <View
                      style={[
                        styles.sevChip,
                        styles[`sev${f.severity}` as 'sev1' | 'sev2' | 'sev3'],
                      ]}>
                      <Text
                        style={[
                          styles.sevText,
                          styles[`sevText${f.severity}` as 'sevText1' | 'sevText2' | 'sevText3'],
                        ]}>
                        {severityLabel(f.severity)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {!visionFailed && healthScores ? (
          <>
            <Text style={styles.sectionLabel}>Skin health score</Text>
            {HEALTH_SCORE_KEYS.map((key) => {
              const value = healthScores[key];
              const color = meterColor(value);
              return (
                <View key={key} style={styles.meterRow}>
                  <Text style={styles.meterLabel}>{HEALTH_SCORE_LABELS[key]}</Text>
                  <View style={styles.meterBar}>
                    <View style={[styles.meterFill, { width: `${value}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={[styles.meterVal, { color }]}>{value}</Text>
                </View>
              );
            })}
          </>
        ) : null}

        {!visionFailed &&
        Array.isArray(faceRead?.positive_observations) &&
        faceRead.positive_observations.length > 0 ? (
          <View style={styles.positiveRow}>
            <Ionicons name="sparkles" size={16} color="#085041" />
            <Text style={styles.positiveText}>{faceRead.positive_observations[0]}</Text>
          </View>
        ) : null}

        {!visionFailed ? (
          <>
            {editingAge ? (
              <View style={styles.ageEdit}>
                <Text style={styles.label}>Your real age (optional)</Text>
                <TextInput
                  value={ageInput}
                  onChangeText={setAgeInput}
                  keyboardType="number-pad"
                  placeholder="32"
                  style={styles.input}
                />
                <ConsumerPrimaryButton label="Save" onPress={() => void saveAge()} />
              </View>
            ) : (
              <Pressable onPress={() => setEditingAge(true)} style={styles.realAgeRow}>
                <Ionicons name="calendar-outline" size={18} color={JournalTokens.color.muted} />
                <Text style={styles.realAgeLabel}>Add your real age for comparison</Text>
                <Text style={styles.realAgeAction}>
                  {confirmedAge ? `Age ${confirmedAge} · Edit` : 'Enter age →'}
                </Text>
              </Pressable>
            )}

            <ConsumerPrimaryButton label="Build my routine →" onPress={continueNext} />
            <ConsumerSecondaryButton
              label="That doesn't look right — scan again"
              onPress={() => void retake()}
            />
            <Text style={styles.disclaimer}>
              Wellness estimate from your photo — not a medical diagnosis.
            </Text>
          </>
        ) : null}

        {visionFailed ? (
          <>
            <Pressable onPress={continueNext} style={styles.skipRow}>
              <Text style={styles.skipText}>
                Don&apos;t want to retry?{' '}
                <Text style={styles.skipLink}>Continue with quick-check →</Text>
              </Text>
            </Pressable>
            <Text style={styles.disclaimer}>Wellness estimate from your photo — not a diagnosis.</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  scroll: { padding: JournalTokens.spacing.lg, paddingBottom: 32, gap: 10 },
  topbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  tag: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: JournalTokens.color.terracotta,
    backgroundColor: '#FAECE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  photoFrame: {
    aspectRatio: 3 / 4.2,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
  },
  photoDim: { opacity: 0.45 },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1c',
  },
  zoneDot: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    marginLeft: -5.5,
    marginTop: -5.5,
  },
  zoneLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  zoneLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  zoneLabelText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  badge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,110,86,0.85)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
    zIndex: 3,
  },
  badgeWarn: { backgroundColor: 'rgba(120, 20, 20, 0.75)' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', gap: 8 },
  scoreCard: {
    flex: 1,
    backgroundColor: '#f8f9fb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  scoreN: {
    fontSize: 22,
    fontWeight: '600',
    color: JournalTokens.color.ink,
    fontFamily: JournalTokens.font.display,
  },
  scoreWarn: { color: '#854F0B' },
  scoreSm: { fontSize: 15, paddingTop: 4 },
  scoreL: {
    fontSize: 10,
    color: JournalTokens.color.muted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  scoreDelta: { fontSize: 10, fontWeight: '600', color: '#854F0B', marginTop: 2 },
  scoreDeltaOk: { color: '#3B6D11' },
  scoreDeltaMuted: { fontSize: 10, color: JournalTokens.color.muted, marginTop: 2 },
  scoreNote: {
    fontSize: 8,
    color: JournalTokens.color.muted,
    lineHeight: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  insight: { fontSize: 12, lineHeight: 18, color: JournalTokens.color.muted },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: JournalTokens.color.muted,
    marginTop: 4,
  },
  findingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    borderRadius: 14,
    padding: 12,
    backgroundColor: JournalTokens.color.card,
  },
  findingIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findingBody: { flex: 1, minWidth: 0 },
  findingTitle: { fontSize: 13, fontWeight: '600', color: JournalTokens.color.ink },
  findingDesc: { fontSize: 12, color: JournalTokens.color.muted, lineHeight: 17, marginTop: 2 },
  sevChip: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  sevText: { fontSize: 9, fontWeight: '600' },
  sev1: { backgroundColor: '#EAF3DE' },
  sev2: { backgroundColor: '#FAEEDA' },
  sev3: { backgroundColor: '#FCEBEB' },
  sevText1: { color: '#27500A' },
  sevText2: { color: '#633806' },
  sevText3: { color: '#791F1F' },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  meterLabel: { fontSize: 10, color: JournalTokens.color.muted, width: 72 },
  meterBar: {
    flex: 1,
    height: 5,
    backgroundColor: '#f0f1f3',
    borderRadius: 3,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: 3 },
  meterVal: { fontSize: 11, fontWeight: '600', width: 28, textAlign: 'right' },
  positiveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    backgroundColor: '#E1F5EE',
    borderRadius: 10,
  },
  positiveText: { flex: 1, fontSize: 12, color: '#085041', lineHeight: 18 },
  retryBlock: { alignItems: 'stretch', gap: 10, paddingVertical: 8 },
  retryIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f8f9fb',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  retryTitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    color: JournalTokens.color.ink,
  },
  retryBody: {
    fontSize: 12,
    color: JournalTokens.color.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  tipsBox: {
    backgroundColor: '#f8f9fb',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  tipRow: { fontSize: 11, color: JournalTokens.color.muted, lineHeight: 17 },
  realAgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 0.5,
    borderColor: JournalTokens.color.line,
    borderRadius: 12,
    backgroundColor: JournalTokens.color.card,
  },
  realAgeLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: JournalTokens.color.ink },
  realAgeAction: { fontSize: 13, fontWeight: '600', color: '#185FA5' },
  label: { fontWeight: '600', color: JournalTokens.color.ink, alignSelf: 'flex-start' },
  input: {
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    borderRadius: JournalTokens.radius.md,
    padding: 14,
    fontSize: 16,
    backgroundColor: JournalTokens.color.card,
    width: '100%',
  },
  ageEdit: { width: '100%', gap: 10 },
  disclaimer: {
    color: JournalTokens.color.muted,
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 10,
    marginTop: 8,
  },
  skipRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: JournalTokens.color.line },
  skipText: { textAlign: 'center', fontSize: 12, color: JournalTokens.color.muted },
  skipLink: { color: '#185FA5', fontWeight: '600' },
});
