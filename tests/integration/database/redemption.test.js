
import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

import mongoose from "mongoose";
import app from "../../../app.js";

import User from "../../../models/userModel.js";
import RefreshToken from "../../../models/refreshTokenModel.js";
import Coupon from "../../../models/couponModel.js";
import Redemption from "../../../models/redemptionModel.js";
import CustomerCouponUsage from "../../../models/customerCouponUsageModel.js";

import {
  startTestDatabase,
  clearTestDatabase,
  stopTestDatabase,
} from "../../setup/testDatabase.js";

process.env.JWT_ACCESS_SECRET = "integration-test-access-secret";
process.env.JWT_REFRESH_SECRET = "integration-test-refresh-secret";

jest.setTimeout(60000);

describe("Real MongoDB redemption integration", () => {
  let customer;
  let coupon;
  let accessToken;

  const sessionId = "integration-test-session";

  beforeAll(async () => {
    await startTestDatabase();

    // Ensure all indexes exist before testing.
    await Promise.all([
      User.init(),
      RefreshToken.init(),
      Coupon.init(),
      Redemption.init(),
      CustomerCouponUsage.init(),
    ]);
  });

  beforeEach(async () => {
    await clearTestDatabase();

    // 1. Create a real customer.
    customer = await User.create({
      name: "Integration Customer",
      email: "integration@example.com",
      phone: "9876543210",
      password: "TestPassword123",
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    // 2. Create a valid database session.
    await RefreshToken.create({
      userId: customer._id,
      sessionId,
      token: "integration-test-refresh-token",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    // 3. Generate an access token containing the required claims.
    accessToken = jwt.sign(
      {
        id: String(customer._id),
        sessionId,
      },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    // 4. Create a real active coupon.
    coupon = await Coupon.create({
      code: "TEST10",
      discountType: "PERCENTAGE",
      discountValue: 10,
      startsAt: new Date(Date.now() - 60 * 1000),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      totalLimit: 5,
      perCustomerLimit: 2,
      status: "ACTIVE",
      createdBy: customer._id,
      updatedBy: customer._id,
    });
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  test("customer successfully redeems a coupon and MongoDB counters update", async () => {
    const idempotencyKey = "550e8400-e29b-41d4-a716-446655440000";

    // Send a real HTTP request through Express.
    const response = await request(app)
      .post("/api/customer/redemptions")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        couponCode: "TEST10",
        orderId: "ORDER-1001",
        orderAmountPaise: 10000,
      });

    // Verify HTTP response.
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      couponCode: "TEST10",
      orderId: "ORDER-1001",
      orderAmountPaise: 10000,
      discountPaise: 1000,
      finalAmountPaise: 9000,
      status: "SUCCESSFUL",
    });

    // Verify the actual redemption document.
    const redemption = await Redemption.findOne({
      customerId: customer._id,
      idempotencyKey,
    });

    expect(redemption).not.toBeNull();
    expect(redemption.status).toBe("SUCCESSFUL");

    // Verify the global coupon counter.
    const updatedCoupon = await Coupon.findById(coupon._id);

    expect(updatedCoupon.usedCount).toBe(1);

    // Verify the customer's coupon usage counter.
    const usage = await CustomerCouponUsage.findOne({
      couponId: coupon._id,
      customerId: customer._id,
    });

    expect(usage).not.toBeNull();
    expect(usage.usedCount).toBe(1);

    // Verify exactly one redemption exists.
    const redemptionCount = await Redemption.countDocuments({
      customerId: customer._id,
    });

    expect(redemptionCount).toBe(1);
  });


test("replaying the same request does not create another redemption", async () => {
  const idempotencyKey = "550e8400-e29b-41d4-a716-446655440001";

  const payload = {
    couponCode: "TEST10",
    orderId: "ORDER-2001",
    orderAmountPaise: 10000,
  };

  const firstResponse = await request(app)
    .post("/api/customer/redemptions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", idempotencyKey)
    .send(payload);

  const secondResponse = await request(app)
    .post("/api/customer/redemptions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", idempotencyKey)
    .send(payload);

  expect(firstResponse.status).toBe(201);
  expect(secondResponse.status).toBe(200);
  expect(secondResponse.headers["idempotent-replay"]).toBe("true");

  expect(
    await Redemption.countDocuments({ customerId: customer._id })
  ).toBe(1);

  const updatedCoupon = await Coupon.findById(coupon._id);
  expect(updatedCoupon.usedCount).toBe(1);

  const usage = await CustomerCouponUsage.findOne({
    couponId: coupon._id,
    customerId: customer._id,
  });

  expect(usage.usedCount).toBe(1);
});

test("rejects reuse of an idempotency key with a different payload", async () => {
  const idempotencyKey = "550e8400-e29b-41d4-a716-446655440002";

  const firstResponse = await request(app)
    .post("/api/customer/redemptions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", idempotencyKey)
    .send({
      couponCode: "TEST10",
      orderId: "ORDER-3001",
      orderAmountPaise: 10000,
    });

  const secondResponse = await request(app)
    .post("/api/customer/redemptions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Idempotency-Key", idempotencyKey)
    .send({
      couponCode: "TEST10",
      orderId: "ORDER-3002",
      orderAmountPaise: 10000,
    });

  expect(firstResponse.status).toBe(201);
  expect(secondResponse.status).toBe(422);
  expect(secondResponse.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");

  expect(
    await Redemption.countDocuments({ customerId: customer._id })
  ).toBe(1);

  const updatedCoupon = await Coupon.findById(coupon._id);
  expect(updatedCoupon.usedCount).toBe(1);
});

test("customer cannot exceed the per-customer redemption limit", async () => {
  const redeem = (orderId, idempotencyKey) =>
    request(app)
      .post("/api/customer/redemptions")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({
        couponCode: "TEST10",
        orderId,
        orderAmountPaise: 10000,
      });

  // First redemption
  const firstResponse = await redeem(
    "ORDER-LIMIT-1",
    "550e8400-e29b-41d4-a716-446655440003"
  );

  // Second redemption
  const secondResponse = await redeem(
    "ORDER-LIMIT-2",
    "550e8400-e29b-41d4-a716-446655440004"
  );

  // Third redemption should be rejected.
  const thirdResponse = await redeem(
    "ORDER-LIMIT-3",
    "550e8400-e29b-41d4-a716-446655440005"
  );

  expect(firstResponse.status).toBe(201);
  expect(secondResponse.status).toBe(201);

  expect(thirdResponse.status).toBe(409);
  expect(thirdResponse.body.error.code).toBe("CUSTOMER_LIMIT_REACHED");

  // Exactly two successful redemptions should exist.
  const redemptionCount = await Redemption.countDocuments({
    customerId: customer._id,
  });

  expect(redemptionCount).toBe(2);

  // Global coupon counter should be exactly two.
  const updatedCoupon = await Coupon.findById(coupon._id);
  expect(updatedCoupon.usedCount).toBe(2);

  // Customer usage counter should also be exactly two.
  const usage = await CustomerCouponUsage.findOne({
    couponId: coupon._id,
    customerId: customer._id,
  });

  expect(usage.usedCount).toBe(2);
});

test("different customers cannot exceed the global coupon limit", async () => {
  // Set the global coupon limit to one.
  await Coupon.updateOne(
    { _id: coupon._id },
    {
      $set: {
        totalLimit: 1,
        perCustomerLimit: 1,
      },
    }
  );

  // Create a second customer.
  const secondCustomer = await User.create({
    name: "Second Integration Customer",
    email: "second.integration@example.com",
    phone: "9876543211",
    password: "TestPassword123",
    role: "CUSTOMER",
    status: "ACTIVE",
  });

  const secondSessionId = "second-integration-session";

  await RefreshToken.create({
    userId: secondCustomer._id,
    sessionId: secondSessionId,
    token: "second-integration-refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const secondAccessToken = jwt.sign(
    {
      id: String(secondCustomer._id),
      sessionId: secondSessionId,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );

  // First customer consumes the only available redemption.
  const firstResponse = await request(app)
    .post("/api/customer/redemptions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set(
      "Idempotency-Key",
      "550e8400-e29b-41d4-a716-446655440006"
    )
    .send({
      couponCode: "TEST10",
      orderId: "GLOBAL-ORDER-1",
      orderAmountPaise: 10000,
    });

  // Second customer tries to redeem the same coupon.
  const secondResponse = await request(app)
    .post("/api/customer/redemptions")
    .set("Authorization", `Bearer ${secondAccessToken}`)
    .set(
      "Idempotency-Key",
      "550e8400-e29b-41d4-a716-446655440007"
    )
    .send({
      couponCode: "TEST10",
      orderId: "GLOBAL-ORDER-2",
      orderAmountPaise: 10000,
    });

  expect(firstResponse.status).toBe(201);

  expect(secondResponse.status).toBe(409);
  expect(secondResponse.body.error.code).toBe("TOTAL_LIMIT_REACHED");

  // Only one redemption should exist globally.
  expect(await Redemption.countDocuments({ couponId: coupon._id })).toBe(1);

  // Global counter must remain one.
  const updatedCoupon = await Coupon.findById(coupon._id);
  expect(updatedCoupon.usedCount).toBe(1);

  // Second customer's failed attempt must not create usage.
  const secondUsage = await CustomerCouponUsage.findOne({
    couponId: coupon._id,
    customerId: secondCustomer._id,
  });

  expect(secondUsage).toBeNull();
});

test("only one customer can claim the final coupon under concurrent requests", async () => {
  // Only one redemption is available globally.
  await Coupon.updateOne(
    { _id: coupon._id },
    {
      $set: {
        totalLimit: 1,
        perCustomerLimit: 1,
      },
    }
  );

  // Create a second customer with a valid session.
  const secondCustomer = await User.create({
    name: "Concurrent Customer",
    email: "concurrent@example.com",
    phone: "9876543212",
    password: "TestPassword123",
    role: "CUSTOMER",
    status: "ACTIVE",
  });

  const secondSessionId = "concurrent-test-session";

  await RefreshToken.create({
    userId: secondCustomer._id,
    sessionId: secondSessionId,
    token: "concurrent-test-refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const secondAccessToken = jwt.sign(
    {
      id: String(secondCustomer._id),
      sessionId: secondSessionId,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );

  // Prepare two independent redemption requests.
  const firstRequest = request(app)
    .post("/api/customer/redemptions")
    .set("Authorization", `Bearer ${accessToken}`)
    .set(
      "Idempotency-Key",
      "550e8400-e29b-41d4-a716-446655440008"
    )
    .send({
      couponCode: "TEST10",
      orderId: "CONCURRENT-ORDER-1",
      orderAmountPaise: 10000,
    });

  const secondRequest = request(app)
    .post("/api/customer/redemptions")
    .set("Authorization", `Bearer ${secondAccessToken}`)
    .set(
      "Idempotency-Key",
      "550e8400-e29b-41d4-a716-446655440009"
    )
    .send({
      couponCode: "TEST10",
      orderId: "CONCURRENT-ORDER-2",
      orderAmountPaise: 10000,
    });

  // Execute both HTTP requests concurrently.
  const [firstResponse, secondResponse] = await Promise.all([
    firstRequest,
    secondRequest,
  ]);

  const statuses = [
    firstResponse.status,
    secondResponse.status,
  ].sort((a, b) => a - b);

  // Exactly one request succeeds and one is rejected.
  expect(statuses).toEqual([201, 409]);

  const successfulCount = await Redemption.countDocuments({
    couponId: coupon._id,
    status: "SUCCESSFUL",
  });

  expect(successfulCount).toBe(1);

  // Global coupon counter must never exceed one.
  const updatedCoupon = await Coupon.findById(coupon._id);
  expect(updatedCoupon.usedCount).toBe(1);

  // Only one customer's usage counter should be created.
  const usages = await CustomerCouponUsage.find({
    couponId: coupon._id,
  });

  expect(usages).toHaveLength(1);
  expect(usages[0].usedCount).toBe(1);
});

test("concurrent identical requests create only one redemption", async () => {
  const idempotencyKey = "550e8400-e29b-41d4-a716-446655440010";

  const payload = {
    couponCode: "TEST10",
    orderId: "CONCURRENT-SAME-ORDER",
    orderAmountPaise: 10000,
  };

  const sendRedemption = () =>
    request(app)
      .post("/api/customer/redemptions")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload);

  // Send both identical requests concurrently.
  const [firstResponse, secondResponse] = await Promise.all([
    sendRedemption(),
    sendRedemption(),
  ]);

  // One request creates the redemption; the other replays it.
  const statuses = [
    firstResponse.status,
    secondResponse.status,
  ].sort((a, b) => a - b);

  expect(statuses).toEqual([200, 201]);

  // Both requests must refer to the same redemption.
  expect(firstResponse.body.data.redemptionId).toBe(
    secondResponse.body.data.redemptionId
  );

  // Exactly one response must indicate a replay.
  const replayHeaders = [
    firstResponse.headers["idempotent-replay"],
    secondResponse.headers["idempotent-replay"],
  ];

  expect(replayHeaders.filter((value) => value === "true")).toHaveLength(1);

  // Only one redemption document should exist.
  expect(
    await Redemption.countDocuments({ customerId: customer._id })
  ).toBe(1);

  // Global coupon counter must increment only once.
  const updatedCoupon = await Coupon.findById(coupon._id);
  expect(updatedCoupon.usedCount).toBe(1);

  // Customer usage must increment only once.
  const usage = await CustomerCouponUsage.findOne({
    couponId: coupon._id,
    customerId: customer._id,
  });

  expect(usage.usedCount).toBe(1);
});

test("concurrent requests with different keys cannot create duplicate active redemptions for the same order", async () => {
  const payload = {
    couponCode: "TEST10",
    orderId: "SAME-ORDER-DIFFERENT-KEYS",
    orderAmountPaise: 10000,
  };

  const sendRedemption = (idempotencyKey) =>
    request(app)
      .post("/api/customer/redemptions")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload);

  const [firstResponse, secondResponse] = await Promise.all([
    sendRedemption("550e8400-e29b-41d4-a716-446655440011"),
    sendRedemption("550e8400-e29b-41d4-a716-446655440012"),
  ]);

  // One request creates the redemption; the other resolves to the existing one.
  const statuses = [
    firstResponse.status,
    secondResponse.status,
  ].sort((a, b) => a - b);

  expect(statuses).toEqual([200, 201]);

  // Both responses must refer to the same redemption.
  expect(firstResponse.body.data.redemptionId).toBe(
    secondResponse.body.data.redemptionId
  );

  // The database must contain only one active redemption for this order.
  const activeRedemptions = await Redemption.countDocuments({
    customerId: customer._id,
    orderId: payload.orderId,
    status: "SUCCESSFUL",
  });

  expect(activeRedemptions).toBe(1);

  // Neither counter should increment twice.
  const updatedCoupon = await Coupon.findById(coupon._id);
  expect(updatedCoupon.usedCount).toBe(1);

  const usage = await CustomerCouponUsage.findOne({
    couponId: coupon._id,
    customerId: customer._id,
  });

  expect(usage.usedCount).toBe(1);
});

test("concurrent requests cannot exceed the per-customer limit", async () => {
  // Allow two redemptions per customer.
  await Coupon.updateOne(
    { _id: coupon._id },
    {
      $set: {
        totalLimit: 5,
        perCustomerLimit: 2,
      },
    }
  );

  const requests = [
    {
      orderId: "CUSTOMER-CONCURRENT-1",
      key: "550e8400-e29b-41d4-a716-446655440013",
    },
    {
      orderId: "CUSTOMER-CONCURRENT-2",
      key: "550e8400-e29b-41d4-a716-446655440014",
    },
    {
      orderId: "CUSTOMER-CONCURRENT-3",
      key: "550e8400-e29b-41d4-a716-446655440015",
    },
  ];

  const responses = await Promise.all(
    requests.map(({ orderId, key }) =>
      request(app)
        .post("/api/customer/redemptions")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", key)
        .send({
          couponCode: "TEST10",
          orderId,
          orderAmountPaise: 10000,
        })
    )
  );

  const statuses = responses
    .map((response) => response.status)
    .sort((a, b) => a - b);

  // Exactly two requests succeed; one is rejected.
  expect(statuses).toEqual([201, 201, 409]);

  const successfulRedemptions = await Redemption.countDocuments({
    customerId: customer._id,
    couponId: coupon._id,
    status: "SUCCESSFUL",
  });

  expect(successfulRedemptions).toBe(2);

  // Customer usage must never exceed two.
  const usage = await CustomerCouponUsage.findOne({
    couponId: coupon._id,
    customerId: customer._id,
  });

  expect(usage.usedCount).toBe(2);

  // Global usage should also reflect only two successful redemptions.
  const updatedCoupon = await Coupon.findById(coupon._id);

  expect(updatedCoupon.usedCount).toBe(2);
});

});
