import { logger } from '../observability/logger';

export type SecurityEventType =
  | 'rate_limit_hit'
  | 'ip_blocked'
  | 'auth_failure'
  | 'validation_rejection'
  | 'suspicious_payload'
  | 'cors_rejection'
  | 'content_type_violation'
  | 'request_size_exceeded'
  | 'abuse_threshold_crossed'
  | 'session_revoked'
  | 'email_change_initiated'
  | 'email_change_confirmed'
  | 'reauth_required'
  | 'user_rate_limited';

interface SecurityEvent {
  type: 'security_event';
  event: SecurityEventType;
  ip: string;
  path: string;
  method: string;
  userId?: string | null;
  detail?: string;
  meta?: Record<string, unknown>;
}

export function logSecurityEvent(event: Omit<SecurityEvent, 'type'>) {
  logger.warn(`security: ${event.event}`, {
    ...event,
    type: 'security_event',
    timestamp: new Date().toISOString(),
  });
}
