/**
 * Camera denied — clones Step 13 (Photo/upload) chrome.
 * Denial-specific copy — not generic capture error.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { CAPTURE_2A_HREF, MANUAL_ENTRY_HREF, TRACK_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { setPendingCaptureUri } from '@/lib/pending-capture-uri';
import { mimeTypeFromImagePickerAsset } from '@/lib/upload-uri';

export const CAMERA_DENIED_TITLE = 'camera access needed';
export const CAMERA_DENIED_BODY =
  'Allow camera access in Settings, or upload a photo / enter details manually.';
export const CAMERA_DENIED_UPLOAD = 'upload photo instead';

export default function CameraDeniedScreen() {
  const router = useRouter();

  const uploadInstead = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      router.push(MANUAL_ENTRY_HREF);
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    const asset = picked.assets[0];
    await setPendingCaptureUri(asset.uri, mimeTypeFromImagePickerAsset(asset));
    router.replace(CAPTURE_2A_HREF);
  };

  return (
    <SafeAreaView style={styles.root} testID="screen-2b-camera-denied" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="camera-denied-back"
        onBack={() => router.replace(TRACK_HREF)}
      />
      <View style={styles.body}>
        <Text style={styles.title} testID="camera-denied-title">
          {CAMERA_DENIED_TITLE}
        </Text>
        <Text style={styles.copy} testID="camera-denied-body">
          {CAMERA_DENIED_BODY}
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.primary}
          testID="camera-denied-upload"
          onPress={() => void uploadInstead()}
          accessibilityRole="button">
          <Text style={styles.primaryLabel}>{CAMERA_DENIED_UPLOAD}</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          testID="camera-denied-manual"
          onPress={() => router.push(MANUAL_ENTRY_HREF)}
          accessibilityRole="button">
          <Text style={styles.secondaryLabel}>enter it manually</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  body: { flex: 1, paddingTop: 12 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
    marginBottom: 10,
  },
  copy: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 15,
    lineHeight: 22,
    color: V4DesignTokens.color.muted,
  },
  footer: { paddingBottom: 12, gap: 8 },
  primary: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
  },
});
