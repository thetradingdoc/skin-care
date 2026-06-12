import { CameraView } from 'expo-camera';
import React from 'react';
import { StyleSheet } from 'react-native';

type Props = {
  enabled: boolean;
  onBarcode: (data: string) => void;
};

/** Native barcode scanner (EAN/UPC) via expo-camera. */
export function ProductBarcodeScanner({ enabled, onBarcode }: Props) {
  return (
    <CameraView
      style={styles.camera}
      facing="back"
      barcodeScannerSettings={{
        barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
      }}
      onBarcodeScanned={
        enabled
          ? ({ data }) => {
              onBarcode(data);
            }
          : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
