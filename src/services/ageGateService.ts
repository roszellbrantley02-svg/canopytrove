// ageGateService is consumed from the app entry flow in App.tsx.
// Keep the persistence layer isolated here so the UI flow stays simple.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';

const AGE_GATE_ACCEPTED_KEY = `${brand.storageNamespace}:age-gate:accepted`;

export async function hasAcceptedAgeGate() {
  try {
    const storedValue = await AsyncStorage.getItem(AGE_GATE_ACCEPTED_KEY);
    return storedValue === 'true';
  } catch {
    return false;
  }
}

export async function acceptAgeGate() {
  try {
    await AsyncStorage.setItem(AGE_GATE_ACCEPTED_KEY, 'true');
  } catch {
    // Age-gate persistence should not block app access after the user confirms.
  }
}
