# Orders Module — How to Use

## What is an Order?
A transport order represents a single transport job: cargo picked up from one location and delivered to another. Each order has a client (who pays) and a transporter (who carries the cargo). The PDF document generated for each order is called a **shipping order**. In the UI form it appears as "Chartering Agreement" but always refer to it as a "shipping order" when speaking with users.

## Order Statuses
1. **DRAFT** — order is being prepared; not yet confirmed. Only DRAFT orders can be deleted.
2. **CONFIRMED** — order is confirmed and scheduled.
3. **IN_TRANSIT** — cargo is currently being transported.
4. **DELIVERED** — delivery completed.
5. **CANCELLED** — order was cancelled.

## Order Number Format
Order numbers follow the format `BGR{number}` (e.g., BGR1, BGR2). The number sequence can be configured in Settings → General → Order Number Start.

## How to Create an Order
1. Go to **Orders** in the sidebar.
2. Click **"New Order"** (or press **N** on your keyboard when viewing the orders list).
3. Fill in the Chartering Agreement form:
   - **Client** — select the client partner from the dropdown.
   - **Transporter / Subcontractor** — select the transporter partner.
   - **Vehicle** — select the vehicle (optional, can be added later).
   - **Driver Name** — enter the driver's name.
   - **Pickup address + date** — where and when cargo is collected.
   - **Delivery address + date** — where and when cargo is delivered.
   - **Cargo items** — add one or more cargo rows (description, weight, dimensions, quantity).
   - **Client Price** — what the client pays (in EUR or RON).
   - **Transporter Price** — what you pay the transporter.
   - **Distance** — route distance in km.
4. Click **Save Order**.

## How to Edit an Order
1. In the Orders list, click the **edit (pencil) icon** on any order row.
2. Alternatively, open the order detail page and use the form there.
3. Make your changes and click **Save Order**.

## How to Duplicate an Order
1. Click the **duplicate icon** on the order row in the list.
2. A new DRAFT order is created with the same details, but driver name and vehicle are cleared.
3. The new order gets a new order number.

## How to Delete an Order
- Only **DRAFT** orders can be deleted.
- Click the **trash icon** on the order row and confirm the dialog.
- Non-DRAFT orders cannot be deleted (cancel them instead by changing status).

## How to Send an Order (Email)
1. Open the order or find it in the list.
2. Click **"Send"** button. A confirmation dialog will appear.
3. The system sends the shipping order PDF to the transporter's email.
4. After sending, the order is marked as "Sent" (✓ in the Sent column).
5. SMTP must be configured in Settings → Integrations for this to work.

## How to Preview the PDF
- While editing/creating an order, click **"Preview PDF"** to see the shipping order document.
- The PDF is generated from the current form data and shows the full shipping order with all transport details.

## How to Export Orders (CSV)
- In the Orders list, click **"Export"** to download a CSV file of the current filtered orders.

## How to Filter and Search Orders
- Use the **search bar** at the top to search by order number, client name, transporter name, driver, cargo description, etc.
- Use the **status filter** dropdown to show only orders of a specific status.
- Use the **date range** filters to narrow down by date.

## Column Visibility
- Click **"Table Settings"** (gear icon) to show/hide columns in the orders table.
- Your column preferences are saved in the browser.

## Sorting
- Click any column header to sort the orders table by that column.
- Click again to reverse the sort order.

## Quick Add Partner from Order Form
- While creating or editing an order, the Client and Transporter dropdowns have a **"+ Add new..."** option at the bottom.
- Clicking it opens a compact modal to create a new partner without leaving the order form.
- The newly created partner is immediately available in the dropdown.

## Quick Add Vehicle from Order Form
- The Vehicle dropdown also has a **"+ Add new..."** option.
- Opens a compact modal to create a new vehicle inline.
- The new vehicle appears in the dropdown immediately after saving.

## Keyboard Shortcut
- Press **N** on your keyboard while viewing the orders list to open a new order form.
- This shortcut only works on the orders list view (not while typing in a text field).

## Distance Field
- The distance (km) field on the order form is entered manually.
- There is no automatic route calculation or GPS integration.

## Activity Log
- Every order has an activity log showing who created it, what changes were made, and when.
- Open the order detail page to view the full activity history.
