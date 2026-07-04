# Common Errors and Solutions

## Login Issues

### "Invalid credentials"
- Double-check your email and password.
- Ensure Caps Lock is not on.
- Contact your admin to reset your password if you've forgotten it.

### "Account locked"
- After 10 failed login attempts, the account is locked for 15 minutes.
- Wait 15 minutes and try again, or ask an admin to check.

### "MFA code invalid"
- TOTP codes expire every 30 seconds. Try entering the code immediately after it changes.
- Ensure your phone/authenticator app clock is synchronized.
- Use a recovery code if you've lost access to your authenticator.

### Passkey not working
- Ensure your browser supports WebAuthn (Chrome, Firefox, Edge, Safari all do).
- Try using a different passkey or fall back to password login.

## Orders Issues

### "Only DRAFT orders can be deleted"
- To remove a non-DRAFT order, first change its status to CANCELLED (or contact admin).
- Only DRAFT orders can be permanently deleted.

### "Send" button is disabled or grayed out
- The order has already been sent (shown with ✓ in the Sent column).
- SMTP is not configured — go to Settings → Integrations to configure email.

### PDF preview shows wrong order number
- This is expected for new (unsaved) orders. Save the order first, then preview the PDF.

### Order number not sequential
- The order number sequence is configurable in Settings → General → Order Number Start.
- If you see gaps, it may be because some orders were deleted.

## Partners Issues

### "Fiscal code already exists"
- A partner with that fiscal code already exists (it may have been soft-deleted).
- Check if the partner exists in the list (including deactivated ones).
- If reactivating an old partner, edit that existing partner instead.

### VIES lookup returns no data
- The VAT number may not be registered in the EU VIES database (non-EU companies).
- Check that the VAT number format is correct (e.g., RO + 8 digits for Romania).
- VIES may be temporarily unavailable — try again later.

## Vehicles Issues

### "License plate already exists"
- A vehicle with that license plate may have been soft-deleted.
- The system reuses deleted plates for new vehicles with the same plate.

### Vehicle not appearing in order dropdown
- The vehicle may be deactivated (soft-deleted). Check the Vehicles page.
- Only active vehicles appear in order dropdowns.

## Email / SMTP Issues

### Orders not being sent
- Go to Settings → Integrations and verify SMTP settings.
- Ensure the SMTP password is correct (use an app password for Gmail/Google Workspace).
- Check that SMTP port is correct (587 for TLS, 465 for SSL).

### PDF not generated
- This is usually a server-side issue with Puppeteer (PDF generator).
- Contact the system administrator.

## General Issues

### Page not loading / blank screen
- Try refreshing the page (Ctrl+R or Cmd+R).
- Clear browser cache and try again.
- Check if you're logged in (you may have been logged out after 8 hours).

### Changes not saving
- Ensure all required fields (marked with ★) are filled in.
- Check the error message shown in the form or notification toast.
- Try again — there may have been a temporary connection issue.

## Statistics Issues

### "Python AI service is offline" badge
- The AI prediction service is not running or not reachable.
- Predictions will not load, but all other statistics (KPI cards, charts, tables) still work.
- Contact the system administrator to restart the prediction service.

### "No data found yet" on charts
- There are no orders in the database yet.
- Create some orders first, then return to the Statistics page.

### Loading skeleton stays on screen
- The statistics data may be slow to load. Wait a few seconds.
- If it persists, try refreshing the page (Ctrl+R).

## Authentication Errors

### Email OTP code not received
- Check your spam/junk folder.
- Verify SMTP is configured correctly in Settings → Integrations.
- The code expires after 5 minutes — request a new one if it expired.
- You can resend the code after 60 seconds.

### "Recovery code invalid"
- Each recovery code can only be used once. Try a different code.
- If all codes are used, ask an admin to disable MFA on your account, then re-enable and generate new codes.

### Passkey not recognized
- Ensure your browser supports WebAuthn (Chrome, Firefox, Edge, Safari).
- The passkey may have been registered on a different device.
- Fall back to password + TOTP login if the passkey fails.
