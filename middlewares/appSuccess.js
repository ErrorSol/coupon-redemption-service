class AppSuccess {
  constructor(
    res,
    {
      message = "Success",
      data = {},
      statusCode = 200,
      responseCode = 0,
      status = "success",
    }
  ) {
    return res.status(statusCode).json({
      responseCode,
      status,
      message,
      data,
    });
  }
}

export default AppSuccess;
