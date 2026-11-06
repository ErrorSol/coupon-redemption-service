# S7C Node App Starter

A modern Node.js starter for quickly starting REST API projects with best practices. This template includes:

- **Global error handler**
- **Joi validation** for request bodies
- **JWT authentication** (routes and helpers included)
- **Basic CRUD example** for `users` (with controllers, services, and models)
- **Project structure** ready for scalable development

---

## 🚀 Quick Start (via npx)

You can scaffold a new project using this boilerplate starter with a single command:

```bash
npx s7c-node-app-starter <your-project-name>
cd <your-project-name>
cp .env.example .env
# Edit .env as needed
# Update the mongo uri in .env
npm run dev
```

---

## 🛠️ Installation (Manual)

1. **Clone the repo:**
   ```bash
   git clone https://github.com/Seventh-Triangle-Consulting/S7C_Node_App_Starter.git
   cd S7C_Node_App_Starter
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up environment variables:**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and set your own values (see below).
4. **Start the server:**
   ```bash
   npm run dev
   ```

---

## ⚙️ Environment Variables

The project uses environment variables for configuration. **Never commit your real `.env` file!**

Example `.env.example`:

```
#BASE
NODE_ENV=development
NODE_ENV_NAME=DEV
PORT=1234
HOST=http://localhost:1234
MONGO_URI="mongodb://localhost:27017/S7C_Node_App_Starter"

#JWT
JWT_ACCESS_SECRET=S7C_NODE_APP_STARTER_+_ACCESS
JWT_ACCESS_EXPIRATION=1d
JWT_REFRESH_SECRET=S7C_NODE_APP_STARTER_+_REFRESH
JWT_REFRESH_EXPIRATION=30d

#EXTRAS
FRONTEND_URL=http://localhost:5173
DASHBOARD_URL=http://localhost:5174
```

- For local development, install MongoDB and use the above URI.
- Or use a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster and paste your connection string here.

> **Note:**
>
> - Rename `.env.dev.example` to `.env.dev.local`
> - Rename `.env.uat.example` to `.env.uat.local`
> - Rename `.env.prod.example` to `.env.prod.local`

---

## 📁 Project Structure

```
├── config/           # Configuration files (DB, CORS)
├── controllers/      # Route controllers (business logic)
├── middlewares/      # Express middlewares (error handler, validation, etc.)
├── models/           # Mongoose models
├── routes/           # Express route definitions
├── services/         # Service layer (DB queries, business logic)
├── utils/            # Utility functions (JWT, validation, etc.)
├── app.js            # Express app setup
├── server.js         # Entry point
├── .env.example      # Example environment variables
└── ...
```

---

## ✨ Features

- **Global Error Handler:**
  - All errors are caught and formatted consistently.
- **Joi Validation:**
  - Request bodies are validated using Joi schemas before reaching controllers.
- **JWT Auth:**
  - JWT helper utilities and auth routes are included.
- **CRUD Example:**
  - `users` resource demonstrates GET, POST, PUT, PATCH, DELETE with controller, service, and model layers.
- **Ready for Production:**
  - Includes CORS, and environment-based config.

---

## 🧑‍💻 Example: CRUD for Users

- **Model:** `models/userModel.js`
- **Controller:** `controllers/userController.js`
- **Service:** `services/authService.js`
- **Routes:** `routes/userRouter.js`

You can use these as a template for your own resources.

---

## 🛡️ Authentication

- JWT authentication helpers and routes are included in `controllers/userController.js` and `routes/userRouter.js`.

---

## 🚨 Error Handling

The project includes a robust error handling system that provides consistent error responses across your API.

### Error Response Format

```json
{
  "responseCode": 1,
  "status": "fail",
  "statusCode": 400,
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ],
  "stack": "Error stack trace (only in development)"
}
```

### Types of Errors Handled

1. **Joi Validation Errors**

   ```js
   // Automatically handled when using validateRequest middleware
   // Example response for invalid request body:
   {
     "responseCode": 1,
     "status": "fail",
     "statusCode": 400,
     "errors": [
       { "field": "name", "message": "Name is required" },
       { "field": "email", "message": "Invalid email format" }
     ]
   }
   ```

2. **Mongoose Validation Errors**

   ```js
   // Automatically handled for MongoDB validation failures
   {
     "responseCode": 1,
     "status": "fail",
     "statusCode": 400,
     "errors": [
       { "field": "age", "message": "Age must be a number" }
     ]
   }
   ```

3. **Custom Application Errors**

   ```js
   // Single error
   throw new AppError("User not found", 404, {
     field: "id",
   });

   // Multiple validation errors
   throw new AppError("Validation Error", 400, {
     errors: [
       { field: "id", message: "User not found" },
       { field: "email", message: "Email must be unique" },
     ],
   });
   ```

4. **Duplicate Key Errors**
   ```js
   // Automatically handled for MongoDB duplicate key violations
   {
     "responseCode": 1,
     "status": "fail",
     "statusCode": 400,
     "errors": [
       {
         "field": "email",
         "message": "Already exists with this email: john@example.com"
       }
     ]
   }
   ```

### Key Features

- Consistent error response format across the application
- Field-level error reporting
- Support for single and multiple error messages
- Automatic handling of common MongoDB and validation errors
- Stack traces in development mode
- Custom error codes and messages
- Flexible error categorization with status codes

### Best Practices

1. Always specify the affected field when throwing errors
2. Use appropriate HTTP status codes
3. Group related validation errors together
4. Keep error messages clear and actionable
5. Use the `AppError` class for all custom errors

---

## 📝 Contributing

Feel free to fork, open issues, or submit PRs!

---

## 📄 License

MIT


## Nova Retail Coupon Redemption — Phase 3

See `docs/phase-3-notes.md` for the Phase 3 endpoint, replica-set setup, counter audit/recount commands, and scope notes. The new redemption endpoint is `POST /api/customer/redemptions`.
