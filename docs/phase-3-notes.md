# Phase 3 implementation notes

## Approved TSD corrections

- Figures 2 and 3 now have the missing `sequenceDiagram` opening declaration.
- Editable Mermaid sources are in `docs/mermaid/`.
- `scripts/recountCounters.js` audits the three denormalized counters against source records:
  1. `coupons.usedCount` = count of `SUCCESSFUL` redemptions grouped by coupon.
  2. `customerCouponUsage.usedCount` = count of `SUCCESSFUL` redemptions grouped by coupon and customer.
  3. `counters.activeAdminCount` = users where `role=ADMIN` and `status=ACTIVE`.
- The recount script is read-only by default. Use `--apply` to repair the counters from source records.

## Phase 3 endpoint implemented

`POST /api/customer/redemptions`

Required:
- Access token in `Authorization: Bearer <token>`.
- Database user must have `role=CUSTOMER` and `status=ACTIVE`.
- `Idempotency-Key` header containing a UUID v4.
- Body: `couponCode`, `orderId`, `orderAmountPaise`.

The service resolves prior attempts before validating the coupon, then inserts the redemption first and reserves both counters in one MongoDB transaction. It uses the unique idempotency and active-order indexes as concurrency backstops.

## Run locally

The approved design requires a MongoDB replica set; standalone MongoDB is rejected at startup.

```bash
# Start a local single-node replica set
mkdir -p ./data
mongod --replSet rs0 --dbpath ./data --port 27017

# In another terminal, initialize it once
mongosh --eval 'rs.initiate()'

cp .env.example .env
# Set long, private JWT secrets in .env
npm install
npm run migrate:legacy-users   # only if this database has pre-existing starter users
npm run dev
```

The legacy-user migration assigns `CUSTOMER`/`ACTIVE` only where role/status are missing. Review and manually assign any Admin roles; it does not promote users to Admin.

## Counter audit

```bash
npm run recount:counters
npm run recount:counters:apply
npm run recount:counters
```

The first command reports drift without changing data. The second repairs the three counters. The final command verifies the repaired state. The check-only command exits with code 2 when drift exists.

## Important scope note

The uploaded starter is a generic S7C teaching scaffold. It did not contain the approved Nova Retail coupon, customer-coupon usage, redemption models, or the Phase 3 redemption service. This delivery adds the Phase 3 redemption core while retaining the starter's existing project structure. The full SRS authentication/session implementation and Phase 2 Admin coupon/user management remain separate prerequisite work; the starter's legacy login is not a substitute for the complete approved authentication design.
