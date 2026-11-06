import { jest } from "@jest/globals";

jest.unstable_mockModule("node-cron", () => ({
  default: { schedule: jest.fn() },
}));

const cron = (await import("node-cron")).default;
const { initializeCrons } = await import("../../services/cronService.js");

describe("cronService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should schedule the configured cron jobs on initialize", () => {
    initializeCrons();

    expect(cron.schedule).toHaveBeenCalledTimes(2);
    const expressions = cron.schedule.mock.calls.map((call) => call[0]);
    expect(expressions).toEqual(
      expect.arrayContaining(["0 * * * *", "0 0 * * *"])
    );
  });
});
