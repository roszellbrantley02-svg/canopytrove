export type { DeviceLocationResult, SearchLocationResult } from './locationServiceShared';
export { calculateDistanceMiles, findAreaByQuery, findNearestArea } from './locationServiceShared';
export {
  getBestAvailableDeviceLocation,
  getPassiveDeviceLocation,
  getCachedDeviceLocation,
  primeStoredDeviceLocation,
  resolveDeviceLocationLabel,
} from './locationDeviceService';
export { resolveSearchLocation } from './locationSearchService';
