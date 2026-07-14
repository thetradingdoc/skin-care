/**
 * TOUCH-091 Minimal — advanced severity toggle (pulled forward for TOUCH-102).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'touche_advanced_severity_enabled';

export async function getAdvancedSeverityEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setAdvancedSeverityEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, on ? '1' : '0');
}
