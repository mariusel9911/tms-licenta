import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock objects — must be defined before vi.mock() factories run
// ---------------------------------------------------------------------------

const { mockSetContent, mockPdf, mockClose, mockNewPage, mockLaunch } = vi.hoisted(() => {
  const mockPdf = vi.fn().mockResolvedValue(Buffer.from('MOCK_PDF_BYTES'));
  const mockSetContent = vi.fn().mockResolvedValue(undefined);
  const mockClose = vi.fn().mockResolvedValue(undefined);
  const mockNewPage = vi.fn().mockResolvedValue({
    setContent: mockSetContent,
    pdf: mockPdf,
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  });
  const mockLaunch = vi.fn().mockResolvedValue({
    newPage: mockNewPage,
    close: mockClose,
  });
  return { mockSetContent, mockPdf, mockClose, mockNewPage, mockLaunch };
});

vi.mock('puppeteer', () => ({
  default: {
    launch: mockLaunch,
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

vi.mock('../../../config/paths', () => ({
  BACKEND_ROOT: '/mock/backend',
}));

import fs from 'fs';
import { generateCharteringAgreementPdf } from '../order-pdf.service.js';
import { buildAppSettings } from '../../../__tests__/helpers/factories.js';
import type { CreateOrderDtoType } from '../orders.dto.js';

const fsMock = fs as unknown as {
  existsSync: ReturnType<typeof vi.fn>;
  readFileSync: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Minimal DTO for PDF generation
// ---------------------------------------------------------------------------

function buildPdfDto(overrides: Partial<CreateOrderDtoType> = {}): CreateOrderDtoType {
  return {
    clientId: 1,
    orderSeries: 'BGR',
    orderNumber: 'BGR1',
    pickupAddress: 'Str. Pickup 1, Timisoara',
    pickupCountry: 'Romania',
    deliveryAddress: 'Str. Delivery 1, Bucuresti',
    deliveryCountry: 'Romania',
    ...overrides,
  } as CreateOrderDtoType;
}

const defaultNames = {
  clientName: 'Test Client SRL',
  transporterName: 'Transport SRL',
  transporterFiscalCode: 'RO99999999',
  transporterAddress: 'Str. Transport 1',
  transporterPhone: '+40799999999',
  transporterEmail: 'transport@test.ro',
  vehiclePlate: 'TM01ABC',
  driverName: 'John Doe',
  contactName: 'Contact Name',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default puppeteer mock behavior after clearAllMocks()
  mockPdf.mockResolvedValue(Buffer.from('MOCK_PDF_BYTES'));
  mockSetContent.mockResolvedValue(undefined);
  mockClose.mockResolvedValue(undefined);
  mockNewPage.mockResolvedValue({ setContent: mockSetContent, pdf: mockPdf, setRequestInterception: vi.fn().mockResolvedValue(undefined), on: vi.fn() });
  mockLaunch.mockResolvedValue({ newPage: mockNewPage, close: mockClose });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateCharteringAgreementPdf()', () => {
  it('returns a Buffer from puppeteer', async () => {
    const settings = buildAppSettings({ companyLogoPath: null });

    const result = await generateCharteringAgreementPdf(buildPdfDto(), settings, defaultNames);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe('MOCK_PDF_BYTES');
  });

  it('launches puppeteer, calls setContent and pdf, then closes browser', async () => {
    const settings = buildAppSettings({ companyLogoPath: null });

    await generateCharteringAgreementPdf(buildPdfDto(), settings, defaultNames);

    expect(mockLaunch).toHaveBeenCalledWith({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    expect(mockNewPage).toHaveBeenCalled();
    expect(mockSetContent).toHaveBeenCalledWith(
      expect.stringContaining('<!DOCTYPE html>'),
      { waitUntil: 'domcontentloaded' },
    );
    expect(mockPdf).toHaveBeenCalledWith({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '16mm', right: '16mm' },
    });
    expect(mockClose).toHaveBeenCalled();
  });

  it('falls back to company name text when companyLogoPath is null', async () => {
    const settings = buildAppSettings({ companyLogoPath: null, companyName: 'My Company SRL' });

    await generateCharteringAgreementPdf(buildPdfDto(), settings, defaultNames);

    // Capture the HTML passed to setContent
    const htmlArg = mockSetContent.mock.calls[0][0] as string;
    expect(htmlArg).toContain('My Company SRL');
    // Should NOT have an img tag with data:image
    expect(htmlArg).not.toContain('data:image');
  });

  it('includes multi-cargo rows in HTML when cargoItems is provided', async () => {
    const settings = buildAppSettings({ companyLogoPath: null });
    const dto = buildPdfDto({
      cargoItems: [
        { qty: 2, description: 'Wooden Pallets', lengthCm: 120, widthCm: 80, heightCm: 100, weightKg: 500 },
        { qty: 1, description: 'Fragile Glass', lengthCm: 60, widthCm: 40, heightCm: 50, weightKg: 100 },
      ],
    });

    await generateCharteringAgreementPdf(dto, settings, defaultNames);

    const htmlArg = mockSetContent.mock.calls[0][0] as string;
    expect(htmlArg).toContain('Wooden Pallets');
    expect(htmlArg).toContain('Fragile Glass');
    // Total weight should be shown
    expect(htmlArg).toContain('TOTAL');
  });

  it('embeds logo data URI in HTML when companyLogoPath is set and file exists', async () => {
    const settings = buildAppSettings({ companyLogoPath: 'uploads/logos/company-logo.png' });

    // Mock fs to simulate logo file presence
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockReturnValue(Buffer.from('fake-logo-bytes'));

    await generateCharteringAgreementPdf(buildPdfDto(), settings, defaultNames);

    const htmlArg = mockSetContent.mock.calls[0][0] as string;
    expect(htmlArg).toContain('data:image/png;base64,');
    // Should have img tag, not company name as text in the logo block
    expect(htmlArg).toContain('<img');
  });

  it('formats loading and delivery dates when provided', async () => {
    const settings = buildAppSettings({ companyLogoPath: null });
    const dto = buildPdfDto({
      pickupDateBegin: new Date('2026-03-15T08:30:00Z').toISOString(),
      deliveryDateBegin: new Date('2026-03-16T14:00:00Z').toISOString(),
    });

    await generateCharteringAgreementPdf(dto, settings, defaultNames);

    const htmlArg = mockSetContent.mock.calls[0][0] as string;
    // The formatted dates are injected into the HTML addr-date divs
    expect(htmlArg).toContain('/03/26');
  });

  it('renders additional loading and delivery address rows in the HTML', async () => {
    const settings = buildAppSettings({ companyLogoPath: null });
    const dto = buildPdfDto({
      additionalPickups: [
        { address: 'Second Loading Point', country: 'Spain', dateBegin: '2026-05-02T09:00:00Z' },
      ],
      additionalDeliveries: [
        { address: 'Second Delivery Point', country: 'Germany', dateBegin: '2026-05-03T14:00:00Z' },
        { address: 'Third Delivery Point', country: 'France', dateBegin: '2026-05-04T08:00:00Z' },
      ],
    });

    await generateCharteringAgreementPdf(dto, settings, defaultNames);

    const htmlArg = mockSetContent.mock.calls[0][0] as string;
    expect(htmlArg).toContain('Second Loading Point');
    expect(htmlArg).toContain('Second Delivery Point');
    expect(htmlArg).toContain('Third Delivery Point');
    expect(htmlArg).toContain('Loading Address 2');
    expect(htmlArg).toContain('Delivery Address 2');
    expect(htmlArg).toContain('Delivery Address 3');
  });

  it('renders the same output as before when no additional addresses are provided', async () => {
    const settings = buildAppSettings({ companyLogoPath: null });
    const dto = buildPdfDto();

    await generateCharteringAgreementPdf(dto, settings, defaultNames);

    const htmlArg = mockSetContent.mock.calls[0][0] as string;
    expect(htmlArg).toContain('Loading Address');
    expect(htmlArg).toContain('Delivery Address');
    expect(htmlArg).not.toContain('Loading Address 2');
    expect(htmlArg).not.toContain('Delivery Address 2');
  });

  it('includes vehicle plate and driver name in subcontractor box when provided', async () => {
    const settings = buildAppSettings({ companyLogoPath: null });

    await generateCharteringAgreementPdf(buildPdfDto(), settings, defaultNames);

    const htmlArg = mockSetContent.mock.calls[0][0] as string;
    expect(htmlArg).toContain('Vehicle :');
    expect(htmlArg).toContain('TM01ABC');
    expect(htmlArg).toContain('Driver :');
    expect(htmlArg).toContain('John Doe');
  });

  it('omits vehicle and driver lines when names are null', async () => {
    const settings = buildAppSettings({ companyLogoPath: null });
    const names = { ...defaultNames, vehiclePlate: null, driverName: null };

    await generateCharteringAgreementPdf(buildPdfDto(), settings, names);

    const htmlArg = mockSetContent.mock.calls[0][0] as string;
    expect(htmlArg).not.toContain('Vehicle :');
    expect(htmlArg).not.toContain('Driver :');
  });

  it('does not include internalNotes anywhere in the rendered HTML', async () => {
    const settings = buildAppSettings({ companyLogoPath: null });
    // internalNotes is NOT a field on CreateOrderDtoType intentionally — it must never reach the PDF
    // We verify the DTO type enforces this: we cast to check the HTML doesn't leak it somehow
    const dto = buildPdfDto();

    await generateCharteringAgreementPdf(dto, settings, defaultNames);

    const htmlArg = mockSetContent.mock.calls[0][0] as string;
    // If someone accidentally passes internalNotes through, this catches it
    expect(htmlArg).not.toContain('internalNotes');
    expect(htmlArg).not.toContain('Internal Notes');
  });
});
