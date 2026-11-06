import { jest } from "@jest/globals";

jest.unstable_mockModule("../../config/lokiLogger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const lokiLogger = (await import("../../config/lokiLogger.js")).default;
const Logger = (await import("../../utils/logger.js")).default;

describe("Logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LOKI_APP_NAME = "test-app";
    process.env.LOKI_DASHBOARD = "test-dash";
  });

  it.each(["info", "warn", "error"])(
    "should forward a %s log to the loki transport with enriched labels",
    (level) => {
      Logger.log(level, "hello", { requestId: "r1" });

      expect(lokiLogger[level]).toHaveBeenCalledWith({
        message: "hello",
        labels: {
          requestId: "r1",
          appName: "test-app",
          dashboard: "test-dash",
        },
      });
    }
  );

  it("should warn (and not throw) on an invalid log level", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    Logger.log("trace", "nope");

    expect(warnSpy).toHaveBeenCalledWith("Invalid log level provided");
    expect(lokiLogger.info).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
