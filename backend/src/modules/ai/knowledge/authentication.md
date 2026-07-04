# Authentication & Security — How to Use

## Basic Login
1. Go to the login page.
2. Enter your **email** and **password**.
3. Click **Sign In**.
4. If MFA is not enabled, you are logged in directly.

## Passkey Login
- On the login page, click **"Use a passkey instead"** below the password field.
- Follow the browser prompt to use your fingerprint, Face ID, or security key.
- Passkey login skips the password and any MFA step entirely.

## Two-Factor Authentication (2FA)
If any MFA method is enabled, after entering your password you go to a second step:
- Choose from available methods: **TOTP code**, **Email OTP**, **Recovery code**, or **Passkey**.
- Each method is shown only if it has been enabled for your account.

## TOTP (Authenticator App)
- Go to **Settings → Security** and click **Enable TOTP**.
- Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.).
- Enter the 6-digit code from the app to confirm setup.
- At login, enter the current 6-digit code from your authenticator app.
- Codes change every 30 seconds.

## Email OTP (One-Time Password by Email)
- Go to **Settings → Security** and click **Enable** next to Email OTP.
- Requires SMTP to be configured in Settings → Integrations.
- At login, click "Send code" to receive a 6-digit code by email.
- Enter the code within 5 minutes.
- You can resend the code after 60 seconds.

## Recovery Codes
- After enabling TOTP, click **"Generate Recovery Codes"** in Settings → Security.
- You receive a set of backup codes — download or copy them to a safe place.
- Each recovery code can be used **only once**.
- Use a recovery code at the 2FA step if you lose access to your authenticator or email.
- You can regenerate codes in Settings → Security (old codes become invalid).

## Passkeys (WebAuthn)
- Go to **Settings → Security → Passkeys** section.
- Click **"Add Passkey"** and follow the browser prompt.
- You can register multiple passkeys (e.g., fingerprint on laptop + security key).
- Passkeys work as a primary login method (no password needed).

## Account Lockout
- After **10 failed login attempts**, the account is locked for **15 minutes**.
- Wait 15 minutes and try again, or contact an admin.

## Session Duration
- Login sessions last **8 hours**.
- After 8 hours, you are automatically logged out and must sign in again.
