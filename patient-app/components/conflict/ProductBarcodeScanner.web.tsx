import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import React, { createElement, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  enabled: boolean;
  onBarcode: (data: string) => void;
};

/** Web barcode scanner (EAN/UPC) — expo-camera web only supports QR. */
const EMIT_COOLDOWN_MS = 2500;

export function ProductBarcodeScanner({ enabled, onBarcode }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onBarcodeRef = useRef(onBarcode);
  const enabledRef = useRef(enabled);
  const lastEmitRef = useRef<{ text: string; at: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  onBarcodeRef.current = onBarcode;
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const reader = new BrowserMultiFormatReader();
    let cancelled = false;
    setCameraError(null);

    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video, (result) => {
        if (cancelled || !enabledRef.current || !result) return;
        const text = result.getText().trim();
        if (!text) return;
        const now = Date.now();
        const last = lastEmitRef.current;
        if (last && last.text === text && now - last.at < EMIT_COOLDOWN_MS) return;
        lastEmitRef.current = { text, at: now };
        onBarcodeRef.current(text);
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError('Could not start camera. Check browser permissions and reload.');
        }
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [enabled]);

  if (cameraError) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorText}>{cameraError}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {createElement('video', {
        ref: videoRef,
        style: styles.video,
        muted: true,
        playsInline: true,
        autoPlay: true,
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: '100%', overflow: 'hidden' },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: '#000',
  },
  errorBox: { flex: 1, padding: 16, justifyContent: 'center' },
  errorText: { color: '#fff', textAlign: 'center', fontSize: 14 },
});
