import mongoose from "mongoose";
import AppError from "../middlewares/appError.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hasLabel = (error, label) =>
  typeof error?.hasErrorLabel === "function"
    ? error.hasErrorLabel(label)
    : (error?.errorLabels || []).includes(label);

export const runTransaction = async (fn, { deadlineMs = 5000 } = {}) => {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction({
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        readPreference: "primary",
        maxCommitTimeMS: Math.max(1, deadline - Date.now()),
      });
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      try { if (session.inTransaction()) await session.abortTransaction(); } catch { /* ignore abort failure */ }
      if (hasLabel(error, "TransientTransactionError") && Date.now() < deadline) {
        await sleep(5 + Math.floor(Math.random() * 20));
        continue;
      }
      if (hasLabel(error, "TransientTransactionError") || hasLabel(error, "UnknownTransactionCommitResult")) {
        throw new AppError("The transaction outcome could not be confirmed; retry with the same key", 503, {
          code: "RETRYABLE_ERROR",
        });
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }
  throw new AppError("Transaction deadline exceeded; retry with the same key", 503, {
    code: "RETRYABLE_ERROR",
  });
};
