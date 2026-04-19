import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const firebaseModulePath = require.resolve('../firebase');
const loggerModulePath = require.resolve('../observability/logger');
const scanIngestionServicePath = require.resolve('./scanIngestionService');

const originalModuleEntries = new Map(
  [firebaseModulePath, loggerModulePath].map((modulePath) => [modulePath, require.cache[modulePath]]),
);

function setCachedModule(modulePath: string, exports: unkno