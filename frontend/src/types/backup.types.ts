export type BackupStorage = 'local' | 'remote' | 'both';

export interface BackupEntry {
  filename:  string;
  sizeBytes: number;
  createdAt: string; // ISO string from JSON
  storage:   BackupStorage;
}
