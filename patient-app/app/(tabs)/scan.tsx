import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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

import { GraphUnavailableBanner, ShelfProductRow } from '@/components/conflict';
import { useToast } from '@/components/billing-feedback';
import { PrimaryButton } from '@/components/billing-ui';
import { ConflictTokens } from '@/constants/conflictTokens';
import { JournalTokens } from '@/constants/journalTokens';
import { verdictHref } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { addProductManual, fetchEvaluateLineup, scanBarcodeToShelf } from '@/lib/conflict-api';
import type { EvaluateResult, ProductStatus } from '@/lib/conflict-types';
import { patientGet } from '@/lib/patient-api';

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
  const scanLine = useSharedValue(0);

  useEffect(() => {
    scanLine.value = withRepeat(withTiming(1, { duration: 1800 }), -1, true);
  }, [scanLine]);

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
    if (!code || scanLock.current || scanning) return;

    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.code === code && now - lastScanRef.current.at < 300) {
      return;
    }
    lastScanRef.current = { code, at: now };
    scanLock.current = true;
    setScanning(true);
    try {
      const res = await scanBarcodeToShelf(code);
      const productId = String(res?.product?.id || res?.product_id || '');
      await load();
      showToast('Product added to shelf', 'success');
      if (productId) {
        router.push(verdictHref(productId));
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Scan failed', 'error');
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

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Scan a product</Text>
          <Text style={styles.shelfCount}>{products.length} in shelf</Text>
        </View>
        <Text style={styles.subtitle}>Point at a barcode to check compatibility with your routine.</Text>

        {evaluate?.graph_unavailable ? <GraphUnavailableBanner /> : null}

        <View style={styles.scanFrame}>
          {permission?.granted ? (
            <>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
                onBarcodeScanned={({ data }) => void handleBarcode(data)}
              />
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
              <PrimaryButton label="Allow camera" onPress={() => requestPermission()} />
            </View>
          )}
        </View>

        <Pressable onPress={() => setManualOpen(true)}>
          <Text style={styles.searchLink}>or search by name</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>Your shelf — today&apos;s lineup</Text>
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

      <Pressable
        style={styles.fab}
        onPress={() => setManualOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add product">
        <Text style={styles.fabText}>Add product</Text>
      </Pressable>

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
            <PrimaryButton label={manualBusy ? 'Adding…' : 'Add to shelf'} onPress={() => void submitManual()} />
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
  root: { flex: 1, backgroundColor: JournalTokens.color.cream },
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
  camera: { flex: 1 },
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
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginTop: 12 },
  empty: { color: JournalTokens.color.muted, fontSize: 14 },
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: ConflictTokens.fabBg,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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
