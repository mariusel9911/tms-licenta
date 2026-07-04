# Vehicles Module — How to Use

## What is a Vehicle?
A vehicle is a truck, trailer, or other transport unit in your fleet. Vehicles are linked to orders (as the transport vehicle) and optionally to a partner (the vehicle's owner/operator).

## Vehicle Statuses
- **AVAILABLE** — vehicle is free and can be assigned to orders (shown in green).
- **ON_ROUTE** — vehicle is currently on a transport job (shown in blue).
- **MAINTENANCE** — vehicle is undergoing maintenance and unavailable (shown in amber/yellow).
- **INACTIVE** — vehicle is decommissioned or out of service (shown in gray).

## How to Add a Vehicle
1. Go to **Vehicles** in the sidebar.
2. Click **"New Vehicle"**.
3. Fill in the vehicle details:
   - **License Plate** (required) — the vehicle registration plate number.
   - **VIN** — Vehicle Identification Number (optional but recommended).
   - **Make** — manufacturer (e.g., Volvo, MAN, DAF, Scania).
   - **Model** — vehicle model (e.g., FH16, TGX).
   - **Year** — manufacturing year.
   - **Emissions Standard** — Euro 0 through Euro 6.
   - **Axles** — number of axles.
   - **Category** — vehicle category code.
   - **Fuel Type** — Diesel, Petrol, Electric, Hybrid, CNG, LNG.
   - **Status** — current availability status.
   - **Owner/Operator** — optionally link the vehicle to a partner.
   - **Loading capacity, dimensions, tank capacity, consumption** — optional technical specs.
   - **Notes** — free-text notes.
4. Click **Save Vehicle**.

## How to Edit a Vehicle
1. In the Vehicles list, click the **edit icon** on the vehicle row.
2. Make your changes and click **Save Vehicle**.

## How to Delete (Deactivate) a Vehicle
- Vehicles are **soft-deleted** to preserve historical order data.
- Click the **trash icon** and confirm.
- Deactivated vehicles no longer appear in the vehicle dropdown when creating orders.

## How to Filter Vehicles
- Use the **search bar** to search by license plate, make, model, or VIN.
- Use the **status filter** dropdown to show only vehicles of a specific status.

## Linking Vehicles to Orders
- When creating or editing an order, select a vehicle from the **Vehicle** dropdown.
- Only active (non-deleted) vehicles appear in the dropdown.

## Linking Vehicles to Partners
- A vehicle can optionally be linked to a partner (owner/operator) via the **Owner/Operator** dropdown in the vehicle form.
- All active partners (clients, transporters, or both) can own vehicles.
