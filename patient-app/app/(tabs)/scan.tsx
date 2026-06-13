import { useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GraphUnavailableBanner, ProductBarcodeScanner, ShelfProductRow } from '@/components/conflict';
import { useToast } from '@/components/billing-feedback';
import { ConsumerPrimaryButton } from '@/components/billing-ui';
import { PrimaryFab, SectionLabel } from '@/components/v3';
import { AppTokens } from '@/constants/appTokens';
import { ConflictTokens } from '@/constants/conflictTokens';
import { JournalTokens } from '@/constants/journalTokens';
import { verdictHref } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { addProductManual, fetchEvaluateLineup, scanBarcodeToShelf } from '@/lib/conflict-api';
import type { EvaluateResult, ProductStatus } from '@/lib/conflict-types';
import { patientGet } from '@/lib/patient-api';
import { trackPortalEvent } from '@/lib/trackPortalEvent';

type ShelfRow = {
  id: string;
  product_name: string;
  usage_time?: string;
};

function ViewfinderOverlay() {
  const corner = 22;
  const thick = 3;
  return (
    <View style={styles.viewfinderOverlay} pointerEvents="none">
      <View
        style={[
          styles.corner,
          styles.cornerTL,
          { width: corner, height: corner, borderTopWidth: thick, borderLeftWidth: thick },
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.cornerTR,
          { width: corner, height: corner, borderTopWidth: thick, borderRightWidth: thick },
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.cornerBL,
          { width: corner, height: corner, borderBottomWidth: thick, borderLeftWidth: thick },
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.cornerBR,
          { width: corner, height: corner, borderBottomWidth: thick, borderRightWidth: thick },
        ]}
      />
      <Text style={styles.viewfinderHint}>Hold barcode in the box</Text>
    </View>
  );
}

export default function ScanScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [evaluate, setEvaluate] = useState<EvaluateResult | null>(null);
  const [products, setProducts] = useState<ShelfRow[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const scanLock = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const scannedCodesRef = useRef<Set<string>>(new Set());
  const SCAN_COOLDOWN_MS = 8000;
  const scanLine = useSharedValue(0);

  useEffect(() => {
    scanLine.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true);
  }, [scanLine]);

  useEffect(() => {
    if (ready) trackPortalEvent('scan_tab_opened');
  }, [ready]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLine.value * 120 }],
  }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shelf, evalRes] = await Promise.all([
        patientGet('/api/patient/shelf/products'),
        fetchEvaluateLineup().catch(() => null),
      ]);
      setProducts(Array.isArray(shelf?.products) ? shelf.products : []);
      setEvaluate(evalRes);
    } catch {
      /* 401 → patient-api clears session and redirects to sign-in */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const statusFor = (id: string): ProductStatus => {
    const hit = evaluate?.product_statuses?.find((p) => p.shelf_product_id === id);
    return {
      shelf_product_id: id,
      product_name: hit?.product_name,
      status: (hit?.status as ProductStatus['status']) || 'unknown',
      usage_time: hit?.usage_time,
      note: hit?.note,
    };
  };

  const handleBarcode = async (data: string) => {
    const code = data.trim();
    if (!code || scanLock.current || scanning || scannedCodesRef.current.has(code)) return;

    const now = Date.now();
    if (
      lastScanRef.current &&
      lastScanRef.current.code === code &&
      now - lastScanRef.current.at < SCAN_COOLDOWN_MS
    ) {
      return;
    }
    lastScanRef.current = { code, at: now };
    scanLock.current = true;
    setScanning(true);
    try {
      const res = await scanBarcodeToShelf(code);
      const product = res?.product;
      const productId = String(product?.id || res?.product_id || '');
      if (product?.id) {
        setProducts((prev) => {
          if (prev.some((p) => p.id === product.id)) return prev;
          return [
            ...prev,
            {
              id: String(product.id),
              product_name: String(product.product_name || 'Product'),
              usage_time: product.usage_time,
            },
          ];
        });
      } else {
        await load();
      }
      scannedCodesRef.current.add(code);
      setTimeout(() => scannedCodesRef.current.delete(code), SCAN_COOLDOWN_MS);
      showToast('Product added to shelf', 'success');
      if (productId) {
        router.push(verdictHref(productId));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Scan failed';
      if (msg === 'product_not_found') {
        showToast('Product not in our database — add it by name below', 'error');
        setManualOpen(true);
      } else if (msg.toLowerCase().includes('too many requests')) {
        showToast('Too many requests — wait a moment, then try again', 'error');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      scanLock.current = false;
      setScanning(false);
    }
  };

  const submitManual = async () => {
    const name = manualName.trim();
    if (!name) return;
    setManualBusy(true);
    try {
      const res = await addProductManual({ product_name: name });
      const productId = String(res?.product?.id || '');
      setManualOpen(false);
      setManualName('');
      await load();
      if (productId) {
        router.push(verdictHref(productId));
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not add product', 'error');
    } finally {
      setManualBusy(false);
    }
  };

  if (checking || !ready) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  const cameraReady = Platform.OS === 'web' || permission?.granted;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Your products</Text>
          <Text style={styles.shelfCount}>{products.length} added</Text>
        </View>
        <Text style={styles.subtitle}>Point at barcode · or search below</Text>

        {evaluate?.graph_unavailable ? <GraphUnavailableBanner onRetry={() => void load()} /> : null}

        <View style={styles.scanFrame}>
          {cameraReady ? (
            <>
              <ProductBarcodeScanner enabled={!scanning} onBarcode={(data) => void handleBarcode(data)} />
              <ViewfinderOverlay />
              <Animated.View style={[styles.scanLine, scanLineStyle]} />
              {scanning ? (
                <View style={styles.scanOverlay}>
                  <ActivityIndicator color="#fff" size="large" />
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>Camera access needed to scan product barcodes.</Text>
              <ConsumerPrimaryButton label="Allow camera" onPress={() => requestPermission()} />
            </View>
          )}
        </View>

        <Pressable onPress={() => setManualOpen(true)}>
          <Text style={styles.searchLink}>or search by name</Text>
        </Pressable>

        <SectionLabel>Your shelf today</SectionLabel>
        {products.length === 0 ? (
          <Text style={styles.empty}>No products yet — scan or add one to get a verdict.</Text>
        ) : (
          products.map((p) => {
            const st = statusFor(p.id);
            return (
              <ShelfProductRow
                key={p.id}
                shelf_product_id={p.id}
                product_name={p.product_name || st.product_name}
                usage_time={p.usage_time || st.usage_time}
                status={st.status}
                note={st.note}
                onPress={() => router.push(verdictHref(p.id))}
              />
            );
          })
        )}
      </ScrollView>

      <View style={styles.fabWrap}>
        <PrimaryFab label="Add product" onPress={() => setManualOpen(true)} />
      </View>

      <Modal visible={manualOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add by name</Text>
            <TextInput
              style={styles.input}
              placeholder="Product name"
              value={manualName}
              onChangeText={setManualName}
              autoFocus
            />
            <ConsumerPrimaryButton label={manualBusy ? 'Adding…' : 'Add to shelf'} onPress={() => void submitManual()} />
            <Pressable onPress={() => setManualOpen(false)} style={{ marginTop: 12 }}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: JournalTokens.spacing.lg, paddingBottom: 100, gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: JournalTokens.font.display, fontSize: 28, color: JournalTokens.color.ink },
  shelfCount: { fontSize: 13, fontWeight: '700', color: JournalTokens.color.muted },
  subtitle: { color: JournalTokens.color.muted, marginBottom: 8 },
  scanFrame: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: ConflictTokens.photoBg,
    position: 'relative',
  },
  viewfinderOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', borderColor: '#fff' },
  cornerTL: { top: 24, left: 24 },
  cornerTR: { top: 24, right: 24 },
  cornerBL: { bottom: 24, left: 24 },
  cornerBR: { bottom: 24, right: 24 },
  viewfinderHint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginTop: 80 },
  scanLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: ConflictTokens.barrierGreat,
    top: 40,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBox: { flex: 1, padding: 20, justifyContent: 'center', gap: 12 },
  permissionText: { color: '#fff', textAlign: 'center' },
  searchLink: { color: JournalTokens.color.accent, fontWeight: '600', textAlign: 'center', marginVertical: 8 },
  empty: { color: JournalTokens.color.muted, fontSize: 14 },
  fabWrap: { position: 'absolute', bottom: 16, left: 0, right: 0 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  cancel: { textAlign: 'center', color: '#6B7280' },
});
