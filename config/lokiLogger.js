import dotenv from "dotenv";
dotenv.config();
import { createLogger, format, transports } from "winston";
import LokiTransport from "winston-loki";

// Ship logs to Grafana Loki when LOKI_HOST is configured; otherwise fall back to
// a plain console transport so the app runs cleanly in local dev without a Loki
// instance (no connection-refused spam, no crash on startup).
const logTransports = [];

if (process.env.LOKI_HOST) {
  logTransports.push(
    new LokiTransport({
      host: process.env.LOKI_HOST,
      labels: {
        appName: process.env.LOKI_APP_NAME,
        dashboard: process.env.LOKI_DASHBOARD,
      },
      json: true,
      format: format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) =>
        console.error(`Loki connection error: ${err.message}`),
    })
  );
} else {
  logTransports.push(
    new transports.Console({
      format: format.combine(format.timestamp(), format.simple()),
    })
  );
}

const lokiLogger = createLogger({ transports: logTransports });

export default lokiLogger;
