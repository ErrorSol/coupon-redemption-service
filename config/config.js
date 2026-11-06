import mongoose from "mongoose";

export const connectDB = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName) {
    await mongoose.disconnect();
    throw new Error("MongoDB replica set is required for redemption transactions (expected rs0)");
  }
  console.log(`MongoDB connected to replica set ${hello.setName}`);
};
