import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./config/config.js";
import Coupon from "./models/couponModel.js";
import CustomerCouponUsage from "./models/customerCouponUsageModel.js";
import Redemption from "./models/redemptionModel.js";
import User from "./models/userModel.js";
import Counter from "./models/counterModel.js";

const PORT = process.env.PORT || 4000;

const start = async () => {
  await connectDB();

  // Ensure unique indexes exist before the API accepts concurrent requests.
  await Promise.all([
    User.init(),
    Coupon.init(),
    CustomerCouponUsage.init(),
    Redemption.init(),
    Counter.init(),
  ]);

  // Gate-D guard document must exist before any Admin management transactions run.
  const activeAdmins = await User.countDocuments({ role: "ADMIN", status: "ACTIVE" });
  await Counter.updateOne(
    { _id: "activeAdminCount" },
    { $setOnInsert: { value: activeAdmins } },
    { upsert: true }
  );

  const server = app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

start().catch(async (error) => {
  console.error("Application startup failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
