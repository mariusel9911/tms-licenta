# Partners Module — How to Use

## What is a Partner?
A partner is any company or individual that TMS works with. Partners can be:
- **CLIENT** — companies that place transport orders (your customers).
- **TRANSPORTER** — companies that carry out the transport jobs (subcontractors).
- **BOTH** — companies that are both clients and transporters.

## Required Fields When Adding a Partner
The following fields are required:
1. **Country** — select from the country dropdown (with circular flags).
2. **Fiscal Code** — the company's tax/VAT number (CUI in Romania).
3. **Company Name** — the legal company name.
4. **Address** — street address and city.
5. **Phone** — contact phone number (international format).
6. **Email** — contact email address.
7. **Contact Person** — name of the primary contact at the company.

Optional fields: payment terms, price per km, registration number, notes.

## How to Add a Partner
1. Go to **Partners** in the sidebar.
2. Click **"New Partner"**.
3. Fill in the required fields (marked with ★).
4. Optionally use **VIES Lookup** to auto-fill company details from the EU VAT database.
5. Click **Save Partner**.

## How to Use VIES Lookup (Auto-fill from EU VAT)
1. In the Partner form, enter the fiscal/VAT code in the **Fiscal Code** field.
2. Click **"Get info from VIES"**.
3. If the VAT number is registered in the EU VIES system, the company name, address, and country will be automatically filled in.
4. After VIES fills the country, the country dropdown is locked (to prevent accidental changes). Change the fiscal code to unlock it.
5. VIES lookup works for EU member states (Romania: RO prefix, Germany: DE, etc.).

## How to Edit a Partner
1. In the Partners list, click the **edit icon** on the partner row.
2. Make your changes and click **Save Partner**.

## How to Delete (Deactivate) a Partner
- Partners are **soft-deleted** (deactivated, not permanently removed) to preserve historical order data.
- Click the **trash icon** on the partner row and confirm.
- Deactivated partners no longer appear in dropdowns for new orders.

## How to Search Partners
- Use the search bar in the Partners page to search by name, email, fiscal code, or country.

## Partner Type
- The **partner type** (CLIENT / TRANSPORTER / BOTH) determines how they can be used in orders.
- Any partner can own vehicles (vehicle fleet linked to a partner).
