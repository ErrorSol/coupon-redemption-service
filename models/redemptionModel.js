import mongoose from "mongoose";

const redemptionSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true, immutable: true },
  couponCode: { type: String, required: true, uppercase: true, immutable: true },
  orderId: { type: String, required: true, trim: true, minlength: 1, maxlength: 64, immutable: true },
  orderAmountPaise: { type: Number, required: true, min: 1, max: 100_000_000, validate: Number.isSafeInteger, immutable: true },
  discountPaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, immutable: true },
  finalAmountPaise: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, immutable: true },
  status: { type: String, enum: ["SUCCESSFUL", "REVERSED"], default: "SUCCESSFUL" },
  idempotencyKey: { type: String, required: true, lowercase: true, immutable: true },
  reversedAt: { type: Date, default: null },
  reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reversalReason: { type: String, maxlength: 200, default: null },
}, { timestamps: true, versionKey: false });

redemptionSchema.pre("validate", function () {
  if (this.finalAmountPaise !== this.orderAmountPaise - this.discountPaise) {
    this.invalidate("finalAmountPaise", "finalAmountPaise must equal orderAmountPaise - discountPaise");
  }
  if (this.discountPaise > this.orderAmountPaise) {
    this.invalidate("discountPaise", "Discount cannot exceed the order amount");
  }
});

redemptionSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true, name: "uniq_customer_idempotency" });
redemptionSchema.index(
  { customerId: 1, orderId: 1 },
  { unique: true, partialFilterExpression: { status: "SUCCESSFUL" }, name: "uniq_active_customer_order" }
);
redemptionSchema.index({ customerId: 1, createdAt: -1, _id: -1 });
redemptionSchema.index({ couponCode: 1, createdAt: -1, _id: -1 });
redemptionSchema.index({ orderId: 1, createdAt: -1, _id: -1 });
redemptionSchema.index({ createdAt: -1, _id: -1 });

export default mongoose.models.Redemption || mongoose.model("Redemption", redemptionSchema);
