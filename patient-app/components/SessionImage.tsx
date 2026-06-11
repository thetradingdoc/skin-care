import { Image, type ImageStyle } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ConflictTokens } from '@/constants/conflictTokens';
import { getPatientSessionId } from '@/lib/patient-session';

type Props = {
  uri?: string | null;
  style?: StyleProp<ImageStyle>;
  fallback?: React.ReactNode;
  contentFit?: 'cover' | 'contain';
};

export function SessionImage({ uri, style, fallback, contentFit = 'cover' }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getPatientSessionId().then(setSessionId);
  }, []);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={[styles.fallback, style]}>
        {fallback ?? <Text style={styles.fallbackIcon}>📷</Text>}
      </View>
    );
  }

  return (
    <Image
      source={
        sessionId
          ? { uri, headers: { 'x-session-id': sessionId, 'ngrok-skip-browser-warning': 'true' } }
          : { uri }
      }
      style={style}
      contentFit={contentFit}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: ConflictTokens.photoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: { fontSize: 22, opacity: 0.7 },
});
