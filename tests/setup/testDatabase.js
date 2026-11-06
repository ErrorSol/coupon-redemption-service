
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let mongoReplicaSet;

export const startTestDatabase = async () => {
  mongoReplicaSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  const mongoUri = mongoReplicaSet.getUri();

  await mongoose.connect(mongoUri);

  // Initialize indexes for all models registered by the application.
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.init())
  );

  console.log("Test MongoDB replica set connected");
};

export const clearTestDatabase = async () => {
  const collections = mongoose.connection.collections;

  await Promise.all(
    Object.values(collections).map((collection) =>
      collection.deleteMany({})
    )
  );
};

export const stopTestDatabase = async () => {
  await mongoose.disconnect();

  if (mongoReplicaSet) {
    await mongoReplicaSet.stop();
    mongoReplicaSet = null;
  }
};
