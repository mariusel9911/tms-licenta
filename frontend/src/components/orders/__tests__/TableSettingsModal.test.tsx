import { loadColumnPrefs, saveColumnPrefs, ALL_COLUMN_IDS } from '@/components/orders/TableSettingsModal';

const STORAGE_KEY = 'tms-orders-table-columns';

describe('loadColumnPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('returns all columns visible in default order when storage is empty', () => {
    const prefs = loadColumnPrefs();
    expect(prefs.visible).toEqual(ALL_COLUMN_IDS);
    expect(prefs.order).toEqual(ALL_COLUMN_IDS);
  });

  it('migrates legacy plain-array shape: treats array as visible, order stays default', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['partner', 'status']));
    const prefs = loadColumnPrefs();
    expect(prefs.visible).toEqual(['partner', 'status']);
    expect(prefs.order).toEqual(ALL_COLUMN_IDS);
  });

  it('strips unknown IDs from legacy array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['partner', 'UNKNOWN_COL']));
    const prefs = loadColumnPrefs();
    expect(prefs.visible).toEqual(['partner']);
  });

  it('falls back to all-visible when legacy array is empty after stripping', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['BOGUS']));
    const prefs = loadColumnPrefs();
    expect(prefs.visible).toEqual(ALL_COLUMN_IDS);
  });

  it('reads current envelope shape and preserves custom order', () => {
    const customOrder = [...ALL_COLUMN_IDS].reverse();
    saveColumnPrefs({ visible: ALL_COLUMN_IDS, order: customOrder });
    const prefs = loadColumnPrefs();
    expect(prefs.order).toEqual(customOrder);
    expect(prefs.visible).toEqual(ALL_COLUMN_IDS);
  });

  it('appends new columns not yet in stored order to the end', () => {
    // Simulate a stored order that is missing some IDs (e.g. added in later release)
    const partialOrder = ALL_COLUMN_IDS.slice(0, 5);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ visible: ALL_COLUMN_IDS, order: partialOrder }),
    );
    const prefs = loadColumnPrefs();
    // All IDs must appear exactly once
    expect(prefs.order.length).toBe(ALL_COLUMN_IDS.length);
    // The first 5 are preserved in original position
    expect(prefs.order.slice(0, 5)).toEqual(partialOrder);
    // The remaining IDs are appended
    const appended = prefs.order.slice(5);
    expect(appended).toEqual(ALL_COLUMN_IDS.slice(5));
  });

  it('strips unknown IDs from stored order', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ visible: ALL_COLUMN_IDS, order: [...ALL_COLUMN_IDS, 'UNKNOWN'] }),
    );
    const prefs = loadColumnPrefs();
    expect(prefs.order).not.toContain('UNKNOWN');
    expect(prefs.order.length).toBe(ALL_COLUMN_IDS.length);
  });

  it('handles corrupt JSON gracefully and returns defaults', () => {
    localStorage.setItem(STORAGE_KEY, '{{not valid json}}');
    const prefs = loadColumnPrefs();
    expect(prefs.visible).toEqual(ALL_COLUMN_IDS);
    expect(prefs.order).toEqual(ALL_COLUMN_IDS);
  });
});
