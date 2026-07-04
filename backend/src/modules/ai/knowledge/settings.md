# Settings Module — How to Use

## Accessing Settings
- Click **Settings** (gear icon) in the sidebar.
- Only **Admin** users can access most settings. Dispatchers have limited access.

## General Tab
- **Company Name** — your company's legal name (appears on PDFs and chartering agreements).
- **Company CUI** — your company's tax/fiscal code (appears on PDFs).
- **Company Address** — your company's address (appears on PDFs).
- **Company Email** — your company's email address.
- **Company Phone** — your company's phone number (international format).
- **Company Logo** — upload a logo image (JPEG or PNG format, maximum 5MB). The logo appears on all generated shipping order PDFs. Click the logo area to upload or replace it.
- **Order Number Start** — configure the starting number for order number sequences (e.g., set to 100 to start from BGR100).

<!-- ## Banking Tab
- **Bank Name** — your bank's name.
- **IBAN** — your international bank account number. -->

## Invoicing Tab
- **Default VAT %** — default VAT percentage for invoices.

## Integrations Tab (SMTP Email)
- Configure SMTP settings to enable email sending (required for "Send Order" feature):
  - **SMTP Host** — your email server hostname (e.g., smtp.gmail.com).
  - **SMTP Port** — typically 587 (TLS) or 465 (SSL).
  - **SMTP Email** — the sender email address.
  - **SMTP Password** — the email account password or app password.
  - **SMTP Secure** — enable for SSL/TLS connections.
- After saving, the "Send Order" button in the Orders module becomes functional.

## Security Tab
- Manage authentication methods for your account.
- For full details on MFA, passkeys, recovery codes, and login flows, see the authentication documentation.

## Users Tab (Admin only)

### Adding a User
- Click **"Add User"** to open the user form.
- Fill in: name, email, password, and role (Admin or Dispatcher).
- Click **Save** to create the user.

### Editing a User
- Click the **edit (pencil) icon** on a user row.
- Change name, email, or role.
- Click **Save** to apply changes.

### Resetting a Password
- Click the **key icon** on a user row to open the Reset Password dialog.
- Enter the new password and confirm.
- The user will need to use the new password at next login.

### Deactivating a User
- Click the **trash icon** on a user row and confirm.
- Deactivated users cannot log in but their data is preserved.

### Permanently Deleting a User (System Admin Only)
- Only the system admin (admin@tms.ro) can permanently delete users.
- This removes the user record entirely.
- The system admin account itself cannot be edited, deactivated, or deleted.
