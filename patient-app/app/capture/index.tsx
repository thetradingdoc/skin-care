/**
 * P7.04 — Capture 2a photo or upload entry.
 * Always request a JPEG-compatible representation (iOS HEIC → Compatible) so
 * OpenAI vision / OCR never receive raw HEIC after the quality gate.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { CAMERA_DENIED_HREF, CAPTURE_TAG_HREF, MANUAL_ENTRY_HREF } from '@/constants/routes';
import { setPendingCaptureUri } from '@/lib/pending-capture-uri';
import { mimeTypeFromImagePickerAsset } from '@/lib/upload-uri';

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
    // Compatible + quality → JPEG; never label HEIC for the AI path.
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
    <SecondTierChrome testID="capture-2a">
      <View>
        <Text style={styles.title}>Log something</Text>
        <Text style={styles.body} testID="capture-2a-copy">
          {CAPTURE_2A_COPY}
        </Text>
        <Text style={styles.hint} testID="capture-photo-hint-copy">
          {CAPTURE_2A_PHOTO_HINT}
        </Text>
      </View>
      <View>
        <TierPrimary label="Take a photo" testID="capture-2a-photo" onPress={() => void takePhoto()} />
        <TierSecondary
          label="Upload from library"
          testID="capture-2a-upload"
          onPress={() => void upload()}
        />
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  body: { fontSize: 16, color: AppTokens.color.muted, marginBottom: 8 },
  hint: { fontSize: 14, color: AppTokens.color.hint },
});
