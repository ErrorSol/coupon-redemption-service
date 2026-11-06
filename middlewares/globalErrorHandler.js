import AppError from "./appError.js";
import Logger from "../utils/logger.js";

const sendError = (error, res) => {
  if (!(error instanceof AppError)) {
    console.log(error);
  }
  let errors = [];
  let statusCode = error.statusCode || 500;
  let status = error.status || "error";
  let responseCode = error.responseCode !== undefined ? error.responseCode : 1;

  if (error.name === "ValidationError" && error.details) {
    errors = error.details.map((err) => ({
      field: err.path.join("."),
      message: err.message.replace(/"([^"]+)"/g, '$1'),
    }));
    statusCode = 400;
    status = "fail";
  } else if (error.name === "ValidationError" && error.errors) {
    errors = Object.values(error.errors).map((err) => ({
      field: err.path,
      message: err.message,
    }));
    statusCode = 400;
    status = "fail";
  } else if (error.code === 11000 || error.codeName === "DuplicateKey") {
    errors = [
      {
        field: Object.keys(error.keyValue).join(", "),
        message: `Already exists with this ${Object.entries(error.keyValue)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ")}`,
      },
    ];
    statusCode = 400;
    status = "fail";
  } else if (error.errors && Array.isArray(error.errors)) {
    errors = error.errors;
  } else {
    errors = [
      {
        field: error.field || null,
        message: error.message || "Something went wrong, Internal Server Error",
      },
    ];
  }

  // Route errors to structured logging (Loki in prod, console in local dev).
  // 5xx = unexpected server faults ("error"); 4xx = client faults ("warn").
  Logger.log(statusCode >= 500 ? "error" : "warn", error.message, {
    statusCode: `${statusCode}`,
    name: error.name || "Error",
  });

  res.status(statusCode).json({
    responseCode,
    status,
    statusCode,
    errors,
    stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
  });
};

export default (error, req, res, next) => {
  if (error.isJoi && error.details) {
    error.name = "ValidationError";
  }
  // console.error(error);
  error.statusCode = error.statusCode || 500;
  error.status = error.status || "error";
  error.message =
    error.message || "Something went wrong, Internal Server Error";
  error.field = error.field || null;
  sendError(error, res);
};
