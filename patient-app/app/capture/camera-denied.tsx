/**
 * P7.33 — Screen 2b camera denied.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { CAMERA_DENIED_HREF, CAPTURE_2A_HREF, MANUAL_ENTRY_HREF } from '@/constants/routes';
import { setPendingCaptureUri } from '@/lib/pending-capture-uri';
import { mimeTypeFromImagePickerAsset } from '@/lib/upload-uri';

export const CAMERA_DENIED_TITLE = 'camera access needed';
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
    <SecondTierChrome testID="screen-2b-camera-denied">
      <View>
        <Text style={styles.title} testID="camera-denied-title">
          {CAMERA_DENIED_TITLE}
        </Text>
        <Text style={styles.body}>
          Allow camera access in Settings, or upload a photo / enter details manually.
        </Text>
      </View>
      <View>
        <TierPrimary
          label={CAMERA_DENIED_UPLOAD}
          testID="camera-denied-upload"
          onPress={() => void uploadInstead()}
        />
        <TierSecondary
          label="enter it manually"
          testID="camera-denied-manual"
          onPress={() => router.push(MANUAL_ENTRY_HREF)}
        />
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
