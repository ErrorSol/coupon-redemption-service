import AppError from "./appError.js";

const buckets = new Map();
export const redemptionRateLimit = (limit = 20, windowMs = 60_000) => (req, res, next) => {
  const key = String(req.auth?.userId || req.user?.id || "anonymous");
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    bucket = { startedAt: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
  if (bucket.count > limit) {
    res.setHeader("Retry-After", String(Math.ceil((windowMs - (now - bucket.startedAt)) / 1000)));
    return next(new AppError("Too many redemption requests", 429, { code: "RATE_LIMITED" }));
  }
  next();
};
