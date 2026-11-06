import { jest } from "@jest/globals";

// Mock all dependencies before importing
jest.unstable_mockModule("../../utils/helpers.js", () => ({
  catchAsync: jest.fn((fn) => async (req, res, next) => {
    try {
      return await fn(req, res, next);
    } catch (error) {
      throw error;
    }
  }),
}));

jest.unstable_mockModule("../../middlewares/appSuccess.js", () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule("../../middlewares/appError.js", () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule("../../models/userModel.js", () => ({
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

jest.unstable_mockModule("../../services/authUserService.js", () => ({
  loginUserService: jest.fn(),
  logoutUserService: jest.fn(),
  refreshUserAccessTokenService: jest.fn(),
}));

// Import after mocking
const AppSuccess = (await import("../../middlewares/appSuccess.js")).default;
const AppError = (await import("../../middlewares/appError.js")).default;
const User = (await import("../../models/userModel.js")).default;
const { loginUserService, logoutUserService, refreshUserAccessTokenService } =
  await import("../../services/authUserService.js");

const {
  loginUser,
  refreshUserAccessToken,
  logoutUser,
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
} = await import("../../controllers/userController.js");

describe("UserController Tests", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      params: {},
      query: {},
      user: { id: "user123" },
      refreshToken: "refresh-token-123",
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn(),
    };
  });

  describe("loginUser", () => {
    it("should login user successfully", async () => {
      const mockResponse = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: { id: "user123", email: "test@example.com" },
      };

      req.body = { identifier: "test@example.com", password: "password123" };
      loginUserService.mockResolvedValue(mockResponse);

      await loginUser(req, res);

      expect(loginUserService).toHaveBeenCalledWith(
        "test@example.com",
        "password123",
        res
      );
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "User login successfully",
        data: mockResponse,
      });
    });
  });

  describe("refreshUserAccessToken", () => {
    it("should refresh access token successfully", async () => {
      const mockResponse = { accessToken: "new-access-token" };
      refreshUserAccessTokenService.mockResolvedValue(mockResponse);

      await refreshUserAccessToken(req, res);

      expect(refreshUserAccessTokenService).toHaveBeenCalledWith(
        "refresh-token-123",
        req.user,
        res
      );
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "Access token refreshed successfully",
        data: { accessToken: "new-access-token" },
      });
    });
  });

  describe("logoutUser", () => {
    it("should logout user successfully", async () => {
      const mockResponse = { deleted: true };
      logoutUserService.mockResolvedValue(mockResponse);

      await logoutUser(req, res);

      expect(logoutUserService).toHaveBeenCalledWith(req.user, res);
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "User logged out successfully",
        data: { deleted: true },
      });
    });
  });

  describe("getAllUsers", () => {
    it("should get all users with default pagination", async () => {
      const mockUsers = [
        { id: "1", name: "User 1", email: "user1@example.com" },
        { id: "2", name: "User 2", email: "user2@example.com" },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUsers),
      };

      User.find.mockReturnValue(mockQuery);
      User.countDocuments.mockResolvedValue(25);

      await getAllUsers(req, res);

      expect(User.find).toHaveBeenCalledWith({});
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "Users fetched successfully",
        data: {
          users: mockUsers,
          pagination: {
            totalCount: 25,
            page: 1,
            limit: 10,
          },
        },
      });
    });
  });

  describe("createUser", () => {
    it("should create user successfully", async () => {
      req.body = {
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        password: "password123",
      };

      User.findOne.mockResolvedValue(null);
      const mockCreatedUser = { id: "user123", ...req.body };
      User.create.mockResolvedValue(mockCreatedUser);
      AppError.mockImplementation((message, code, details) => {
        const error = new Error(message);
        error.statusCode = code;
        error.errors = details.errors;
        return error;
      });
      await createUser(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: "john@example.com" });
      expect(User.create).toHaveBeenCalledWith({
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        password: "password123",
      });
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        statusCode: 201,
        message: "User created successfully",
        data: mockCreatedUser,
      });
    });

    it("should throw error if user already exists", async () => {
      req.body = { email: "existing@example.com" };
      User.findOne.mockResolvedValue({ id: "existing-user" });
      AppError.mockImplementation((message, code, details) => {
        const error = new Error(message);
        error.statusCode = code;
        error.errors = details.errors;
        return error;
      });

      await expect(createUser(req, res)).rejects.toThrow();
    });
  });

  describe("getUserById", () => {
    it("should get user by id successfully", async () => {
      req.params.id = "user123";
      const mockUser = {
        id: "user123",
        name: "John Doe",
        email: "john@example.com",
      };
      User.findById.mockResolvedValue(mockUser);

      await getUserById(req, res);

      expect(User.findById).toHaveBeenCalledWith("user123");
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "User fetched successfully",
        data: mockUser,
      });
    });

    it("should throw error if id is not provided", async () => {
      req.params = {};
      AppError.mockImplementation((message, code, details) => {
        const error = new Error(message);
        error.statusCode = code;
        error.errors = details.errors;
        return error;
      });
      await expect(getUserById(req, res)).rejects.toThrow();
    });
  });

  describe("updateUser", () => {
    it("should update user successfully", async () => {
  req.params.id = "user123";
  req.body = {
    name: "Updated Name",
    email: "updated@example.com",
  };

  const mockUpdatedUser = {
    id: "user123",
    name: "John Doe",
    email: "john@example.com",
    save: jest.fn().mockResolvedValue(true),
  };

  User.findById.mockResolvedValue(mockUpdatedUser);

  await updateUser(req, res);

  expect(User.findById).toHaveBeenCalledWith("user123");

  expect(mockUpdatedUser.name).toBe("Updated Name");
  expect(mockUpdatedUser.email).toBe("updated@example.com");
  expect(mockUpdatedUser.save).toHaveBeenCalled();

  expect(AppSuccess).toHaveBeenCalledWith(res, {
    message: "User updated successfully",
    data: mockUpdatedUser,
  });
});

    
it("should throw error if user not found", async () => {
  req.params.id = "nonexistent";
  req.body = { name: "Updated Name" };

  User.findById.mockResolvedValue(null);

  AppError.mockImplementation((message, code, details) => {
    const error = new Error(message);
    error.statusCode = code;
    error.errors = details?.errors;
    return error;
  });

  await expect(updateUser(req, res)).rejects.toThrow("User not found");
});

  });

  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      req.params.id = "user123";
      const mockDeletedUser = { id: "user123", name: "John Doe" };
      User.findByIdAndDelete.mockResolvedValue(mockDeletedUser);
      AppError.mockImplementation((message, code, details) => {
        const error = new Error(message);
        error.statusCode = code;
        error.errors = details.errors;
        return error;
      });
      await deleteUser(req, res);

      expect(User.findByIdAndDelete).toHaveBeenCalledWith("user123");
      expect(AppSuccess).toHaveBeenCalledWith(res, {
        message: "User deleted successfully",
        data: { deleted: mockDeletedUser },
      });
    });

    it("should throw error if id is not provided", async () => {
      req.params = {};
      AppError.mockImplementation((message, code, details) => {
        const error = new Error(message);
        error.statusCode = code;
        error.errors = details.errors;
        return error;
      });
      await expect(deleteUser(req, res)).rejects.toThrow();
    });
  });
});
