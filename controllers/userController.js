import { catchAsync } from "../utils/helpers.js";
import AppSuccess from "../middlewares/appSuccess.js";
import {
  loginUserService,
  logoutUserService,
  refreshUserAccessTokenService,
} from "../services/authUserService.js";
import User from "../models/userModel.js";
import AppError from "../middlewares/appError.js";

export const loginUser = catchAsync(async (req, res) => {
  const { identifier, password } = req.body;
  const { accessToken, refreshToken, user } = await loginUserService(
    identifier,
    password,
    res
  );
  return new AppSuccess(res, {
    message: "User login successfully",
    data: { accessToken, refreshToken, user },
  });
});

export const refreshUserAccessToken = catchAsync(async (req, res) => {
  const refreshToken = req.refreshToken;
  const user = req.user;
  const { accessToken } = await refreshUserAccessTokenService(
    refreshToken,
    user,
    res
  );

  // Send the response
  return new AppSuccess(res, {
    message: "Access token refreshed successfully",
    data: { accessToken },
  });
});

export const logoutUser = catchAsync(async (req, res) => {
  const { deleted } = await logoutUserService(req.user, res);
  return new AppSuccess(res, {
    message: "User logged out successfully",
    data: { deleted },
  });
});

export const getAllUsers = catchAsync(async (req, res) => {
  // 1. Filtering
  const queryObj = { ...req.query };
  const excludeFields = ["page", "sort", "limit", "fields"];
  excludeFields.forEach((el) => delete queryObj[el]);

  // Advanced filtering (gte, gt, lte, lt)
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(
    /\b(gte|gt|lte|lt|ne|in|nin)\b/g,
    (match) => `$${match}`
  );
  let filter = JSON.parse(queryStr);

  // 2. Query
  let query = User.find(filter);

  // 3. Sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  // 4. Field limiting
  if (req.query.fields) {
    const fields = req.query.fields.split(",").join(" ");
    query = query.select(fields);
  } else {
    query = query.select("-__v");
  }

  // 5. Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;
  query = query.skip(skip).limit(limit);

  // 6. Execute query
  const users = await query;
  const totalCount = await User.countDocuments(filter);

  return new AppSuccess(res, {
    message: "Users fetched successfully",
    data: {
      users,
      pagination: {
        totalCount,
        page,
        limit,
      },
    },
  });
});

export const createUser = catchAsync(async (req, res) => {
  const userData = req.body;
  const { name, email, phone, password } = userData;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("<Custom Stack Trace Error Message>", 400, {
      errors: [
        {
          field: "email",
          message: "User already exists",
        },
      ],
    });
  }
  const user = await User.create({ name, email, phone, password });
  return new AppSuccess(res, {
    statusCode: 201,
    message: "User created successfully",
    data: user,
  });
});

export const getUserById = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError("<Custom Stack Trace Error Message>", 400, {
      errors: [
        {
          field: "id",
          message: "User ID is required",
        },
      ],
    });
  }
  const user = await User.findById(id);
  return new AppSuccess(res, {
    message: "User fetched successfully",
    data: user,
  });
});


export const updateUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  const allowedFields = ["name", "email", "phone"];

  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) =>
      allowedFields.includes(key)
    )
  );

  const user = await User.findById(id);

  if (!user) {
    throw new AppError("User not found", 404, {
      code: "USER_NOT_FOUND",
    });
  }

  Object.assign(user, updates);

  await user.save();

  return new AppSuccess(res, {
    message: "User updated successfully",
    data: user,
  });
});

export const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError("<Custom Stack Trace Error Message>", 400, {
      errors: [
        {
          field: "id",
          message: "User ID is required",
        },
      ],
    });
  }
  const deleted = await User.findByIdAndDelete(id);
  return new AppSuccess(res, {
    message: "User deleted successfully",
    data: { deleted },
  });
});
