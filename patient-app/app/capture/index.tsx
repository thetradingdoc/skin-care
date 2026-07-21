/**
 * Step 13 — Capture 2a photo or upload entry (v4.1 frame 13).
 * Always request a JPEG-compatible representation (iOS HEIC → Compatible) so
 * OpenAI vision / OCR never receive raw HEIC after the quality gate.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { CAMERA_DENIED_HREF, CAPTURE_TAG_HREF, MANUAL_ENTRY_HREF, TRACK_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { setPendingCaptureUri } from '@/lib/pending-capture-uri';
import { mimeTypeFromImagePickerAsset } from '@/lib/upload-uri';

export const CAPTURE_2A_TITLE = 'Take a photo, or choose one';
export const CAPTURE_2A_COPY = 'skin, prescription, bill — anything';
/** User-facing media hint — pickers are images-only in v1 (PDF API exists; not exposed yet). */
export const CAPTURE_2A_PHOTO_HINT = 'photo — video not in this version';
/** @deprecated Alias kept for import stability; value is photo-only (no PDF claim). */
export const CAPTURE_2A_PHOTO_PDF = CAPTURE_2A_PHOTO_HINT;

/** Shared picker options — quality + Compatible forces JPEG on iOS HEIC libraries. */
export const CAPTURE_IMAGE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.85,
  allowsEditing: false,
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

export default function Capture2aScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entry?: string }>();
  const entry = params.entry === 'track' ? 'track' : 'onboarding';
  const [permission, requestPermission] = useCameraPermissions();

  const goTag = () => {
    router.push({ pathname: CAPTURE_TAG_HREF, params: { entry } } as never);
  };

  const takePhoto = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        router.push(CAMERA_DENIED_HREF);
        return;
      }
    }
    const shot = await ImagePicker.launchCameraAsync(CAPTURE_IMAGE_PICKER_OPTIONS);
    if (shot.canceled || !shot.assets?.[0]?.uri) return;
    const asset = shot.assets[0];
    const mime = mimeTypeFromImagePickerAsset(asset);
    const uploadMime =
      mime.includes('heic') || mime.includes('heif') ? 'image/jpeg' : mime || 'image/jpeg';
    await setPendingCaptureUri(asset.uri, uploadMime);
    goTag();
  };

  const upload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      router.push(MANUAL_ENTRY_HREF);
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync(CAPTURE_IMAGE_PICKER_OPTIONS);
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    const asset = picked.assets[0];
    const mime = mimeTypeFromImagePickerAsset(asset);
    const uploadMime =
      mime.includes('heic') || mime.includes('heif') ? 'image/jpeg' : mime || 'image/jpeg';
    await setPendingCaptureUri(asset.uri, uploadMime);
    goTag();
  };

  return (
    <SafeAreaView style={styles.root} testID="capture-2a" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Cancel"
        testID="capture-2a-back"
        onBack={() => router.replace(TRACK_HREF as never)}
      />
      <View style={styles.content}>
        <View style={styles.preview} testID="capture-2a-preview">
          <Text style={styles.previewHint}>Camera preview</Text>
        </View>
        <Text style={styles.title} testID="capture-2a-title">
          {CAPTURE_2A_TITLE}
        </Text>
        <Text style={styles.body} testID="capture-2a-copy">
          {CAPTURE_2A_COPY}
        </Text>
        <Text style={styles.hint} testID="capture-photo-hint-copy">
          {CAPTURE_2A_PHOTO_HINT}
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.primary}
          testID="capture-2a-photo"
          onPress={() => void takePhoto()}
          accessibilityRole="button"
          accessibilityLabel="Capture">
          <Text style={styles.primaryLabel}>Capture</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          testID="capture-2a-upload"
          onPress={() => void upload()}
          accessibilityRole="button"
          accessibilityLabel="Choose from library">
          <Text style={styles.secondaryLabel}>Choose from library</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { flex: 1, paddingTop: 24, alignItems: 'center' },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: V4DesignTokens.color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  previewHint: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12.5,
    color: V4DesignTokens.color.muted,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 16,
    color: V4DesignTokens.color.black,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    marginBottom: 6,
  },
  hint: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
  },
  footer: { paddingBottom: 12 },
  primary: {
    backgroundColor: V4DesignTokens.color.red,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  primaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  secondary: {
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: V4DesignTokens.color.lineStrong,
    backgroundColor: V4DesignTokens.color.white,
  },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 16,
    color: V4DesignTokens.color.black,
  },
});
