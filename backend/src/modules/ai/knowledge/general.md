# TMS — Transport Management System: General Overview

## What is TMS?
TMS (Transport Management System) is a web-based logistics management application designed for Romanian transport companies. It manages transport orders, partners (clients and transporters), vehicle fleet, and invoicing.

## User Roles
- **Admin**: Full access to all features including Settings, Users management, and all CRUD operations.
- **Dispatcher**: Can create and manage orders, partners, and vehicles. Cannot access Settings → Users tab.

## Navigation (Sidebar)
The sidebar on the left provides navigation between:
- **Orders** — manage transport orders (the core feature)
- **Partners** — manage clients and transporters
- **Vehicles** — manage the vehicle fleet
- **Invoices** — placeholder page, NOT yet functional (planned for a future update)
- **Statistics** — view analytics, revenue charts, and profit predictions
- **Settings** — company settings, SMTP, users, security/MFA

## Login & Authentication
- Log in at the login page with your email and password.
- If MFA (Multi-Factor Authentication) is enabled, you will be asked for a TOTP code after entering your credentials.
- You can also use a passkey (WebAuthn) to log in directly without a password.
- Tokens last 8 hours; after that you must log in again.

## Language Support
- The TMS interface is in English.
- The AI assistant always responds in English, regardless of the language you write in.

## Getting Help
- For technical issues or feature requests, contact the system administrator.
- Use the chat assistant (bottom-right button) for quick help about how to use the system.

## Terminology
- The PDF generated for each order is called a **shipping order** (not an invoice).
- Partners include both clients (who pay) and transporters (who carry cargo).
