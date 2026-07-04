import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DateTimePickerField,
  isoToRoDateTime,
  roDateTimeToIso,
  applyRoMask,
} from '@/components/ui/date-time-picker-field';

// ─── Helper unit tests (pure, no rendering) ───────────────────────────────────

describe('isoToRoDateTime', () => {
  it('returns empty string for empty input', () => {
    expect(isoToRoDateTime('')).toBe('');
  });

  it('returns empty string for invalid ISO', () => {
    expect(isoToRoDateTime('not-a-date')).toBe('');
  });

  it('formats a valid ISO to dd-MM-yyyy HH:mm in local time', () => {
    // Use a fixed date with a time that avoids DST edge-cases
    const d = new Date(2026, 3, 25, 13, 30); // April 25 2026 13:30 LOCAL
    const iso = d.toISOString();
    expect(isoToRoDateTime(iso)).toBe('25-04-2026 13:30');
  });
});

describe('roDateTimeToIso', () => {
  it('returns null for empty string', () => {
    expect(roDateTimeToIso('')).toBeNull();
  });

  it('returns null for string shorter than 16 chars', () => {
    expect(roDateTimeToIso('25-04-2026 13:')).toBeNull();
  });

  it('returns null for invalid date (day 32)', () => {
    expect(roDateTimeToIso('32-04-2026 13:30')).toBeNull();
  });

  it('returns null for invalid month (month 13)', () => {
    expect(roDateTimeToIso('25-13-2026 13:30')).toBeNull();
  });

  it('converts a valid Romanian string to ISO and round-trips', () => {
    const input = '25-04-2026 13:30';
    const iso = roDateTimeToIso(input);
    expect(iso).not.toBeNull();
    // Round-trip: parse back to display format should equal input
    expect(isoToRoDateTime(iso!)).toBe(input);
  });
});

describe('applyRoMask', () => {
  it('returns empty string for empty input', () => {
    expect(applyRoMask('')).toBe('');
  });

  it('strips non-digit characters', () => {
    expect(applyRoMask('abc')).toBe('');
  });

  it('inserts dash after day digits', () => {
    expect(applyRoMask('25')).toBe('25');
    expect(applyRoMask('250')).toBe('25-0');
  });

  it('inserts second dash after month digits', () => {
    expect(applyRoMask('2504')).toBe('25-04');
    expect(applyRoMask('25042')).toBe('25-04-2');
  });

  it('inserts space after year digits', () => {
    expect(applyRoMask('250420261')).toBe('25-04-2026 1');
  });

  it('inserts colon after hour digits', () => {
    expect(applyRoMask('2504202613')).toBe('25-04-2026 13');
    expect(applyRoMask('25042026133')).toBe('25-04-2026 13:3');
  });

  it('produces full mask for 12 digits', () => {
    expect(applyRoMask('250420261330')).toBe('25-04-2026 13:30');
  });

  it('ignores digits beyond 12', () => {
    expect(applyRoMask('2504202613305555')).toBe('25-04-2026 13:30');
  });
});

// ─── Component tests ──────────────────────────────────────────────────────────

function renderField(props: Partial<React.ComponentProps<typeof DateTimePickerField>> = {}) {
  const onChange = vi.fn();
  render(
    <DateTimePickerField
      value=""
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, input: screen.getByRole('textbox') };
}

describe('DateTimePickerField component', () => {
  it('renders an empty input when value is empty', () => {
    const { input } = renderField({ value: '' });
    expect(input).toHaveValue('');
  });

  it('displays value in dd-MM-yyyy HH:mm format', () => {
    const d = new Date(2026, 3, 25, 13, 30);
    const { input } = renderField({ value: d.toISOString() });
    expect(input).toHaveValue('25-04-2026 13:30');
  });

  it('shows placeholder text when value is empty and not focused', () => {
    renderField({ value: '', placeholder: 'Alegeți data' });
    expect(screen.getByPlaceholderText('Alegeți data')).toBeInTheDocument();
  });

  it('calls onChange with ISO when 16 valid chars are typed', () => {
    const { onChange, input } = renderField({ value: '' });
    fireEvent.change(input, { target: { value: '250420261330' } });
    expect(onChange).toHaveBeenCalled();
    const iso = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string;
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(isoToRoDateTime(iso)).toBe('25-04-2026 13:30');
  });

  it('does NOT call onChange while typing a partial mask', () => {
    const { onChange, input } = renderField({ value: '' });
    fireEvent.change(input, { target: { value: '2504' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('25-04');
  });

  it('calls onChange with empty string when Clear is clicked', async () => {
    const user = userEvent.setup();
    const d = new Date(2026, 3, 25, 13, 30);
    const { onChange, input } = renderField({ value: d.toISOString() });
    await user.click(input); // open popover
    const clearBtn = screen.getByRole('button', { name: /clear/i });
    await user.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('calls onChange close to Date.now() when Now is clicked', async () => {
    const user = userEvent.setup();
    const before = Date.now();
    const { onChange, input } = renderField({ value: '' });
    await user.click(input);
    const nowBtn = screen.getByRole('button', { name: /now/i });
    await user.click(nowBtn);
    const after = Date.now();
    expect(onChange).toHaveBeenCalledTimes(1);
    const iso = onChange.mock.calls[0][0] as string;
    const ts = new Date(iso).getTime();
    // handleNow rounds to the start of the minute (setSeconds(0,0)), so allow up to 60 s before
    expect(ts).toBeGreaterThanOrEqual(before - 60_000);
    expect(ts).toBeLessThanOrEqual(after + 1000);
  });

  it('reverts on blur after invalid input and does not call onChange', async () => {
    const user = userEvent.setup();
    const d = new Date(2026, 3, 25, 13, 30);
    const iso = d.toISOString();
    const { onChange, input } = renderField({ value: iso });
    await user.click(input);
    await user.clear(input);
    await user.type(input, '320420261330'); // day=32 → invalid
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    // After blur, typing state is cleared and display reverts to committed value
    expect(input).toHaveValue('25-04-2026 13:30');
  });

  it('input is disabled when disabled prop is true', () => {
    const { input } = renderField({ disabled: true });
    expect(input).toBeDisabled();
  });

  it('forwards id and name props to the inner input', () => {
    renderField({ id: 'pickup-date', name: 'pickupDateBegin' });
    const input = document.getElementById('pickup-date');
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('name', 'pickupDateBegin');
  });
});
