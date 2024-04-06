/* eslint-disable import/no-dynamic-require */
const Review = require(`${__dirname}/../models/reviewModel`);
const factory = require('./handleFactory');

// it was the extra code in create review which we seperated in another middleware.
exports.setTourUserIds = function (req, res, next) {
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user.id;
  next();
};

exports.getAllReviews = factory.getAll(Review);
exports.createReview = factory.createOne(Review);
exports.deleteReview = factory.deleteOne(Review);
exports.updateReview = factory.updateOne(Review);
exports.getReview = factory.getOne(Review);
