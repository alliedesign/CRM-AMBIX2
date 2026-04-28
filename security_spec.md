# Security Specification - Ambix Allie Portal

## Data Invariants
1. **Client Isolation**: A client MUST NOT be able to read or write data belonging to another client.
2. **Admin Supremacy**: Admin accounts (`allie.pakele@gmail.com`, `allie@vibesandvolumes.com`) have full access to all collections.
3. **Immutable Ownership**: The `clientId` and `createdBy` fields must remain unchanged during updates.
4. **Valid Relationships**: Leads, campaigns, and payments MUST reference a valid `clientId`.
5. **Strict Schema**: All writes must conform to the defined types and size limits.

## The "Dirty Dozen" Payloads (Red Team Tests)

| # | Collection | Description | Expected |
|---|------------|-------------|----------|
| 1 | `clients` | Unauthenticated user trying to list all clients | `PERMISSION_DENIED` |
| 2 | `leads` | Client A trying to read a lead from Client B | `PERMISSION_DENIED` |
| 3 | `campaigns` | Client trying to create a campaign for another client | `PERMISSION_DENIED` |
| 4 | `payments` | Client trying to mark their own payment as 'Paid' | `PERMISSION_DENIED` |
| 5 | `leads` | Injecting a 1MB string into the `name` field | `PERMISSION_DENIED` |
| 6 | `clientPayments` | Creating a payment with a negative amount | `PERMISSION_DENIED` |
| 7 | `tasks` | Updating a task to change the `clientId` | `PERMISSION_DENIED` |
| 8 | `users` | Non-admin user trying to update their own `role` to 'admin' | `PERMISSION_DENIED` |
| 9 | `notifications` | User trying to read notifications for another user | `PERMISSION_DENIED` |
| 10 | `clientCustomers` | Spoofing `createdAt` with a client-provided future date | `PERMISSION_DENIED` |
| 11 | `campaigns` | Blank update of a sent campaign | `PERMISSION_DENIED` |
| 12 | `leads` | Creating a lead with an invalid project ID | `PERMISSION_DENIED` |

## Relationship Diagram
`Admin` -> `Clients` -> [`Leads`, `Projects`, `Campaigns`, `Customers`]
`Projects` -> `Tasks`
`Clients` -> `ClientPayments` (Internal Revenue)
`Clients` -> `Payments` (Admin Revenue)
