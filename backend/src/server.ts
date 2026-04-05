import type { Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { logger } from './observability/logger';

const initialEnvKeys = new Set(Object.keys(process.env));

function shouldLoadBackendEnvFiles() {
  return !process.env.K_SERVICE && !process.env.CLOUD_RUN_JOB;
}

function loadBackendEnv(options?: { includeLocalOverride?: boolean }) {
  const backendRoot = path.resolve(__dirname, '..');
  const envFiles = [path.join(backendRoot, '.env')];

  if (options?.includeLocalOverride) {
    envFiles.push(path.join(backendRoot, '.env.local'));
  }

  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) {
      continue;
    }

    const parsed = parse(fs.readFileSync(envFile, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!initialEnvKeys.has(key)) {
        process.env[key] = value;
      }
    }
  }
}

if (shouldLoadBackendEnvFiles()) {
  loadBackendEnv({ includeLocalOverride: true });
}

// Global crash handlers — log + report, then exit for Cloud Run restart
process.on('unhandledRejection', (reason) => {
  // Dynamic require to avoid circular deps with lazy-loaded modules
  const { logger } = require('./observability/logger');
  logger.error('Unhandled rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exitCode = 1;
});

process.on('uncaughtException', (error) => {
  const { logger } = require('./observability/logger');
  logger.error('Uncaught exception — exiting', {
    error: error.message,
    stack: error.stack,
  });
  // Give a brief window for async reporters, then hard exit
  setTimeout(() => process.exit(1), 2_000).unref();
});

function stopBackgroundSchedulers(options: {
  stopOwnerLicenseComplianceScheduler: () => void;
  stopOwnerPromotionScheduler: () => void;
  stopRuntimeHealthMonitorScheduler: () => void;
  stopStorefrontDiscoveryScheduler: () => void;
}) {
  options.stopRuntimeHealthMonitorScheduler();
  options.stopOwnerLicenseComplianceScheduler();
  options.stopOwnerPromotionScheduler();
  options.stopStorefrontDiscoveryScheduler();
}

function registerShutdownHandlers(server: Server, cleanup: () => void) {
  let shuttingDown = false;

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    const { markShuttingDown } = require('./observability/shutdownState');
    const { logger } = require('./observability/logger');

    markShuttingDown();
    logger.info('Graceful shutdown initiated');

    cleanup();
    server.close(() => {
      logger.info('Server closed');
    });

    const timeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, 9_000);
    timeout.unref();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  server.once('close', cleanup);
}

void (async () => {
  const { captureBackendException, initializeBackendMonitoring, installBackendProcessMonitoring } =
    await import('./observability/sentry');
  const { startOwnerLicenseComplianceScheduler } =
    await import('./services/ownerPortalLicenseComplianceService');
  const { stopOwnerLicenseComplianceScheduler } =
    await import('./services/ownerPortalLicenseComplianceService');
  const { startOwnerPromotionScheduler } =
    await import('./services/ownerPortalPromotionSchedulerService');
  const { stopOwnerPromotionScheduler } =
    await import('./services/ownerPortalPromotionSchedulerService');
  const { startRuntimeHealthMonitorScheduler, stopRuntimeHealthMonitorScheduler } =
    await import('./services/healthMonitorService');
  const { startStorefrontDiscoveryScheduler } =
    await import('./services/storefrontDiscoveryOrchestrationService');
  const { stopStorefrontDiscoveryScheduler } =
    await import('./services/storefrontDiscoveryOrchestrationService');
  const { serverConfig } = await import('./config');

  initializeBackendMonitoring();
  installBackendProcessMonitoring();
  const stopSchedulers = () =>
    stopBackgroundSchedulers({
      stopOwnerLicenseComplianceScheduler,
      stopOwnerPromotionScheduler,
      stopRuntimeHealthMonitorScheduler,
      stopStorefrontDiscoveryScheduler,
    });

  try {
    const [{ createApp }, { warmBackendStorefrontSource }] = await Promise.all([
      import('./app'),
      import('./sources'),
    ]);

    const app = createApp();

    await warmBackendStorefrontSource();

    const server = await new Promise<Server>((resolve, reject) => {
      const nextServer = app.listen(serverConfig.port, () => {
        resolve(nextServer);
      });

      nextServer.once('error', reject);
    });

    const { logger } = require('./observability/logger');
    logger.info(`CanopyTrove backend listening on http://localhost:${serverConfig.port}`);

    // Start schedulers with graceful degradation - one failing doesn't block others
    try {
      startRuntimeHealthMonitorScheduler();
    } catch (error) {
      logger.warn('Failed to start runtime health monitor scheduler', { error: String(error) });
    }

    if (serverConfig.ownerLicenseComplianceSchedulerEnabled) {
      try {
        startOwnerLicenseComplianceScheduler(serverConfig.ownerLicenseComplianceIntervalHours);
      } catch (error) {
        logger.warn('Failed to start owner license compliance scheduler', { error: String(error) });
      }
    }

    if (serverConfig.ownerPromotionSchedulerEnabled) {
      try {
        startOwnerPromotionScheduler(serverConfig.ownerPromotionSweepIntervalMinutes);
      } catch (error) {
        logger.warn('Failed to start owner promotion scheduler', { error: String(error) });
      }
    }

    try {
      void startStorefrontDiscoveryScheduler();
    } catch (error) {
      logger.warn('Failed to start storefront discovery scheduler', { error: String(error) });
    }

    server.once('error', (error) => {
      captureBackendException(error, {
        source: 'server-listen',
        extras: {
          port: serverConfig.port,
        },
      });
      stopSchedulers();
    });
    registerShutdownHandlers(server, stopSchedulers);
  } catch (error) {
    stopSchedulers();
    captureBackendException(error, {
      source: 'server-startup',
    });
    logger.error('CanopyTrove backend failed to start', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Give async reporters (Sentry flush) a brief window, then exit definitively so
    // Cloud Run sees a non-zero exit code and restarts the container.
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 2_000).unref();
  }
})();
