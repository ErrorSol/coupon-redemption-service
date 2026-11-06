import mongoose from "mongoose";

const { Schema, model } = mongoose;

const refreshTokenSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sessionId: { type: String, required: true },
    token: { type: String, unique: true, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Compound index to ensure unique combination of userId and sessionId
refreshTokenSchema.index({ userId: 1, sessionId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = model("RefreshToken", refreshTokenSchema);
export default RefreshToken;
