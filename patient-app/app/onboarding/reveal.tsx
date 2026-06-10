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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/billing-ui';
import { JournalTokens } from '@/constants/journalTokens';
import { ONBOARDING_CONCERNS_HREF, ONBOARDING_SCAN_HREF } from '@/constants/routes';
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
  concernFallbackChips,
  findingIcon,
  fitzpatrickToneLabel,
  isVisionFailed,
  severityLabel,
  SEV_COLORS,
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
  const fallbackChips = useMemo(
    () => (findings.length ? [] : concernFallbackChips(concernScores)),
    [findings.length, concernScores],
  );
  const visionFailed = isVisionFailed(faceRead);
  const skinAge = useMemo(
    () => (faceAge != null && !visionFailed ? computeSkinAge(faceAge, concernScores) : null),
    [faceAge, concernScores, visionFailed],
  );
  const centroids = useMemo(
    () => zoneCentroids(faceRead?.zone_polygons),
    [faceRead?.zone_polygons],
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

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.tag}>Your scan</Text>

        <View style={[styles.photoFrame, visionFailed && styles.photoDim]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} accessibilityLabel="Your scan" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="person" size={48} color={JournalTokens.color.muted} />
            </View>
          )}
          {!visionFailed &&
            findings.flatMap((f) =>
              (f.zones || []).map((zone) => {
                const c = centroids[zone];
                if (!c) return null;
                return (
                  <View
                    key={`${f.id}-${zone}`}
                    style={[
                      styles.zoneDot,
                      {
                        left: `${c.x * 100}%`,
                        top: `${c.y * 100}%`,
                        backgroundColor: SEV_COLORS[f.severity ?? 1] || '#888780',
                      },
                    ]}
                  />
                );
              }),
            )}
          <View style={[styles.badge, visionFailed && styles.badgeWarn]}>
            <Ionicons
              name={visionFailed ? 'warning' : 'checkmark-circle'}
              size={14}
              color="#fff"
            />
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
            </View>
            {skinAge != null && skinAge !== faceAge ? (
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreN, styles.scoreWarn]}>{skinAge}</Text>
                <Text style={styles.scoreL}>Skin age</Text>
                <Text style={styles.scoreDelta}>+{skinAge - faceAge} yrs gap</Text>
              </View>
            ) : null}
            {faceRead?.fitzpatrick_estimate ? (
              <View style={styles.scoreCard}>
                <Text style={[styles.scoreN, styles.scoreSm]}>{faceRead.fitzpatrick_estimate}</Text>
                <Text style={styles.scoreL}>Fitzpatrick</Text>
                <Text style={styles.scoreDeltaMuted}>
                  {fitzpatrickToneLabel(faceRead.fit_skin_tone, faceRead.fitzpatrick_estimate)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {!visionFailed && faceRead?.scan_summary ? (
          <Text style={styles.summary}>{faceRead.scan_summary}</Text>
        ) : null}

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
            <PrimaryButton label="Scan again" onPress={() => void retake()} variant="consumer" />
          </View>
        ) : null}

        {!visionFailed && findings.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>What we found</Text>
            {findings.map((f, i) => {
              const { icon, bg, color } = findingIcon(f.id);
              const description = f.plain_language || f.detail || '';
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
                    <View style={[styles.sevChip, styles[`sev${f.severity}` as 'sev1' | 'sev2' | 'sev3']]}>
                      <Text style={[styles.sevText, styles[`sevText${f.severity}` as 'sevText1' | 'sevText2' | 'sevText3']]}>
                        {severityLabel(f.severity)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {!visionFailed && !findings.length && fallbackChips.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>What we found</Text>
            <View style={styles.chipRow}>
              {fallbackChips.map((chip) => (
                <View key={chip.id} style={styles.chip}>
                  <Text style={styles.chipLabel}>{chip.label}</Text>
                  <Text style={styles.chipScore}>{chip.severity}/3</Text>
                </View>
              ))}
            </View>
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
                <PrimaryButton label="Save" onPress={() => void saveAge()} variant="consumer" />
              </View>
            ) : (
              <Pressable onPress={() => setEditingAge(true)} style={styles.linkBtn}>
                <Text style={styles.link}>
                  {confirmedAge
                    ? `Real age: ${confirmedAge} · Edit`
                    : 'Add your real age for comparison'}
                </Text>
              </Pressable>
            )}

            <Text style={styles.body}>
              Wellness estimate from your photo — not a diagnosis.
              {findings.length ? ' Findings guide your personalized plan.' : ''}
            </Text>

            <PrimaryButton label="Build my routine →" onPress={continueNext} variant="consumer" />
            <Pressable onPress={() => void retake()} style={styles.linkBtn}>
              <Text style={styles.link}>That doesn&apos;t look right — scan again</Text>
            </Pressable>
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
            <Text style={styles.body}>Wellness estimate from your photo — not a diagnosis.</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JournalTokens.color.cream },
  scroll: { padding: JournalTokens.spacing.lg, paddingBottom: 32, gap: 10 },
  tag: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: JournalTokens.color.terracotta,
    marginBottom: 4,
  },
  photoFrame: {
    aspectRatio: 3 / 4,
    borderRadius: JournalTokens.radius.lg,
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
  badge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    left: '15%',
    right: '15%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: JournalTokens.color.brandBlue,
    borderRadius: JournalTokens.radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  badgeWarn: { backgroundColor: 'rgba(120, 20, 20, 0.75)' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
  scoreDeltaMuted: { fontSize: 10, color: JournalTokens.color.muted, marginTop: 2 },
  summary: {
    fontSize: 13,
    lineHeight: 20,
    color: JournalTokens.color.muted,
    textAlign: 'center',
  },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: JournalTokens.radius.pill,
    backgroundColor: '#eef4ff',
  },
  chipLabel: { fontSize: 12, fontWeight: '600', color: JournalTokens.color.brandBlue },
  chipScore: { fontSize: 12, color: JournalTokens.color.brandBlue, opacity: 0.75 },
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
  body: {
    color: JournalTokens.color.muted,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 12,
    marginVertical: 4,
  },
  linkBtn: { paddingVertical: 8, alignItems: 'center' },
  link: { color: JournalTokens.color.brandBlue, fontWeight: '600', fontSize: 14 },
  skipRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: JournalTokens.color.line },
  skipText: { textAlign: 'center', fontSize: 12, color: JournalTokens.color.muted },
  skipLink: { color: '#185FA5', fontWeight: '600' },
});
