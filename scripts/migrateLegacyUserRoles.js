import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import User from "../models/userModel.js";

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);
  const result = await User.updateMany(
    { $or: [{ role: { $exists: false } }, { status: { $exists: false } }] },
    [
      { $set: {
        role: { $ifNull: ["$role", "CUSTOMER"] },
        status: { $ifNull: ["$status", "ACTIVE"] },
      } },
    ]
  );
  console.log(JSON.stringify({ matched: result.matchedCount, modified: result.modifiedCount }));
};

main()
  .catch((error) => {
    console.error("Legacy user migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
