import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';
import { colors } from '../theme/tokens';
import {
  evaluateAdminRuntimePolicy,
  getAdminRuntimeAlertStatus,
  getAdminRuntimeConfigurationNote,
  getAdminRuntimeMonitoringStatus,
  getAdminRuntimeStatus,
  hasConfiguredAdminRuntimeApi,
  runAdminRuntimeMonitoringSweep,
  syncAdminRuntimeAlerts,
  updateAdminRuntimePolicy,
} from '../services/adminRuntimeService';
import { getRegisteredOpsAlertPushToken } from '../services/opsAlertNotificationService';
import type {
  RuntimeAlertSubscriptionStatus,
  RuntimeIncidentRecord,
  RuntimeMonitoringStatus,
  RuntimeOpsStatus,
  RuntimePolicy,
} from '../types/runtimeOps';
import { ownerPortalStyles as sharedStyles } from './ownerPortal/ownerPortalStyles';
import { OwnerPortalRuntimeStatusBanner } from './ownerPortal/OwnerPortalRuntimeStatusBanner';

const policyToggleConfig: Array<{
  key: keyof Pick<
    RuntimePolicy,
    | 'safeModeEnabled'
    | 'ownerPortalWritesEnabled'
    | 'promotionWritesEnabled'
    | 'reviewRepliesEnabled'
    | 'profileToolsWritesEnabled'
  >;
  label: string;
}> = [
  { key: 'safeModeEnabled', label: 'Protected mode' },
  { key: 'ownerPortalWritesEnabled', label: 'Owner writes' },
  { key: 'promotionWritesEnabled', label: 'Promotions' },
  { key: 'reviewRepliesEnabled', label: 'Review replies' },
  { key: 'profileToolsWritesEnabled', label: 'Profile tools' },
];

function createEmptyPolicy(): RuntimePolicy {
  return {
    safeModeEnabled: false,
    ownerPortalWritesEnabled: true,
    promotionWritesEnabled: true,
    reviewRepliesEnabled: true,
    profileToolsWritesEnabled: true,
    updatedAt: new Date(0).toISOString(),
    reason: null,
    trigger: 'normal',
  };
}

function getIncidentToneStyle(incident: RuntimeIncidentRecord) {
  if (incident.severity === 'critical') {
    return sharedStyles.resultWarning;
  }

  if (incident.severity === 'warning') {
    return styles.incidentCardWarning;
  }

  return sharedStyles.resultSuccess;
}

export function AdminRuntimePanelScreen() {
  const [status, setStatus] = React.useState<RuntimeOpsStatus | null>(null);
  const [monitoringStatus, setMonitoringStatus] = React.useState<RuntimeMonitoringStatus | null>(
    null,
  );
  const [alertStatus, setAlertStatus] = React.useState<RuntimeAlertSubscriptionStatus | null>(null);
  const [draftPolicy, setDraftPolicy] = React.useState<RuntimePolicy>(createEmptyPolicy);
  const [reasonInput, setReasonInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRunningSweep, setIsRunningSweep] = React.useState(false);
  const [isEnablingAlerts, setIsEnablingAlerts] = React.useState(false);
  const [statusText, setStatusText] = React.useState<string | null>(null);
  const configurationNote = getAdminRuntimeConfigurationNote();

  const syncDraftPolicy = React.useCallback((nextStatus: RuntimeOpsStatus) => {
    setStatus(nextStatus);
    setDraftPolicy(nextStatus.policy);
    setReasonInput(nextStatus.policy.reason ?? '');
  }, []);

  const refresh = React.useCallback(async () => {
    if (!hasConfiguredAdminRuntimeApi()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setStatusText(null);
    try {
      const localPushToken = await getRegisteredOpsAlertPushToken({
        prompt: false,
      }).catch(() => null);
      const [runtimeStatus, runtimeMonitoringStatus] = await Promise.all([
        getAdminRuntimeStatus(),
        getAdminRuntimeMonitoringStatus().catch(() => null),
      ]);

      syncDraftPolicy(runtimeStatus);
      setMonitoringStatus(runtimeMonitoringStatus);
      setAlertStatus(
        await getAdminRuntimeAlertStatus(localPushToken).catch(() => ({
          source: 'admin_runtime' as const,
          pushEnabled: false,
          updatedAt: null,
        })),
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to load runtime status.');
    } finally {
      setIsLoading(false);
    }
  }, [syncDraftPolicy]);

  const runMonitoringSweep = React.useCallback(async () => {
    if (!hasConfiguredAdminRuntimeApi()) {
      return;
    }

    setIsRunningSweep(true);
    setStatusText(null);
    try {
      const nextMonitoringStatus = await runAdminRuntimeMonitoringSweep();
      setMonitoringStatus(nextMonitoringStatus);
      setStatusText(
        nextMonitoringStatus.overallOk === false
          ? 'Health sweep completed with failures.'
          : 'Health sweep completed. All configured targets are healthy.',
      );
      syncDraftPolicy(await getAdminRuntimeStatus());
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to run health monitor sweep.');
    } finally {
      setIsRunningSweep(false);
    }
  }, [syncDraftPolicy]);

  const enableRuntimeAlerts = React.useCallback(async () => {
    if (!hasConfiguredAdminRuntimeApi()) {
      return;
    }

    setIsEnablingAlerts(true);
    setStatusText(null);
    try {
      const pushToken = await getRegisteredOpsAlertPushToken({
        prompt: true,
      });
      if (!pushToken) {
        throw new Error(
          'Push registration is unavailable in this build. Use a preview or development build on a device.',
        );
      }

      const nextAlertStatus = await syncAdminRuntimeAlerts(pushToken);
      setAlertStatus(nextAlertStatus);
      setStatusText('Incident alerts are enabled for this device.');
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : 'Unable to enable runtime incident alerts.',
      );
    } finally {
      setIsEnablingAlerts(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePolicy = React.useCallback(
    async (nextPolicy: RuntimePolicy, nextReason?: string) => {
      setIsSaving(true);
      setStatusText(null);
      try {
        await updateAdminRuntimePolicy({
          safeModeEnabled: nextPolicy.safeModeEnabled,
          ownerPortalWritesEnabled: nextPolicy.ownerPortalWritesEnabled,
          promotionWritesEnabled: nextPolicy.promotionWritesEnabled,
          reviewRepliesEnabled: nextPolicy.reviewRepliesEnabled,
          profileToolsWritesEnabled: nextPolicy.profileToolsWritesEnabled,
          reason: nextReason?.trim() ? nextReason.trim() : null,
          trigger: 'manual',
        });
        setStatusText('Runtime policy saved.');
        await refresh();
      } catch (error) {
        setStatusText(error instanceof Error ? error.message : 'Unable to save runtime policy.');
      } finally {
        setIsSaving(false);
      }
    },
    [refresh],
  );

  const handleQuickProtect = React.useCallback(() => {
    const nextPolicy: RuntimePolicy = {
      ...draftPolicy,
      safeModeEnabled: true,
      ownerPortalWritesEnabled: false,
      promotionWritesEnabled: false,
      reviewRepliesEnabled: false,
      profileToolsWritesEnabled: false,
      trigger: 'manual',
      updatedAt: new Date().toISOString(),
      reason: reasonInput.trim() || 'Protected mode enabled from the internal admin runtime panel.',
    };
    setDraftPolicy(nextPolicy);
    void savePolicy(nextPolicy, nextPolicy.reason ?? undefined);
  }, [draftPolicy, reasonInput, savePolicy]);

  const handleResumeNormal = React.useCallback(() => {
    const nextPolicy: RuntimePolicy = {
      ...draftPolicy,
      safeModeEnabled: false,
      ownerPortalWritesEnabled: true,
      promotionWritesEnabled: true,
      reviewRepliesEnabled: true,
      profileToolsWritesEnabled: true,
      trigger: 'manual',
      updatedAt: new Date().toISOString(),
      reason:
        reasonInput.trim() || 'Normal runtime mode restored from the internal admin runtime panel.',
    };
    setDraftPolicy(nextPolicy);
    void savePolicy(nextPolicy, nextPolicy.reason ?? undefined);
  }, [draftPolicy, reasonInput, savePolicy]);

  const handleEvaluate = React.useCallback(async () => {
    if (!hasConfiguredAdminRuntimeApi()) {
      return;
    }

    setIsSaving(true);
    setStatusText(null);
    try {
      const response = await evaluateAdminRuntimePolicy();
      syncDraftPolicy(response.status);
      setStatusText('Runtime policy re-evaluated from recent incident pressure.');
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to evaluate runtime policy.');
    } finally {
      setIsSaving(false);
    }
  }, [syncDraftPolicy]);

  return (
    <ScreenShell
      eyebrow="Internal Runtime"
      title="Admin runtime panel."
      subtitle="Inspect incident pressure, flip protected mode, and manually control owner write paths from one internal screen."
      headerPill="Internal"
    >
      <MotionInView delay={70}>
        <SectionCard
          title="Runtime access"
          body="This panel is intended for internal testing and operational control only."
        >
          {!hasConfiguredAdminRuntimeApi() ? (
            <View style={[sharedStyles.statusPanel, sharedStyles.statusPanelWarm]}>
              <Text style={sharedStyles.errorText}>
                {configurationNote ?? 'Admin runtime access is not configured in this build.'}
              </Text>
            </View>
          ) : null}
          {statusText ? <Text style={sharedStyles.helperText}>{statusText}</Text> : null}
        </SectionCard>
      </MotionInView>

      {status ? (
        <MotionInView delay={120}>
          <SectionCard
            title="Current runtime status"
            body="Recent incident pressure and the current policy are grouped here before you make changes."
          >
            <OwnerPortalRuntimeStatusBanner runtimeStatus={status} />
            <View style={sharedStyles.summaryStrip}>
              <View style={sharedStyles.summaryTile}>
                <Text style={sharedStyles.summaryTileValue}>
                  {status.incidentCounts.last15Minutes}
                </Text>
                <Text style={sharedStyles.summaryTileLabel}>Incidents 15M</Text>
                <Text style={sharedStyles.summaryTileBody}>
                  All recorded incidents in the last 15 minutes.
                </Text>
              </View>
              <View style={sharedStyles.summaryTile}>
                <Text style={sharedStyles.summaryTileValue}>
                  {status.incidentCounts.criticalLast15Minutes}
                </Text>
                <Text style={sharedStyles.summaryTileLabel}>Critical 15M</Text>
                <Text style={sharedStyles.summaryTileBody}>
                  Critical pressure that can trigger protected mode.
                </Text>
              </View>
              <View style={sharedStyles.summaryTile}>
                <Text style={sharedStyles.summaryTileValue}>
                  {status.incidentCounts.serverLast24Hours}
                </Text>
                <Text style={sharedStyles.summaryTileLabel}>Server 24H</Text>
                <Text style={sharedStyles.summaryTileBody}>
                  Server incidents logged in the last day.
                </Text>
              </View>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {monitoringStatus ? (
        <MotionInView delay={150}>
          <SectionCard
            title="Health monitor"
            body="This layer watches the public site and backend health checks so you can sweep and inspect without leaving the panel."
          >
            <View style={sharedStyles.statusPanel}>
              <Text style={sharedStyles.actionTileTitle}>
                {monitoringStatus.overallOk === null
                  ? 'Waiting for first sweep'
                  : monitoringStatus.overallOk
                    ? 'Healthy'
                    : 'Attention needed'}
              </Text>
              <Text style={sharedStyles.actionTileBody}>
                {monitoringStatus.configured
                  ? monitoringStatus.overallOk === false
                    ? `${monitoringStatus.failingTargetCount} configured target(s) are currently failing.`
                    : `${monitoringStatus.healthyTargetCount} configured target(s) are healthy.`
                  : 'The health monitor is available, but no targets are configured yet.'}
              </Text>
              <Text style={sharedStyles.resultMeta}>
                Interval {monitoringStatus.intervalMinutes} minute(s) · Timeout{' '}
                {monitoringStatus.timeoutMs}ms
              </Text>
              <Text style={sharedStyles.resultMeta}>
                Updated{' '}
                {monitoringStatus.lastRunAt
                  ? new Date(monitoringStatus.lastRunAt).toLocaleString()
                  : 'not reported'}
              </Text>
            </View>

            <View style={sharedStyles.sectionStack}>
              <Pressable
                disabled={isSaving || isRunningSweep || !hasConfiguredAdminRuntimeApi()}
                onPress={() => {
                  void runMonitoringSweep();
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  isRunningSweep ? 'Sweeping health targets' : 'Run manual health sweep'
                }
                style={[
                  sharedStyles.secondaryButton,
                  (isSaving || isRunningSweep || !hasConfiguredAdminRuntimeApi()) &&
                    sharedStyles.buttonDisabled,
                ]}
              >
                <Text style={sharedStyles.secondaryButtonText}>
                  {isRunningSweep ? 'Sweeping...' : 'Run Manual Health Sweep'}
                </Text>
              </Pressable>

              {monitoringStatus.targets.length ? (
                <View style={sharedStyles.cardStack}>
                  {monitoringStatus.targets.map((target) => (
                    <View
                      key={target.id}
                      style={[
                        sharedStyles.actionTile,
                        target.ok ? sharedStyles.resultSuccess : sharedStyles.resultWarning,
                      ]}
                    >
                      <View style={sharedStyles.splitHeaderRow}>
                        <View style={sharedStyles.splitHeaderCopy}>
                          <Text style={sharedStyles.actionTileMeta}>
                            {target.ok ? 'PASS' : 'FAIL'} · {target.kind.toUpperCase()}
                          </Text>
                          <Text style={sharedStyles.actionTileTitle}>{target.label}</Text>
                          <Text style={sharedStyles.actionTileBody}>{target.url}</Text>
                          <Text style={sharedStyles.resultMeta}>
                            {target.message}
                            {target.latencyMs !== null ? ` · ${target.latencyMs}ms` : ''}
                            {target.statusCode !== null ? ` · HTTP ${target.statusCode}` : ''}
                          </Text>
                        </View>
                        <AppUiIcon
                          name={target.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                          size={20}
                          color={target.ok ? '#00F58C' : '#F5C86A'}
                        />
                      </View>
                      <Text style={sharedStyles.resultMeta}>
                        Observed {new Date(target.checkedAt).toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : monitoringStatus.configured ? null : (
                <View style={[sharedStyles.actionTile, sharedStyles.statusPanelWarm]}>
                  <Text style={sharedStyles.actionTileTitle}>
                    No monitoring targets configured.
                  </Text>
                  <Text style={sharedStyles.actionTileBody}>
                    Add OPS_HEALTHCHECK_API_URL and OPS_HEALTHCHECK_SITE_URL on the backend to
                    activate uptime checks.
                  </Text>
                </View>
              )}
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      <MotionInView delay={165}>
        <SectionCard
          title="Incident alerts"
          body="Send protected-mode, critical incident, and health-check alerts straight to this device through Expo push."
        >
          <View
            style={[
              sharedStyles.statusPanel,
              alertStatus?.pushEnabled
                ? sharedStyles.statusPanelSuccess
                : sharedStyles.statusPanelWarm,
            ]}
          >
            <View style={sharedStyles.statusRow}>
              <Text style={sharedStyles.statusLabel}>Device alerts</Text>
              <Text style={sharedStyles.statusValue}>
                {alertStatus?.pushEnabled ? 'Enabled' : 'Off'}
              </Text>
            </View>
            <Text style={sharedStyles.helperText}>
              {alertStatus?.pushEnabled
                ? `Runtime incident alerts are active${alertStatus.updatedAt ? ` as of ${new Date(alertStatus.updatedAt).toLocaleString()}.` : '.'}`
                : 'Enable push delivery to send runtime and uptime incidents to this phone.'}
            </Text>
            <Pressable
              disabled={isEnablingAlerts || !hasConfiguredAdminRuntimeApi()}
              onPress={() => {
                void enableRuntimeAlerts();
              }}
              accessibilityRole="button"
              accessibilityLabel={
                isEnablingAlerts ? 'Enabling incident alerts' : 'Enable incident alerts'
              }
              style={[
                sharedStyles.primaryButton,
                (isEnablingAlerts || !hasConfiguredAdminRuntimeApi()) &&
                  sharedStyles.buttonDisabled,
              ]}
            >
              <Text style={sharedStyles.primaryButtonText}>
                {isEnablingAlerts ? 'Enabling...' : 'Enable Incident Alerts'}
              </Text>
            </Pressable>
          </View>
        </SectionCard>
      </MotionInView>

      {status ? (
        <MotionInView delay={180}>
          <SectionCard
            title="Runtime policy controls"
            body="Use quick actions for broad mode changes, or fine-tune each owner write surface below."
          >
            <View style={sharedStyles.sectionStack}>
              <View style={sharedStyles.buttonRow}>
                <Pressable
                  disabled={isSaving}
                  onPress={handleQuickProtect}
                  accessibilityRole="button"
                  accessibilityLabel={isSaving ? 'Saving protected mode' : 'Enable protected mode'}
                  style={[sharedStyles.primaryButton, isSaving && sharedStyles.buttonDisabled]}
                >
                  <Text style={sharedStyles.primaryButtonText}>
                    {isSaving ? 'Saving...' : 'Enable Protected Mode'}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={isSaving}
                  onPress={handleResumeNormal}
                  accessibilityRole="button"
                  accessibilityLabel={isSaving ? 'Saving normal mode' : 'Resume normal mode'}
                  style={[sharedStyles.secondaryButton, isSaving && sharedStyles.buttonDisabled]}
                >
                  <Text style={sharedStyles.secondaryButtonText}>Resume Normal Mode</Text>
                </Pressable>
              </View>

              <Pressable
                disabled={isSaving}
                onPress={() => {
                  void handleEvaluate();
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  isSaving ? 'Checking incident pressure' : 'Re-evaluate from incident pressure'
                }
                style={[sharedStyles.secondaryButton, isSaving && sharedStyles.buttonDisabled]}
              >
                <Text style={sharedStyles.secondaryButtonText}>
                  {isSaving ? 'Checking...' : 'Re-evaluate From Incident Pressure'}
                </Text>
              </Pressable>

              <View style={sharedStyles.fieldGroup}>
                <Text style={sharedStyles.fieldLabel}>Operator reason</Text>
                <TextInput
                  value={reasonInput}
                  onChangeText={setReasonInput}
                  placeholder="Why are you changing runtime policy?"
                  placeholderTextColor={colors.textSoft}
                  style={sharedStyles.inputPremium}
                />
              </View>

              <View style={sharedStyles.wrapRow}>
                {policyToggleConfig.map((toggle) => {
                  const selected = draftPolicy[toggle.key];
                  return (
                    <Pressable
                      key={toggle.key}
                      onPress={() =>
                        setDraftPolicy((current) => ({
                          ...current,
                          [toggle.key]: !current[toggle.key],
                        }))
                      }
                      accessibilityRole="switch"
                      accessibilityLabel={toggle.label}
                      accessibilityState={{ checked: selected }}
                      style={[sharedStyles.choiceChip, selected && sharedStyles.choiceChipSelected]}
                    >
                      <Text
                        style={[
                          sharedStyles.choiceChipText,
                          selected && sharedStyles.choiceChipTextSelected,
                        ]}
                      >
                        {toggle.label}: {selected ? 'On' : 'Off'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                disabled={isSaving}
                onPress={() => {
                  void savePolicy(draftPolicy, reasonInput);
                }}
                accessibilityRole="button"
                accessibilityLabel={isSaving ? 'Applying policy' : 'Apply current policy'}
                style={[sharedStyles.primaryButton, isSaving && sharedStyles.buttonDisabled]}
              >
                <Text style={sharedStyles.primaryButtonText}>
                  {isSaving ? 'Applying...' : 'Apply Current Policy'}
                </Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {status?.recentIncidents?.length ? (
        <MotionInView delay={240}>
          <SectionCard
            title="Recent incidents"
            body="This is the current incident stream feeding the runtime decision layer."
          >
            <ScrollView horizontal={false} nestedScrollEnabled={true}>
              <View style={sharedStyles.cardStack}>
                {status.recentIncidents.map((incident) => (
                  <View
                    key={incident.id}
                    style={[sharedStyles.actionTile, getIncidentToneStyle(incident)]}
                  >
                    <View style={sharedStyles.splitHeaderRow}>
                      <View style={sharedStyles.splitHeaderCopy}>
                        <Text style={sharedStyles.actionTileMeta}>
                          {incident.severity.toUpperCase()} · {incident.kind}
                        </Text>
                        <Text style={sharedStyles.actionTileTitle}>{incident.message}</Text>
                        <Text style={sharedStyles.actionTileBody}>
                          {incident.source}
                          {incident.path ? ` · ${incident.path}` : ''}
                          {incident.screen ? ` · ${incident.screen}` : ''}
                        </Text>
                      </View>
                      <AppUiIcon
                        name={
                          incident.severity === 'critical'
                            ? 'warning-outline'
                            : incident.severity === 'warning'
                              ? 'alert-circle-outline'
                              : 'checkmark-done-circle-outline'
                        }
                        size={20}
                        color={
                          incident.severity === 'critical'
                            ? '#FFB4A8'
                            : incident.severity === 'warning'
                              ? '#F5C86A'
                              : '#00F58C'
                        }
                      />
                    </View>
                    <Text style={sharedStyles.resultMeta}>
                      Logged {new Date(incident.occurredAt).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </SectionCard>
        </MotionInView>
      ) : null}

      <MotionInView delay={300}>
        <SectionCard
          title="Refresh"
          body="Reload the panel after changing policy or after reproducing a failure."
        >
          <Pressable
            disabled={isLoading || isSaving || !hasConfiguredAdminRuntimeApi()}
            onPress={() => {
              void refresh();
            }}
            accessibilityRole="button"
            accessibilityLabel={isLoading ? 'Refreshing runtime panel' : 'Refresh runtime panel'}
            style={[
              sharedStyles.primaryButton,
              (isLoading || isSaving || !hasConfiguredAdminRuntimeApi()) &&
                sharedStyles.buttonDisabled,
            ]}
          >
            <Text style={sharedStyles.primaryButtonText}>
              {isLoading ? 'Refreshing...' : 'Refresh Runtime Panel'}
            </Text>
          </Pressable>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  incidentCardWarning: {
    borderColor: 'rgba(245, 200, 106, 0.24)',
    backgroundColor: 'rgba(245, 200, 106, 0.10)',
  },
});
