/* eslint-disable no-unused-expressions */
/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* eslint-disable import/no-extraneous-dependencies */
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createAndSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);
  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  //   const newUser = await User.create(req.body); // or User.save
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  createAndSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  //   check whether email and password exist
  if (!email || !password) {
    return next(new AppError('Please enter email and password!', 400));
  }

  //   check whether user exits and password is correct
  const user = await User.findOne({ email }).select('+password');
  //   console.log(user);

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // if everything cool, send token to client
  createAndSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({
    status: 'success',
  });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) getting token and check of its there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token)
    return next(
      new AppError('You are not logged in, Please login to get access', 401),
    );
  // 2) verifying token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // 3) checking whether user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError('The user belonging to this token does not exist', 401),
    );
  }
  // 4) check whether user changed password after token has been issued
  if (currentUser.changesPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'User has changed password recently, Please login again',
        401,
      ),
    );
  }
  //   Grant Access
  req.user = currentUser;
  next();
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Permission denied', 403));
    }
    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1)get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('No user found with given email', 404));
  }
  // 2)generate random token
  const resetToken = user.createPasswordResetToken();
  // imp validateBeforeSave
  await user.save({ validateBeforeSave: false });
  // 3)send it to users email
  const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? submit a patch request with your new password and confirm password to: ${resetURL}.\nIf you didn't forgot your password ignore this mail.`;

  try {
    await sendEmail({
      mail: user.email,
      subject: 'Your password reset token is valid for 10 minute',
      message,
    });
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        'There was an error sending this email, try agin later',
        500,
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) get user based on token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.param.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gte: Date.now() },
  });
  if (!user) {
    return next(
      new AppError(
        'No user found on this token or token has been expired',
        400,
      ),
    );
  }
  // 2) if the token is not expired and user is there, change password
  user.password = req.body.password;
  user.confirmPassword = req.body.passwordConfirm;
  // it can also be done but we have nice method for it using middleware so that we can generalize it
  // user.passwordChangedAt = Date.now();
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();
  // 3) update changedPasswordAt property
  // 4) login user and send JWT
  createAndSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) get user from collection
  const user = await User.findById(req.user.id).select('+password');
  if (!user) {
    return next(new AppError('No user found with that ID', 400));
  }
  // 2) check whether the posted password is correct?
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('The password is incorrect', 401));
  }
  // it can also be done but we have nice method for it using middleware so that we can generalize it
  // user.passwordChangedAt = Date.now();

  // why didn't we used findbyIdandUpdate because our middleware will work only on save and create and also it is a tip that don't use Update on password things
  // 3) update the Password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  await user.save();
  // 4) login user and send JWT
  createAndSendToken(user, 201, res);
});
