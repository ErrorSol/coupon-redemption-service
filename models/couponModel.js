import mongoose from "mongoose";

export const COUPON_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  DELETED: "DELETED",
});

const couponSchema = new mongoose.Schema({
  code: {
    type: String, required: true, trim: true, uppercase: true,
    match: /^[A-Z0-9_-]{3,20}$/,
  },
  discountType: { type: String, enum: ["PERCENTAGE", "FIXED"], required: true },
  // PERCENTAGE is an integer 1–99; FIXED is an integer number of paise.
  discountValue: { type: Number, required: true, validate: Number.isSafeInteger },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  totalLimit: { type: Number, required: true, min: 1, max: 1_000_000, validate: Number.isSafeInteger },
  perCustomerLimit: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  usedCount: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  status: { type: String, enum: Object.values(COUPON_STATUS), default: COUPON_STATUS.DRAFT },
  deletedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true, versionKey: false });

couponSchema.pre("validate", function () {
  this.code = this.code?.trim().toUpperCase();
  if (this.endsAt && this.startsAt && this.endsAt <= this.startsAt) {
    this.invalidate("endsAt", "endsAt must be later than startsAt");
  }
  if (this.perCustomerLimit > this.totalLimit) {
    this.invalidate("perCustomerLimit", "perCustomerLimit cannot exceed totalLimit");
  }
  if (this.discountType === "PERCENTAGE" && (!Number.isInteger(this.discountValue) || this.discountValue < 1 || this.discountValue > 99)) {
    this.invalidate("discountValue", "Percentage discount must be an integer from 1 to 99");
  }
  if (this.discountType === "FIXED" && (!Number.isSafeInteger(this.discountValue) || this.discountValue < 1 || this.discountValue > 10_000_000)) {
    this.invalidate("discountValue", "Fixed discount must be integer paise from 1 to 10000000");
  }
});

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.methods.effectiveStatus = function (now = new Date()) {
  if ([COUPON_STATUS.ACTIVE, COUPON_STATUS.PAUSED].includes(this.status) && now >= this.endsAt) return "EXPIRED";
  return this.status;
};
couponSchema.methods.isRedeemableAt = function (now = new Date()) {
  return this.status === COUPON_STATUS.ACTIVE && this.startsAt <= now && now < this.endsAt;
};

export default mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);
