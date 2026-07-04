import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '@/api/client';
import {
  listBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  uploadBackup,
  downloadBackup,
} from '@/api/backup.api';
import type { BackupEntry } from '@/types/backup.types';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

const backupEntry: BackupEntry = {
  filename: 'backup-2026-04-07T02-00-00.sql.gz',
  storage: 'local',
  createdAt: '2026-04-07T02:00:00.000Z',
  sizeBytes: 1024 * 512,
};

describe('backup.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── listBackups ─────────────────────────────────────────────────────────────

  describe('listBackups()', () => {
    it('calls GET /backup and returns array of backup entries', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: [backupEntry] } });

      const result = await listBackups();

      expect(mockGet).toHaveBeenCalledWith('/backup');
      expect(result).toEqual([backupEntry]);
    });

    it('returns empty array when no backups exist', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: [] } });

      const result = await listBackups();

      expect(result).toEqual([]);
    });
  });

  // ── createBackup ────────────────────────────────────────────────────────────

  describe('createBackup()', () => {
    it('calls POST /backup with destination "both" by default', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: backupEntry } });

      const result = await createBackup();

      expect(mockPost).toHaveBeenCalledWith('/backup', { destination: 'both' });
      expect(result).toEqual(backupEntry);
    });

    it('calls POST /backup with destination "local" when specified', async () => {
      const localEntry = { ...backupEntry, storage: 'local' as const };
      mockPost.mockResolvedValue({ data: { success: true, data: localEntry } });

      const result = await createBackup('local');

      expect(mockPost).toHaveBeenCalledWith('/backup', { destination: 'local' });
      expect(result).toEqual(localEntry);
    });

    it('calls POST /backup with destination "remote" when specified', async () => {
      const remoteEntry = { ...backupEntry, storage: 'remote' as const };
      mockPost.mockResolvedValue({ data: { success: true, data: remoteEntry } });

      await createBackup('remote');

      expect(mockPost).toHaveBeenCalledWith('/backup', { destination: 'remote' });
    });
  });

  // ── restoreBackup ───────────────────────────────────────────────────────────

  describe('restoreBackup()', () => {
    it('calls POST /backup/restore with filename', async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      await restoreBackup('backup-2026-04-07T02-00-00.sql.gz');

      expect(mockPost).toHaveBeenCalledWith('/backup/restore', {
        filename: 'backup-2026-04-07T02-00-00.sql.gz',
        dryRun: false,
        force: false,
      });
    });

    it('resolves void on success', async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      const result = await restoreBackup('backup.sql.gz');

      expect(result).toBeUndefined();
    });
  });

  // ── deleteBackup ────────────────────────────────────────────────────────────

  describe('deleteBackup()', () => {
    it('calls DELETE /backup/:filename with URI-encoded filename', async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });

      await deleteBackup('backup-2026-04-07T02-00-00.sql.gz');

      expect(mockDelete).toHaveBeenCalledWith(
        `/backup/${encodeURIComponent('backup-2026-04-07T02-00-00.sql.gz')}`,
      );
    });

    it('resolves void on success', async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });

      const result = await deleteBackup('backup.sql.gz');

      expect(result).toBeUndefined();
    });
  });

  // ── uploadBackup ─────────────────────────────────────────────────────────────

  describe('uploadBackup()', () => {
    it('calls POST /backup/upload with multipart FormData and returns entry', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: backupEntry } });

      const file = new File(['gz-data'], 'backup.sql.gz', { type: 'application/gzip' });
      const result = await uploadBackup(file);

      expect(mockPost).toHaveBeenCalledWith(
        '/backup/upload',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      expect(result).toEqual(backupEntry);
    });

    it('appends the file under the "backup" key in FormData', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: backupEntry } });

      const file = new File(['data'], 'backup.sql.gz', { type: 'application/gzip' });
      await uploadBackup(file);

      const formData = mockPost.mock.calls[0][1] as FormData;
      expect(formData.get('backup')).toBe(file);
    });
  });

  // ── downloadBackup ───────────────────────────────────────────────────────────

  describe('downloadBackup()', () => {
    it('calls GET /backup/:filename/download with responseType blob and triggers download', async () => {
      const blob = new Blob(['gz-data'], { type: 'application/gzip' });
      mockGet.mockResolvedValue({ data: blob });

      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
      const mockClick = vi.fn();
      const originalCreate = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = originalCreate(tag);
        if (tag === 'a') vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(mockClick);
        return el;
      });

      await downloadBackup('backup-2026-04-07T02-00-00.sql.gz');

      expect(mockGet).toHaveBeenCalledWith(
        `/backup/${encodeURIComponent('backup-2026-04-07T02-00-00.sql.gz')}/download`,
        { responseType: 'blob' },
      );
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      vi.mocked(document.createElement).mockRestore();
    });
  });
});
