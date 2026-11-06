export const allowedOrigins = {
  development: [
    "https://dev.domain.com",
    "https://dev.domain.com/",
    "https://www.dev.domain.com",
    "https://www.dev.domain.com/",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
  test: [
    "https://uat.domain.com",
    "https://uat.domain.com/",
    "https://www.uat.domain.com",
    "https://www.uat.domain.com/",
  ],
  production: [
    "https://domain.com",
    "https://domain.com/",
    "https://www.domain.com",
    "https://www.domain.com/",
  ],
};

export const userRefreshTokenPath ="/api/users/update-refresh-access";