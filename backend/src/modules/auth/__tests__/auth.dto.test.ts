import { describe, it, expect } from 'vitest';
import {
  LoginDto,
  VerifyMfaDto,
  EnableMfaStep1Dto,
  EnableMfaStep2Dto,
  DisableMfaDto,
  RegenerateRecoveryCodesDto,
  RegisterPasskeyDto,
  RenamePasskeyDto,
  RequestEmailOtpDto,
} from '../auth.dto.js';

describe('LoginDto', () => {
  it('parses valid credentials', () => {
    const result = LoginDto.safeParse({ email: 'user@example.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = LoginDto.safeParse({ password: 'secret' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('email');
  });

  it('rejects invalid email format', () => {
    const result = LoginDto.safeParse({ email: 'not-an-email', password: 'secret' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('email');
  });

  it('rejects empty password', () => {
    const result = LoginDto.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('password');
  });

  it('rejects missing password', () => {
    const result = LoginDto.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(false);
  });
});

describe('VerifyMfaDto', () => {
  it('parses valid data with totpCode', () => {
    const result = VerifyMfaDto.safeParse({ mfaToken: 'token123', totpCode: '123456' });
    expect(result.success).toBe(true);
  });

  it('parses valid data with recoveryCode', () => {
    const result = VerifyMfaDto.safeParse({ mfaToken: 'token123', recoveryCode: 'ABCD-1234-EF56' });
    expect(result.success).toBe(true);
  });

  it('rejects when neither totpCode nor recoveryCode is provided', () => {
    const result = VerifyMfaDto.safeParse({ mfaToken: 'token123' });
    expect(result.success).toBe(false);
  });

  it('rejects totpCode shorter than 6 digits', () => {
    const result = VerifyMfaDto.safeParse({ mfaToken: 'token123', totpCode: '12345' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('totpCode');
  });

  it('rejects totpCode longer than 6 digits', () => {
    const result = VerifyMfaDto.safeParse({ mfaToken: 'token123', totpCode: '1234567' });
    expect(result.success).toBe(false);
  });

  it('rejects empty mfaToken', () => {
    const result = VerifyMfaDto.safeParse({ mfaToken: '', totpCode: '123456' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('mfaToken');
  });
});

describe('RegenerateRecoveryCodesDto', () => {
  it('parses valid password', () => {
    const result = RegenerateRecoveryCodesDto.safeParse({ password: 'my-password' });
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = RegenerateRecoveryCodesDto.safeParse({ password: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('password');
  });
});

describe('EnableMfaStep1Dto', () => {
  it('parses valid password', () => {
    const result = EnableMfaStep1Dto.safeParse({ password: 'mypassword' });
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = EnableMfaStep1Dto.safeParse({ password: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('password');
  });
});

describe('EnableMfaStep2Dto', () => {
  it('parses valid 6-digit code', () => {
    const result = EnableMfaStep2Dto.safeParse({ totpCode: '654321' });
    expect(result.success).toBe(true);
  });

  it('rejects code with wrong length', () => {
    const result = EnableMfaStep2Dto.safeParse({ totpCode: '1234' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('totpCode');
  });
});

describe('DisableMfaDto', () => {
  it('parses valid password', () => {
    const result = DisableMfaDto.safeParse({ password: 'pass' });
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = DisableMfaDto.safeParse({ password: '' });
    expect(result.success).toBe(false);
  });
});

describe('VerifyMfaDto with webauthnResponse', () => {
  it('parses valid data with webauthnResponse', () => {
    const result = VerifyMfaDto.safeParse({
      mfaToken: 'token123',
      webauthnResponse: { id: 'cred-id', type: 'public-key' },
    });
    expect(result.success).toBe(true);
  });
});

describe('RegisterPasskeyDto', () => {
  it('parses empty body (deviceName is optional)', () => {
    const result = RegisterPasskeyDto.safeParse({});
    expect(result.success).toBe(true);
  });

  it('parses with optional deviceName', () => {
    const result = RegisterPasskeyDto.safeParse({ deviceName: 'My YubiKey' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.deviceName).toBe('My YubiKey');
  });

  it('rejects deviceName longer than 100 chars', () => {
    const result = RegisterPasskeyDto.safeParse({ deviceName: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('RenamePasskeyDto', () => {
  it('parses valid deviceName', () => {
    const result = RenamePasskeyDto.safeParse({ deviceName: 'My Key' });
    expect(result.success).toBe(true);
  });

  it('rejects empty deviceName', () => {
    const result = RenamePasskeyDto.safeParse({ deviceName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing deviceName', () => {
    const result = RenamePasskeyDto.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('VerifyMfaDto with emailOtpCode', () => {
  it('parses valid data with emailOtpCode', () => {
    const result = VerifyMfaDto.safeParse({ mfaToken: 'token123', emailOtpCode: '654321' });
    expect(result.success).toBe(true);
  });

  it('rejects emailOtpCode with wrong length', () => {
    const result = VerifyMfaDto.safeParse({ mfaToken: 'token123', emailOtpCode: '12345' });
    expect(result.success).toBe(false);
  });
});

describe('RequestEmailOtpDto', () => {
  it('parses valid mfaToken', () => {
    const result = RequestEmailOtpDto.safeParse({ mfaToken: 'some-jwt-token' });
    expect(result.success).toBe(true);
  });

  it('rejects empty mfaToken', () => {
    const result = RequestEmailOtpDto.safeParse({ mfaToken: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('mfaToken');
  });

  it('rejects missing mfaToken', () => {
    const result = RequestEmailOtpDto.safeParse({});
    expect(result.success).toBe(false);
  });
});
