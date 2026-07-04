import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';

import { prismaMock } from '../../../__tests__/helpers/prisma-mock.js';

vi.mock('../../../config/database', () => ({
  prisma: prismaMock,
}));

import { partnersService } from '../partners.service.js';
import { buildPartner } from '../../../__tests__/helpers/factories.js';
import { PartnerType } from '../../../generated/client.js';

beforeEach(() => {
  mockReset(prismaMock);
});

// ---------------------------------------------------------------------------
// findAll()
// ---------------------------------------------------------------------------

describe('partnersService.findAll()', () => {
  it('returns paginated list of active partners', async () => {
    const partners = [buildPartner({ id: 1 }), buildPartner({ id: 2, name: 'Another SRL' })];
    prismaMock.partner.findMany.mockResolvedValue(partners);
    prismaMock.partner.count.mockResolvedValue(2);

    const result = await partnersService.findAll(1, 20);

    expect(prismaMock.partner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, skip: 0, take: 20 }),
    );
    expect(result.items).toEqual(partners);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('applies search filter across name, fiscalCode and email', async () => {
    prismaMock.partner.findMany.mockResolvedValue([]);
    prismaMock.partner.count.mockResolvedValue(0);

    await partnersService.findAll(1, 20, 'test');

    expect(prismaMock.partner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { contains: 'test', mode: 'insensitive' } },
            { fiscalCode: { contains: 'test', mode: 'insensitive' } },
            { email: { contains: 'test', mode: 'insensitive' } },
          ]),
        }),
      }),
    );
  });

  it('applies partnerType filter when provided', async () => {
    prismaMock.partner.findMany.mockResolvedValue([]);
    prismaMock.partner.count.mockResolvedValue(0);

    await partnersService.findAll(1, 20, undefined, PartnerType.TRANSPORTER);

    expect(prismaMock.partner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ partnerType: PartnerType.TRANSPORTER }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// findOne()
// ---------------------------------------------------------------------------

describe('partnersService.findOne()', () => {
  it('returns the partner when found', async () => {
    const partner = buildPartner();
    prismaMock.partner.findFirst.mockResolvedValue(partner);

    const result = await partnersService.findOne(1);

    expect(result).toEqual(partner);
    expect(prismaMock.partner.findFirst).toHaveBeenCalledWith({
      where: { id: 1, isActive: true },
    });
  });

  it('throws "Partner not found" when partner does not exist', async () => {
    prismaMock.partner.findFirst.mockResolvedValue(null);

    await expect(partnersService.findOne(999)).rejects.toThrow('Partner not found');
  });
});

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

describe('partnersService.create()', () => {
  it('creates a new partner successfully', async () => {
    const partner = buildPartner();
    prismaMock.partner.findUnique.mockResolvedValue(null);
    prismaMock.partner.create.mockResolvedValue(partner);

    const result = await partnersService.create({
      name: 'Test Partner SRL',
      fiscalCode: 'RO12345678',
      partnerType: PartnerType.CLIENT,
      addressLine1: 'Str. Test 1',
      phone: '+40712345678',
      email: 'partner@test.ro',
      contactPerson: 'Ion Popescu',
      country: 'Romania',
    });

    expect(prismaMock.partner.create).toHaveBeenCalled();
    expect(result).toEqual(partner);
  });

  it('throws when active partner with same fiscalCode exists', async () => {
    const existing = buildPartner({ isActive: true });
    prismaMock.partner.findUnique.mockResolvedValue(existing);

    await expect(
      partnersService.create({
        name: 'Other SRL',
        fiscalCode: 'RO12345678',
        partnerType: PartnerType.CLIENT,
        addressLine1: 'Str. Other 1',
        phone: '+40712345679',
        email: 'other@test.ro',
        contactPerson: 'Alt Popescu',
        country: 'Romania',
      }),
    ).rejects.toThrow('A partner with this fiscal code already exists');
  });

  it('frees fiscalCode slot from soft-deleted record and creates new partner', async () => {
    const deleted = buildPartner({ isActive: false, fiscalCode: 'RO12345678' });
    const created = buildPartner({ id: 3 });
    prismaMock.partner.findUnique.mockResolvedValue(deleted);
    prismaMock.partner.update.mockResolvedValue({ ...deleted, fiscalCode: null } as never);
    prismaMock.partner.create.mockResolvedValue(created);

    const result = await partnersService.create({
      name: 'New Partner SRL',
      fiscalCode: 'RO12345678',
      partnerType: PartnerType.CLIENT,
      addressLine1: 'Str. New 1',
      phone: '+40712345670',
      email: 'new@test.ro',
      contactPerson: 'New Person',
      country: 'Romania',
    });

    expect(prismaMock.partner.update).toHaveBeenCalledWith({
      where: { id: deleted.id },
      data: { fiscalCode: null },
    });
    expect(prismaMock.partner.create).toHaveBeenCalled();
    expect(result).toEqual(created);
  });
});

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

describe('partnersService.update()', () => {
  it('updates partner successfully', async () => {
    const partner = buildPartner();
    const updated = buildPartner({ name: 'Updated SRL' });
    // findFirst for findOne(), findUnique for fiscalCode check
    prismaMock.partner.findFirst.mockResolvedValue(partner);
    prismaMock.partner.findUnique.mockResolvedValue(null);
    prismaMock.partner.update.mockResolvedValue(updated);

    const result = await partnersService.update(1, {
      name: 'Updated SRL',
      fiscalCode: 'RO12345678',
    });

    expect(prismaMock.partner.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
    expect(result).toEqual(updated);
  });

  it('throws when updating to a fiscalCode belonging to another active partner', async () => {
    const partner = buildPartner({ id: 1 });
    const conflict = buildPartner({ id: 2, fiscalCode: 'RO99999999', isActive: true });
    prismaMock.partner.findFirst.mockResolvedValue(partner);
    prismaMock.partner.findUnique.mockResolvedValue(conflict);

    await expect(
      partnersService.update(1, { fiscalCode: 'RO99999999' }),
    ).rejects.toThrow('A partner with this fiscal code already exists');
  });
});

// ---------------------------------------------------------------------------
// remove()
// ---------------------------------------------------------------------------

describe('partnersService.remove()', () => {
  it('sets isActive to false (soft delete)', async () => {
    const partner = buildPartner();
    const deactivated = buildPartner({ isActive: false });
    prismaMock.partner.findFirst.mockResolvedValue(partner);
    prismaMock.partner.update.mockResolvedValue(deactivated);

    const result = await partnersService.remove(1);

    expect(prismaMock.partner.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
    expect(result.isActive).toBe(false);
  });
});
