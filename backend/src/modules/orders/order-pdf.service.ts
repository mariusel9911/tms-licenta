import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import type { AppSettings } from '../../generated/client.js';
import type { CargoItemType, CreateOrderDtoType } from './orders.dto.js';
import { BACKEND_ROOT } from '../../config/paths.js';

function getLogoDataUri(logoPath: string | null): string | null {
  if (!logoPath) return null;
  const absolutePath = path.join(BACKEND_ROOT, logoPath);
  if (!fs.existsSync(absolutePath)) return null;
  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${buffer.toString('base64')}`;
}

function getStampDataUri(stampPath: string | null): string | null {
  if (!stampPath) return null;
  const absolutePath = path.join(BACKEND_ROOT, stampPath);
  if (!fs.existsSync(absolutePath)) return null;
  const buffer = fs.readFileSync(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${buffer.toString('base64')}`;
}

interface PdfNames {
  clientName: string;
  transporterName: string | null;
  transporterFiscalCode?: string | null;
  transporterAddress?: string | null;
  transporterPhone?: string | null;
  transporterEmail?: string | null;
  vehiclePlate?: string | null;
  driverName?: string | null;
  contactName?: string | null;
}

function esc(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

function escPlain(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Format: "DD/MM/YY at HH:mm"
function formatLoadingDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} at ${hh}:${mm}`;
}

// Format: "DD/MM/YY since HH:mm"
function formatDeliveryDate(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} since ${hh}:${mm}`;
}

// Format: "DD/MM/YYYY"
function formatDocDate(isoString?: string | null): string {
  const d = isoString ? new Date(isoString) : new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Format number as "1 234,56"
function fmtNum(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildCargoRows(items: CargoItemType[]): string {
  if (items.length === 0) {
    return '<tr><td colspan="4"></td></tr>';
  }
  return items.map((item) => {
    const dims = [item.lengthCm, item.widthCm, item.heightCm]
      .filter((v) => v !== undefined && v !== null && v !== 0)
      .map((v) => `${fmtNum(v)} cm`)
      .join(' /');
    return `<tr>
      <td class="data">${escPlain(item.qty ?? '')}</td>
      <td class="data">${escPlain(item.description ?? '')}</td>
      <td class="data">${escPlain(dims)}</td>
      <td class="data" style="text-align:right">${item.weightKg ? `${fmtNum(item.weightKg)} KG` : ''}</td>
    </tr>`;
  }).join('');
}

function buildHtml(
  dto: CreateOrderDtoType,
  settings: AppSettings,
  names: PdfNames,
): string {
  const docDate = formatDocDate(dto.documentDate);

  const cargoItems: CargoItemType[] = dto.cargoItems ?? [];
  const totalWeight = cargoItems.reduce((sum, i) => sum + (i.weightKg ?? 0), 0);
  const totalWeightStr = totalWeight > 0 ? `${fmtNum(totalWeight)} KG` : '';

  const additionalPickups = dto.additionalPickups ?? [];
  const additionalDeliveries = dto.additionalDeliveries ?? [];
  const extraRowCount = Math.max(additionalPickups.length, additionalDeliveries.length);
  const additionalAddressRows = Array.from({ length: extraRowCount }, (_, i) => {
    const pickup = additionalPickups[i];
    const delivery = additionalDeliveries[i];
    return `
    <div class="address-row">
      <div class="address-cell">
        ${pickup ? `<div class="addr-header">Loading Address ${i + 2}</div><div class="addr-text">${esc(pickup.address)}</div><div class="addr-date">${formatLoadingDate(pickup.dateBegin)}</div>` : ''}
      </div>
      <div class="address-cell">
        ${delivery ? `<div class="addr-header">Delivery Address ${i + 2}</div><div class="addr-text">${esc(delivery.address)}</div><div class="addr-date">${formatDeliveryDate(delivery.dateBegin)}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const termsText = escPlain(settings.termsAndConditions || 'No terms and conditions configured.');
  const logoDataUri = getLogoDataUri(settings.companyLogoPath);
  const stampDataUri = getStampDataUri(settings.companyStampPath ?? null);

  const vatRate = parseFloat(String(settings.defaultVatPercent)) || 0;
  const priceWithVat =
    dto.transporterPrice && vatRate > 0
      ? Number(dto.transporterPrice) * (1 + vatRate / 100)
      : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; }

    /* ── Page layout ── */
    .page { width: 210mm; }
    .page-break { page-break-before: always; }

    /* ── Document header ── */
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .company-block { display: flex; flex-direction: column; }
    .company-name { font-size: 22pt; font-weight: 900; color: #111; letter-spacing: -1px; }
    .company-logo { max-height: 60px; max-width: 180px; object-fit: contain; display: block; }
    .company-tagline { font-size: 8pt; color: #444; margin-top: 1px; }
    .doc-date { font-size: 9pt; color: #333; padding-top: 4px; }
    .company-details { margin-top: 4px; font-size: 8pt; color: #333; line-height: 1.5; text-align: right; }

    /* ── Title block ── */
    .title-block { text-align: center; margin: 14px 0 10px; }
    .title-block h1 { font-size: 14pt; font-weight: bold; letter-spacing: 1px; color: #111; }
    .title-block .contact-line { font-size: 10pt; color: #111; margin-top: 5px; }
    .title-block .order-line { font-size: 12pt; font-weight: bold; margin-top: 4px; }
    .title-block .recall { font-size: 9pt; font-style: italic; color: #555; margin-top: 2px; }

    /* ── Info box ── */
    .info-box { border: 1px solid #999; padding: 7px 12px; margin: 8px 0; border-radius: 2px; }
    .info-box p { font-size: 10pt; padding: 2px 0; }
    .info-box .label { font-weight: bold; }
    .info-box .data { color: #111; font-weight: bold; }

    /* ── Reference ── */
    .reference-line { text-align: center; margin: 8px 0; font-size: 10pt; font-weight: bold; }
    .reference-line .data { color: #111; }

    /* ── Address rows (supports multiple loading/delivery stops) ── */
    .address-rows { border: 1px solid #999; border-radius: 2px; margin: 8px 0; }
    .address-row { display: grid; grid-template-columns: 1fr 1fr; page-break-inside: avoid; break-inside: avoid; }
    .address-row + .address-row { border-top: 1px solid #999; }
    .address-cell { padding: 8px 12px; min-height: 90px; }
    .address-row .address-cell:first-child { border-right: 1px solid #999; }
    .address-cell .addr-header { font-size: 10pt; font-weight: bold; text-decoration: underline; margin-bottom: 6px; }
    .address-cell .addr-text { font-size: 10pt; color: #111; line-height: 1.45; min-height: 40px; white-space: pre-wrap; }
    .address-cell .addr-date { font-size: 10pt; color: #111; margin-top: 10px; }

    /* ── Cargo table ── */
    .cargo-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10pt; }
    .cargo-table thead { display: table-row-group; }
    .cargo-table th { font-weight: bold; text-decoration: underline; text-align: left; padding: 5px 10px; background: #fff; border: 1px solid #999; }
    .cargo-table td { padding: 4px 10px; vertical-align: top; border-left: 1px solid #999; border-right: 1px solid #999; }
    .cargo-table td.data { color: #111; }
    .cargo-table tr { page-break-inside: avoid; break-inside: avoid; }
    .cargo-table tr:last-child td { border-bottom: 1px solid #999; }
    .cargo-table tr.total-row td { font-weight: bold; color: #111; border-top: 1px solid #ddd; }
    .cargo-table th:last-child, .cargo-table td:last-child { text-align: right; }

    /* ── Notes box ── */
    .notes-box { border: 1px solid #999; padding: 8px 12px; border-radius: 2px; margin: 8px 0; min-height: 65px; page-break-inside: avoid; break-inside: avoid; }
    .notes-box .notes-header { font-size: 10pt; font-weight: bold; text-decoration: underline; margin-bottom: 4px; }
    .notes-box .notes-text { font-size: 10pt; color: #111; line-height: 1.5; white-space: pre-wrap; }

    /* ── Bottom grid ── */
    .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #999; border-radius: 2px; margin: 8px 0; page-break-inside: avoid; break-inside: avoid; }
    .bottom-cell { padding: 14px 14px; min-height: 60px; }
    .bottom-cell:first-child { border-right: 1px solid #999; }
    .bottom-cell .bottom-label { font-size: 10pt; font-weight: bold; margin-bottom: 8px; }
    .bottom-cell .tarif-amount { font-size: 13pt; font-weight: bold; color: #111; }

    /* ── Terms page ── */
    .terms-page h2 { font-size: 13pt; font-weight: bold; margin-bottom: 14px; }
    .terms-page .terms-text { font-size: 10pt; line-height: 1.7; white-space: pre-wrap; color: #222; }
  </style>
</head>
<body>

  <!-- ═══════════════════════════════════ PAGE 1: Chartering Agreement ═══ -->
  <div class="page">

    <!-- Header -->
    <div class="doc-header">
      <div class="company-block">
        ${logoDataUri
      ? `<img src="${logoDataUri}" class="company-logo" alt="Company Logo" />`
      : `<div class="company-name">${escPlain(settings.companyName || 'TMS')}</div>`
    }
      </div>
      <div>
        <div class="doc-date" style="text-align: right;">${docDate}</div>
        <br/>
        <div class="company-details">
          ${settings.companyName ? `<div><strong>${escPlain(settings.companyName)}</strong></div>` : ''}
          ${settings.companyVatCode ? `<div>CUI: ${escPlain(settings.companyVatCode)}</div>` : ''}
          ${settings.companyPhone ? `<div>Tel: ${escPlain(settings.companyPhone)}</div>` : ''}
          ${settings.smtpEmail ? `<div>Email: ${escPlain(settings.smtpEmail)}</div>` : ''}
          ${settings.companyAddress ? `<div>${escPlain(settings.companyAddress)}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- Title -->
    <div class="title-block">
      <h1>SHIPPING ORDER</h1>
      <div class="contact-line">
        <!-- Tel : ${escPlain(settings.companyPhone || '—')}&nbsp;&nbsp;&nbsp;E-mail:${escPlain(settings.companyEmail || '—')} -->
      </div>
      <div class="order-line">Order number : ${escPlain(dto.orderNumber || 'Will be assigned on save')}</div>
      <div class="recall">(To recall in your invoice)</div>
    </div>

    <!-- Subcontractor box -->
    <div class="info-box">
      <p><span class="label">SUBCONTRACTOR : </span><span class="data">${escPlain(names.transporterName || '—')}</span></p>
      ${names.transporterFiscalCode ? `<p><span class="label">CUI : </span><span class="data">${escPlain(names.transporterFiscalCode)}</span></p>` : ''}
      ${names.transporterAddress ? `<p><span class="label">Address : </span><span class="data">${escPlain(names.transporterAddress)}</span></p>` : ''}
      ${names.transporterPhone ? `<p><span class="label">Phone : </span><span class="data">${escPlain(names.transporterPhone)}</span></p>` : ''}
      ${names.transporterEmail ? `<p><span class="label">Email : </span><span class="data">${escPlain(names.transporterEmail)}</span></p>` : ''}
      ${names.vehiclePlate ? `<p><span class="label">Vehicle : </span><span class="data">${escPlain(names.vehiclePlate)}</span></p>` : ''}
      ${names.driverName ? `<p><span class="label">Driver : </span><span class="data">${escPlain(names.driverName)}</span></p>` : ''}
      ${dto.distanceKm ? `<p><span class="label">Distance : </span><span class="data">${fmtNum(dto.distanceKm)}&nbsp;km</span></p>` : ''}
    </div>

    <!-- Reference -->
    <div class="reference-line">
      Reference : <span class="data">${escPlain(dto.clientOrderReference || '')}</span>
    </div>

    <!-- Address rows -->
    <div class="address-rows">
      <div class="address-row">
        <div class="address-cell">
          <div class="addr-header">Loading Address</div>
          <div class="addr-text">${esc(dto.pickupAddress)}</div>
          <div class="addr-date">${formatLoadingDate(dto.pickupDateBegin)}</div>
        </div>
        <div class="address-cell">
          <div class="addr-header">Delivery Address</div>
          <div class="addr-text">${esc(dto.deliveryAddress)}</div>
          <div class="addr-date">${formatDeliveryDate(dto.deliveryDateBegin)}</div>
        </div>
      </div>
      ${additionalAddressRows}
    </div>

    <!-- Cargo table -->
    <table class="cargo-table">
      <thead>
        <tr>
          <th style="width:90px">Quantities:</th>
          <th>Goods:</th>
          <th>Dimensions:</th>
          <th style="width:110px">Weights:</th>
        </tr>
      </thead>
      <tbody>
        ${buildCargoRows(cargoItems)}
        ${totalWeightStr ? `
        <tr class="total-row">
          <td colspan="3">TOTAL</td>
          <td style="text-align:right">${totalWeightStr}</td>
        </tr>` : ''}
      </tbody>
    </table>

    <!-- Notes -->
    <div class="notes-box">
      <div class="notes-header">Additional informations :</div>
      <div class="notes-text">${esc(dto.notes)}</div>
    </div>

    <!-- Bottom: stamp + tarif -->
    <div class="bottom-grid">
      <div class="bottom-cell">
        <div class="bottom-label">Commercial stamp :</div>
        ${dto.applyStamp && stampDataUri ? `<img src="${stampDataUri}" style="max-height:80px;max-width:160px;object-fit:contain;display:block;margin-top:6px;" alt="Stamp" />` : ''}
      </div>
      <div class="bottom-cell">
        <div class="bottom-label">Tarif convenit</div>
        <div class="tarif-amount">${dto.transporterPrice ? `${fmtNum(dto.transporterPrice)}&nbsp;€ <span style="font-weight:bold;font-size:9pt;color:#111">FARA TVA</span>${priceWithVat ? ` <span style="font-weight:normal;font-size:11pt;color:#999">(${fmtNum(priceWithVat)}&nbsp;€ cu TVA)</span>` : ''}` : ''}</div>
      </div>
    </div>

  </div>

  <!-- ═══════════════════════════════════ PAGE 2: Terms & Conditions ═══ -->
  <div class="page page-break terms-page">
    <h2>Terms &amp; Conditions</h2>
    <div class="terms-text">${termsText}</div>
  </div>

</body>
</html>`;
}

export async function generateCharteringAgreementPdf(
  dto: CreateOrderDtoType,
  settings: AppSettings,
  names: PdfNames,
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => req.abort());
    const html = buildHtml(dto, settings, names);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '16mm', right: '16mm' },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}
