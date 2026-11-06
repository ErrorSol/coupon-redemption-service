import lokiLogger from "../config/lokiLogger.js";

class Logger {
  /**
   * Log messages based on the level
   * @param {string} level - The log level (info, warn, error)
   * @param {string} message - The log message
   * @param {object} labels - Additional labels for Loki
   */
  static log(level, message, labels = {}) {
    const logPayload = {
      message,
      labels: {
        ...labels,
        appName: process.env.LOKI_APP_NAME,
        dashboard: process.env.LOKI_DASHBOARD,
      },
    };

    switch (level) {
      case "info":
        lokiLogger.info(logPayload);
        break;
      case "warn":
        lokiLogger.warn(logPayload);
        break;
      case "error":
        lokiLogger.error(logPayload);
        break;
      default:
        console.warn("Invalid log level provided");
    }
  }
}

export default Logger;
