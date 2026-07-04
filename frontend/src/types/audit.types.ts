export type AuditCategory = 'BACKUP' | 'AUTH' | 'USER_MANAGEMENT' | 'SETTINGS';
export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR';

export type AuditAction =
  | 'BACKUP_CREATE' | 'BACKUP_CREATE_FAIL'
  | 'BACKUP_DELETE'
  | 'BACKUP_REMOTE_UPLOAD' | 'BACKUP_REMOTE_UPLOAD_FAIL'
  | 'BACKUP_PRUNE'
  | 'RESTORE_START' | 'RESTORE_SUCCESS' | 'RESTORE_FAIL' | 'RESTORE_BLOCKED_INCOMPAT'
  | 'AUTH_LOGIN_FAIL' | 'AUTH_LOCKOUT'
  | 'AUTH_TOTP_ENABLE' | 'AUTH_TOTP_DISABLE'
  | 'AUTH_PASSKEY_ENROLL' | 'AUTH_PASSKEY_REMOVE'
  | 'USER_CREATE' | 'USER_DEACTIVATE' | 'USER_DELETE' | 'USER_ROLE_CHANGE' | 'USER_PASSWORD_RESET'
  | 'SETTINGS_CHANGE';

export interface AuditActor {
  userId?: number;
  email?:  string;
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
  name:       string;
  date:       string;
  sizeBytes:  number;
  compressed: boolean;
}

export interface AuditEntriesResponse {
  entries:  AuditEntry[];
  total:    number;
  page:     number;
  pageSize: number;
}

export interface BackupCompatibility {
  status:                'ok' | 'older' | 'newer';
  missing:               string[];
  extra:                 string[];
  backupMigrationCount:  number;
  currentMigrationCount: number;
  backupLastMigration?:  string;
  currentLastMigration?: string;
}

export interface RestoreResult {
  dryRun:        boolean;
  compatibility?: BackupCompatibility;
  manifest?:      Record<string, unknown>;
}
