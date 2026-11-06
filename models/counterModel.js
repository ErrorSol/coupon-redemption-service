import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
}, { versionKey: false });

export default mongoose.models.Counter || mongoose.model("Counter", counterSchema);
