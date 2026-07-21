/**
 * TOUCH-056–061 + TOUCH-108 — Bottle mode from Check (barcode + Safe/Caution/Hard-no bands).
 */
import { useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductBarcodeScanner } from '@/components/conflict';
import { useToast } from '@/components/billing-feedback';
import { ClaimSafeRedirect } from '@/components/claim-safe/ClaimSafeRedirect';
import { ToucheMarkCompact } from '@/components/ToucheMarkCompact';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF, verdictHref } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { isConflictVerdictUiEnabled } from '@/lib/claim-safe-ui';
import {
  addProductManual,
  fetchEvaluatePair,
  scanBarcodeToShelf,
  shelfVerdictAction,
} from '@/lib/conflict-api';

type Band = 'safe' | 'caution' | 'hard_no';

function overallToBand(overall: string): Band {
  const o = String(overall || '').toLowerCase();
  if (o === 'hard_no' || o === 'avoid') return 'hard_no';
  if (o === 'caution') return 'caution';
  return 'safe';
}

export default function BottleScreen() {
  return (
    <ClaimSafeRedirect>
      <BottleScreenInner />
    </ClaimSafeRedirect>
  );
}

function BottleScreenInner() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const { showToast } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [band, setBand] = useState<Band | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('Product');
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const scanLock = useRef(false);

  const runScan = useCallback(
    async (code: string) => {
      if (!code || scanLock.current || scanning) return;
      scanLock.current = true;
      setScanning(true);
      try {
        const res = await scanBarcodeToShelf(code);
        const id = String(res?.product?.id || res?.product_id || '');
        const name = String(res?.product?.product_name || 'Product');
        if (!id) throw new Error('product_not_found');
        setProductId(id);
        setProductName(name);
        const evalRes = await fetchEvaluatePair(id);
        setBand(overallToBand(String(evalRes?.overall || 'safe')));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Scan failed';
        if (msg === 'product_not_found') {
          showToast('Not in database — search by name', 'error');
          setManualOpen(true);
        } else {
          showToast(msg, 'error');
        }
      } finally {
        scanLock.current = false;
        setScanning(false);
      }
    },
    [scanning, showToast],
  );

  const submitManual = async () => {
    setBusy(true);
    try {
      if (manualBarcode.trim()) {
        await runScan(manualBarcode.trim());
        setManualOpen(false);
        return;
      }
      const name = manualName.trim();
      if (!name) return;
      const res = await addProductManual({ product_name: name });
      const id = String(res?.product?.id || '');
      if (!id) throw new Error('Could not add product');
      setProductId(id);
      setProductName(name);
      setManualOpen(false);
      const evalRes = await fetchEvaluatePair(id);
      setBand(overallToBand(String(evalRes?.overall || 'safe')));
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not add', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onAction = async (action: 'keep' | 'remove') => {
    if (!productId) return;
    setBusy(true);
    try {
      await shelfVerdictAction(productId, action);
      showToast(action === 'keep' ? 'Kept on shelf' : "Don't use — removed", 'success');
      router.replace(PROGRESS_HREF);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (checking || !ready) {
    return <SafeAreaView style={styles.root} />;
  }

  const cameraDenied = Platform.OS !== 'web' && permission && !permission.granted;
  const bandStyle =
    band === 'hard_no' ? styles.bandHardNo : band === 'caution' ? styles.bandCaution : styles.bandSafe;
  const bandLabel = band === 'hard_no' ? 'Hard no' : band === 'caution' ? 'Caution' : 'Safe';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Pressable onPress={() => router.replace(PROGRESS_HREF)} testID="bottle-back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Bottle</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.markRow} testID="bottle-touche-mark">
        <ToucheMarkCompact height={20} />
      </View>

      <View style={styles.cameraRegion} testID="bottle-camera">
        {cameraDenied ? (
          <View style={styles.denied} testID="bottle-camera-denied">
            <Text style={styles.deniedTitle}>Camera is off</Text>
            <Text style={styles.deniedBody}>
              Enter a barcode or search by name — same Keep / Don&apos;t use path.
            </Text>
            <Pressable style={styles.deniedBtn} onPress={() => void requestPermission()}>
              <Text style={styles.deniedBtnText}>Enable camera</Text>
            </Pressable>
            <Pressable
              style={styles.deniedLink}
              onPress={() => setManualOpen(true)}
              testID="bottle-manual-fallback">
              <Text style={styles.deniedLinkText}>Enter barcode / search</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ProductBarcodeScanner
              enabled={!scanning && !band}
              onBarcode={(data) => void runScan(data)}
            />
            {scanning ? (
              <View style={styles.scanOverlay}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            ) : null}
          </>
        )}
      </View>

      {band ? (
        <View style={[styles.band, bandStyle]} testID={`bottle-band-${band}`}>
          <Text style={styles.bandLabel}>{bandLabel}</Text>
          <Text style={styles.bandName}>{productName}</Text>
          <View style={styles.bandActions}>
            <Pressable
              style={styles.bandSecondary}
              disabled={busy}
              onPress={() => void onAction('remove')}
              testID="bottle-dont-use">
              <Text style={styles.bandSecondaryText}>Don&apos;t use</Text>
            </Pressable>
            <Pressable
              style={styles.bandPrimary}
              disabled={busy}
              onPress={() => void onAction('keep')}
              testID="bottle-keep">
              <Text style={styles.bandPrimaryText}>Keep</Text>
            </Pressable>
          </View>
          {productId ? (
            <Pressable
              onPress={() => router.push(verdictHref(productId))}
              testID="bottle-reveal-detail">
              <Text style={styles.detailLink}>See details</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable style={styles.searchRow} onPress={() => setManualOpen(true)} testID="bottle-search">
          <Text style={styles.searchText}>or search / enter barcode</Text>
        </Pressable>
      )}

      <Modal visible={manualOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Find a product</Text>
            <TextInput
              style={styles.input}
              placeholder="Barcode"
              value={manualBarcode}
              onChangeText={setManualBarcode}
              testID="bottle-manual-barcode"
            />
            <TextInput
              style={styles.input}
              placeholder="Product name"
              value={manualName}
              onChangeText={setManualName}
              testID="bottle-manual-name"
            />
            <Pressable style={styles.deniedBtn} disabled={busy} onPress={() => void submitManual()}>
              <Text style={styles.deniedBtnText}>{busy ? '…' : 'Look up'}</Text>
            </Pressable>
            <Pressable onPress={() => setManualOpen(false)}>
              <Text style={styles.deniedLinkText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  markRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  back: { fontFamily: AppTokens.font.body, color: AppTokens.color.ink, fontSize: 15 },
  title: { fontFamily: AppTokens.font.display, fontSize: 18, color: AppTokens.color.ink },
  cameraRegion: { flex: 1, backgroundColor: '#111', overflow: 'hidden' },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  /** TOUCH-057 Safe green band */
  bandSafe: { backgroundColor: AppTokens.color.safe },
  /** TOUCH-058 Caution terracotta */
  bandCaution: { backgroundColor: AppTokens.color.terracotta },
  /** TOUCH-059 Hard-no solid full width */
  bandHardNo: { backgroundColor: AppTokens.color.hardNo },
  band: { padding: 16, gap: 8 },
  bandLabel: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.4 },
  bandName: { color: '#fff', fontFamily: AppTokens.font.display, fontSize: 20 },
  bandActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  bandSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: AppTokens.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bandSecondaryText: { color: '#fff', fontWeight: '600' },
  bandPrimary: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: AppTokens.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bandPrimaryText: { color: AppTokens.color.ink, fontWeight: '700' },
  detailLink: {
    color: '#fff',
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: 4,
    fontFamily: AppTokens.font.body,
  },
  searchRow: { padding: 16, alignItems: 'center' },
  searchText: { color: AppTokens.color.muted, fontFamily: AppTokens.font.body },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  deniedTitle: { fontFamily: AppTokens.font.display, fontSize: 22, color: '#fff' },
  deniedBody: { fontFamily: AppTokens.font.body, fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  deniedBtn: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  deniedBtnText: { color: '#fff', fontWeight: '600' },
  deniedLink: { padding: 8 },
  deniedLinkText: { color: AppTokens.color.ink, textDecorationLine: 'underline' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontFamily: AppTokens.font.display, fontSize: 18 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: AppTokens.font.body,
  },
});
