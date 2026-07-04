import { z } from 'zod';

export const LoginDto = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDtoType = z.infer<typeof LoginDto>;

export const VerifyMfaDto = z
  .object({
    mfaToken: z.string().min(1, 'mfaToken is required'),
    totpCode: z.string().length(6, 'TOTP code must be 6 digits').optional(),
    recoveryCode: z.string().min(1, 'Recovery code is required').optional(),
    webauthnResponse: z.record(z.string(), z.unknown()).optional(),
    emailOtpCode: z.string().length(6, 'Email OTP code must be 6 digits').optional(),
  })
  .refine((d) => d.totpCode || d.recoveryCode || d.webauthnResponse || d.emailOtpCode, {
    message: 'One of totpCode, recoveryCode, webauthnResponse, or emailOtpCode is required',
    path: ['totpCode'],
  });
export type VerifyMfaDtoType = z.infer<typeof VerifyMfaDto>;

export const RequestEmailOtpDto = z.object({
  mfaToken: z.string().min(1, 'mfaToken is required'),
});
export type RequestEmailOtpDtoType = z.infer<typeof RequestEmailOtpDto>;

export const RegisterPasskeyDto = z.object({
  deviceName: z.string().max(100).optional(),
});
export type RegisterPasskeyDtoType = z.infer<typeof RegisterPasskeyDto>;

export const RenamePasskeyDto = z.object({
  deviceName: z.string().min(1, 'Device name is required').max(100),
});
export type RenamePasskeyDtoType = z.infer<typeof RenamePasskeyDto>;

export const RegenerateRecoveryCodesDto = z.object({
  password: z.string().min(1, 'Password is required'),
});
export type RegenerateRecoveryCodesDtoType = z.infer<typeof RegenerateRecoveryCodesDto>;

export const EnableMfaStep1Dto = z.object({
  password: z.string().min(1, 'Password is required'),
});
export type EnableMfaStep1DtoType = z.infer<typeof EnableMfaStep1Dto>;

export const EnableMfaStep2Dto = z.object({
  totpCode: z.string().length(6, 'TOTP code must be 6 digits'),
});
export type EnableMfaStep2DtoType = z.infer<typeof EnableMfaStep2Dto>;

export const DisableMfaDto = z.object({
  password: z.string().min(1, 'Password is required'),
});
export type DisableMfaDtoType = z.infer<typeof DisableMfaDto>;

export const VerifyPasskeyLoginDto = z.object({
  passkeyLoginToken: z.string().min(1, 'passkeyLoginToken is required'),
  webauthnResponse: z.record(z.string(), z.unknown()),
});
export type VerifyPasskeyLoginDtoType = z.infer<typeof VerifyPasskeyLoginDto>;

export const ToggleEmailOtpDto = z.object({
  enable: z.boolean(),
  password: z.string().optional(),
}).refine(data => {
  if (!data.enable && !data.password) return false;
  return true;
}, {
  message: 'Password is required to disable Email OTP',
  path: ['password']
});
export type ToggleEmailOtpDtoType = z.infer<typeof ToggleEmailOtpDto>;

