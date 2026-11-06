import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Coupon from "../models/couponModel.js";
import CustomerCouponUsage from "../models/customerCouponUsageModel.js";
import Redemption from "../models/redemptionModel.js";
import User from "../models/userModel.js";
import Counter from "../models/counterModel.js";

const apply = process.argv.includes("--apply");
const same = (a, b) => Number(a || 0) === Number(b || 0);

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);
  const session = await mongoose.startSession();
  let report;

  try {
    await session.withTransaction(async () => {
      // Snapshot reads ensure all three expected values are derived from one DB view.
      const couponRows = await Redemption.aggregate([
        { $match: { status: "SUCCESSFUL" } },
        { $group: { _id: "$couponId", count: { $sum: 1 } } },
      ]).session(session);

      const usageRows = await Redemption.aggregate([
        { $match: { status: "SUCCESSFUL" } },
        { $group: { _id: { couponId: "$couponId", customerId: "$customerId" }, count: { $sum: 1 } } },
      ]).session(session);

      const activeAdmins = await User.countDocuments({
        role: "ADMIN", status: "ACTIVE",
      }).session(session);

      const coupons = await Coupon.find({}, { _id: 1, usedCount: 1 }).session(session).lean();
      const usageDocs = await CustomerCouponUsage.find(
        {}, { _id: 1, couponId: 1, customerId: 1, usedCount: 1 }
      ).session(session).lean();
      const adminCounter = await Counter.findById("activeAdminCount").session(session).lean();

      const couponExpected = new Map(couponRows.map((x) => [String(x._id), x.count]));
      const usageExpected = new Map(usageRows.map((x) => [`${x._id.couponId}:${x._id.customerId}`, x.count]));

      const couponDrift = coupons
        .map((c) => ({ id: String(c._id), actual: c.usedCount, expected: couponExpected.get(String(c._id)) || 0 }))
        .filter((x) => !same(x.actual, x.expected));

      const usageDrift = usageDocs
        .map((u) => {
          const key = `${u.couponId}:${u.customerId}`;
          return {
            id: String(u._id), couponId: String(u.couponId), customerId: String(u.customerId),
            actual: u.usedCount, expected: usageExpected.get(key) || 0,
          };
        })
        .filter((x) => !same(x.actual, x.expected));

      const existingUsageKeys = new Set(usageDocs.map((u) => `${u.couponId}:${u.customerId}`));
      const missingUsageDocs = [...usageExpected.entries()]
        .filter(([key]) => !existingUsageKeys.has(key))
        .map(([key, expected]) => ({ key, actual: null, expected }));

      const adminActual = adminCounter?.value ?? null;
      const adminDrift = !adminCounter || !same(adminActual, activeAdmins);

      report = {
        mode: apply ? "APPLY" : "CHECK_ONLY",
        readConsistency: "single MongoDB snapshot transaction",
        sourceOfTruth: "SUCCESSFUL redemption records; active users with role ADMIN",
        totals: {
          couponsChecked: coupons.length,
          customerCouponUsageDocsChecked: usageDocs.length,
          activeAdmins,
        },
        drift: {
          couponsUsedCount: couponDrift,
          customerCouponUsageUsedCount: usageDrift,
          missingCustomerCouponUsageDocs: missingUsageDocs,
          countersActiveAdminCount: {
            actual: adminActual, expected: activeAdmins, mismatch: adminDrift,
          },
        },
        applied: false,
      };

      const hasDrift = couponDrift.length || usageDrift.length ||
        missingUsageDocs.length || adminDrift;

      if (apply) {
        await Coupon.updateMany({}, { $set: { usedCount: 0 } }, { session });
        if (couponRows.length) {
          await Coupon.bulkWrite(couponRows.map((x) => ({
            updateOne: {
              filter: { _id: x._id },
              update: { $set: { usedCount: x.count } },
            },
          })), { session });
        }

        // Zero all existing rows first so stale/orphaned pairs are corrected as well.
        await CustomerCouponUsage.updateMany({}, { $set: { usedCount: 0 } }, { session });
        if (usageRows.length) {
          await CustomerCouponUsage.bulkWrite(usageRows.map((x) => ({
            updateOne: {
              filter: { couponId: x._id.couponId, customerId: x._id.customerId },
              update: { $set: { usedCount: x.count } },
              upsert: true,
            },
          })), { session });
        }

        await Counter.updateOne(
          { _id: "activeAdminCount" },
          { $set: { value: activeAdmins } },
          { upsert: true, session }
        );
        report.applied = true;
      } else if (hasDrift) {
        report.hasDrift = true;
      }
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    });
  } finally {
    await session.endSession();
  }

  console.log(JSON.stringify(report, null, 2));
  const hasDrift = report?.hasDrift ||
    report?.drift?.couponsUsedCount?.length ||
    report?.drift?.customerCouponUsageUsedCount?.length ||
    report?.drift?.missingCustomerCouponUsageDocs?.length ||
    report?.drift?.countersActiveAdminCount?.mismatch;

  if (!apply && hasDrift) process.exitCode = 2;
};

main()
  .catch((error) => {
    console.error("Counter recount failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
