import { allowedOrigins } from "./constants.js";

export const corsOptions = {
  origin: function (origin, callback) {
    // Get allowed origins based on environment
    const allowedEnvOrigins =
      allowedOrigins[process.env.NODE_ENV || "development"];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedEnvOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.error(`blocked origin is ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    // "X-Requested-With",
    // "Accept",
    // "Origin",
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range", "Content-Disposition"],
  // maxAge: 86400, // 24 hours
};
