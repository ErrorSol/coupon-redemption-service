import Coupon from "../models/couponModel.js";
import CustomerCouponUsage from "../models/customerCouponUsageModel.js";
import Redemption from "../models/redemptionModel.js";
import AppError from "../middlewares/appError.js";
import { calculateDiscountPaise } from "../utils/money.js";
import { runTransaction } from "../utils/tx.js";

const appError = (code, message, statusCode, details) =>
  new AppError(message, statusCode, { code, details });

const customerIdString = (id) => String(id);
const isDuplicateKey = (error) => error?.code === 11000 || error?.codeName === "DuplicateKey";

const toView = (r) => ({
  redemptionId: String(r._id),
  couponCode: r.couponCode,
  orderId: r.orderId,
  orderAmountPaise: r.orderAmountPaise,
  discountPaise: r.discountPaise,
  finalAmountPaise: r.finalAmountPaise,
  status: r.status,
  createdAt: r.createdAt,
});

const resolveExisting = async ({ customerId, idempotencyKey, couponCode, orderId, orderAmountPaise }) => {
  const byKey = await Redemption.findOne({ customerId, idempotencyKey });
  if (byKey) {
    const samePayload =
      byKey.couponCode === couponCode &&
      byKey.orderId === orderId &&
      byKey.orderAmountPaise === orderAmountPaise;
    if (!samePayload) {
      throw appError("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used with a different payload", 422);
    }
    if (byKey.status === "REVERSED") {
      throw appError("REDEMPTION_REVERSED", "This redemption was reversed; no discount applies", 409, {
        redemptionId: String(byKey._id), status: "REVERSED",
        discountPaise: 0, finalAmountPaise: byKey.orderAmountPaise,
      });
    }
    return { replay: true, data: toView(byKey) };
  }

  const active = await Redemption.findOne({ customerId, orderId, status: "SUCCESSFUL" });
  if (active) {
    if (active.couponCode === couponCode) return { replay: true, data: toView(active) };
    throw appError("ORDER_ALREADY_HAS_COUPON", "This order already has an active coupon redemption", 409);
  }
  return null;
};

const assertCouponCanRedeem = (coupon, now) => {
  if (coupon.status !== "ACTIVE") {
    throw appError("COUPON_NOT_REDEEMABLE", "Coupon is not currently redeemable", 422, { reason: coupon.status });
  }
  if (now < coupon.startsAt) {
    throw appError("COUPON_NOT_REDEEMABLE", "Coupon validity has not started", 422, { reason: "NOT_STARTED" });
  }
  if (now >= coupon.endsAt) {
    throw appError("COUPON_NOT_REDEEMABLE", "Coupon has expired", 422, { reason: "EXPIRED" });
  }
};

const classifyReservationFailure = async (couponId, now) => {
  const current = await Coupon.findById(couponId);
  if (!current) throw appError("COUPON_NOT_FOUND", "Coupon not found", 404);
  assertCouponCanRedeem(current, now);
  if (current.usedCount >= current.totalLimit) {
    throw appError("TOTAL_LIMIT_REACHED", "Coupon has reached its total redemption limit", 409);
  }
  throw appError("RETRYABLE_ERROR", "Coupon state changed while redeeming; retry with the same key", 503);
};

export const redeemCoupon = async ({ customerId, payload, idempotencyKey, now = new Date() }) => {
  const normalized = {
    couponCode: payload.couponCode.trim().toUpperCase(),
    orderId: payload.orderId.trim(),
    orderAmountPaise: payload.orderAmountPaise,
  };
  const existing = await resolveExisting({
    customerId, idempotencyKey, ...normalized,
  });
  if (existing) return { ...existing, statusCode: 200 };

  const coupon = await Coupon.findOne({ code: normalized.couponCode });
  if (!coupon) throw appError("COUPON_NOT_FOUND", "Coupon not found", 404);
  assertCouponCanRedeem(coupon, now);

  const discountPaise = calculateDiscountPaise(
    coupon.discountType, coupon.discountValue, normalized.orderAmountPaise
  );
  if (discountPaise > normalized.orderAmountPaise) {
    throw appError("DISCOUNT_EXCEEDS_ORDER_AMOUNT", "Discount cannot exceed the order amount", 422);
  }

  try {
    const redemption = await runTransaction(async (session) => {
      const [created] = await Redemption.create([{
        customerId,
        couponId: coupon._id,
        couponCode: coupon.code,
        orderId: normalized.orderId,
        orderAmountPaise: normalized.orderAmountPaise,
        discountPaise,
        finalAmountPaise: normalized.orderAmountPaise - discountPaise,
        idempotencyKey,
      }], { session });

      const couponReservation = await Coupon.updateOne({
        _id: coupon._id,
        status: "ACTIVE",
        startsAt: { $lte: now },
        endsAt: { $gt: now },
        $expr: { $lt: ["$usedCount", "$totalLimit"] },
      }, { $inc: { usedCount: 1 } }, { session });

      if (couponReservation.modifiedCount !== 1) {
        const error = new Error("Coupon reservation did not match");
        error.code = "COUPON_RESERVATION_FAILED";
        throw error;
      }

      await CustomerCouponUsage.findOneAndUpdate(
        {
          couponId: coupon._id,
          customerId,
          usedCount: { $lt: coupon.perCustomerLimit },
        },
        { $inc: { usedCount: 1 } },
        { upsert: true, new: true, session, setDefaultsOnInsert: true }
      );

      return created;
    });

    return { replay: false, statusCode: 201, data: toView(redemption) };
  } catch (error) {
    if (error.code === "COUPON_RESERVATION_FAILED") {
      return classifyReservationFailure(coupon._id, now);
    }
    if (isDuplicateKey(error)) {
      // The insert-first transaction rolls back before resolving the winner.
      const winner = await resolveExisting({
        customerId, idempotencyKey, ...normalized,
      });
      if (winner) return { ...winner, statusCode: 200 };
      if (error.keyPattern?.couponId && error.keyPattern?.customerId) {
        throw appError("CUSTOMER_LIMIT_REACHED", "You have reached this coupon's per-customer limit", 409);
      }
      throw appError("RETRYABLE_ERROR", "Redemption could not be confirmed; retry with the same key", 503);
    }
    throw error;
  }
};

export const listCustomerRedemptions = async ({ customerId, page = 1, pageSize = 20 }) => {
  const filter = { customerId };
  const [items, total] = await Promise.all([
    Redemption.find(filter).sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize).limit(pageSize).lean(),
    Redemption.countDocuments(filter),
  ]);
  return {
    items: items.map((r) => ({
      redemptionId: String(r._id),
      couponCode: r.couponCode,
      orderId: r.orderId,
      createdAt: r.createdAt,
      discountPaise: r.status === "REVERSED" ? 0 : r.discountPaise,
      finalAmountPaise: r.status === "REVERSED" ? r.orderAmountPaise : r.finalAmountPaise,
      status: r.status,
      reversedAt: r.reversedAt,
    })),
    page, pageSize, total,
  };
};
