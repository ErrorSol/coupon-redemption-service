import mongoose from "mongoose";

const customerCouponUsageSchema = new mongoose.Schema({
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  usedCount: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
}, { timestamps: true, versionKey: false });

customerCouponUsageSchema.index({ couponId: 1, customerId: 1 }, { unique: true });
export default mongoose.models.CustomerCouponUsage ||
  mongoose.model("CustomerCouponUsage", customerCouponUsageSchema);
