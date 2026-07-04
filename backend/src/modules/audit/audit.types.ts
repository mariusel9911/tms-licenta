export enum AuditCategory {
  BACKUP   = 'BACKUP',
  AUTH     = 'AUTH',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  SETTINGS = 'SETTINGS',
}

export enum AuditSeverity {
  INFO  = 'INFO',
  WARN  = 'WARN',
  ERROR = 'ERROR',
}

export type AuditAction =
  // Backup
  | 'BACKUP_CREATE'
  | 'BACKUP_CREATE_FAIL'
  | 'BACKUP_DELETE'
  | 'BACKUP_REMOTE_UPLOAD'
  | 'BACKUP_REMOTE_UPLOAD_FAIL'
  | 'BACKUP_PRUNE'
  | 'RESTORE_START'
  | 'RESTORE_SUCCESS'
  | 'RESTORE_FAIL'
  | 'RESTORE_BLOCKED_INCOMPAT'
  // Auth
  | 'AUTH_LOGIN_FAIL'
  | 'AUTH_LOCKOUT'
  | 'AUTH_TOTP_ENABLE'
  | 'AUTH_TOTP_DISABLE'
  | 'AUTH_PASSKEY_ENROLL'
  | 'AUTH_PASSKEY_REMOVE'
  // User management
  | 'USER_CREATE'
  | 'USER_DEACTIVATE'
  | 'USER_DELETE'
  | 'USER_ROLE_CHANGE'
  | 'USER_PASSWORD_RESET'
  // Settings
  | 'SETTINGS_CHANGE'
  | 'LOGO_UPLOAD'
  | 'LOGO_DELETE'
  | 'STAMP_UPLOAD'
  | 'STAMP_DELETE';

export interface AuditActor {
  userId?: number;
  email?: string;
}

export interface AuditEntry {
  timestamp: string;
  category:  AuditCategory;
  action:    AuditAction;
  severity:  AuditSeverity;
  actor:     AuditActor;
  details:   Record<string, unknown>;
}

export interface AuditFileInfo {
  name:      string;
  date:      string;
  sizeBytes: number;
  compressed: boolean;
}

export interface AuditEntriesQuery {
  date?:      string;
  category?:  AuditCategory;
  severity?:  AuditSeverity;
  actorEmail?: string;
  q?:         string;
  page?:      number;
  pageSize?:  number;
}
