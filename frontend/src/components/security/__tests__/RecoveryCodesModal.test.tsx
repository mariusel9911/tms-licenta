import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecoveryCodesModal } from '@/components/security/RecoveryCodesModal';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';

const CODES = Array.from({ length: 10 }, (_, i) => `AAAA-BBBB-${String(i).padStart(2, '0')}CC`);

// jsdom doesn't implement navigator.clipboard — define it once for this test file
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

function renderModal(props: Partial<{ open: boolean; codes: string[]; onClose: () => void }> = {}) {
  const onClose = vi.fn();
  return {
    onClose,
    ...render(
      <QueryClientProvider client={createTestQueryClient()}>
        <RecoveryCodesModal open={props.open ?? true} codes={props.codes ?? CODES} onClose={props.onClose ?? onClose} />
      </QueryClientProvider>,
    ),
  };
}

describe('RecoveryCodesModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('displays all 10 recovery codes', () => {
    renderModal();

    for (const code of CODES) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
  });

  it('"Copy All" calls navigator.clipboard.writeText with all codes', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /copy all/i }));

    expect(mockWriteText).toHaveBeenCalledWith(CODES.join('\n'));
  });

  it('"Download .txt" triggers an anchor click', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

    // Spy on document.createElement to intercept the anchor
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(clickSpy);
      }
      return el;
    });

    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /download/i }));

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
  });

  it('Done button is disabled until the confirmation checkbox is checked', async () => {
    renderModal();

    const doneButton = screen.getByRole('button', { name: /done/i });
    expect(doneButton).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(doneButton).not.toBeDisabled();
  });

  it('calls onClose when Done is clicked after confirming', async () => {
    const { onClose } = renderModal();

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
