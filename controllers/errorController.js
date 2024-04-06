/* eslint-disable no-console */
const AppError = require('../utils/appError');

const HandleCastErrorDB = (err) => {
  const message = `Invalid ${err.path} : ${err.value}.`;
  return new AppError(message, 400);
};

const HandleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(?:(?=(\\?))\2.)*?\1/)[0];
  const message = `Duplicate field value: ${value},Please use another value`;
  return new AppError(message, 400);
};

const HandleValidationErrorDB = (err) => {
  // Object.values se object ki values array me save ho jaati hai
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data, ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const HandleJWTError = (err) =>
  new AppError(`${err.message}, Please login again`, 401);

const HandleJWTExpiredError = new AppError('Token is expired', 401);

const sendErrDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack,
  });
};

const sendErrProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.log('error due to bug ig', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }
};

module.exports = (err, req, res, next) => {
  err.status = err.status || 'error';
  err.statusCode = err.statusCode || 500;
  if (process.env.NODE_ENV === 'development') {
    sendErrDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    if (error.name === 'CastError') error = HandleCastErrorDB(error);
    if (error.code === 11000) error = HandleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')
      error = HandleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = HandleJWTError(error);
    if (error.name === 'TokenExpiredError')
      error = HandleJWTExpiredError(error);
    sendErrProd(error, res);
  }
};
