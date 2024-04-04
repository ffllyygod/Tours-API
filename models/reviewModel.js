/* eslint-disable no-console */
const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Add your review'],
    },
    rating: {
      type: Number,
      max: 5,
      min: 1,
      required: [true, 'Rating is must my nigga'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must have a user'],
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must have a tour'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);
//  I made this
// reviewSchema.pre(/^find|create/, function (next) {
//   this.populate({
//     path: 'user tour',
//   });
// });

// user can only write one review to a tour and we cant make the schema tour unique user unique this will only allow user to write on one review of only a tour but we want together unique and we will achieve it by indexes

reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function (next) {
  //   this.populate({
  //     path: 'tour',
  //     select: 'name',
  //   }).populate({
  //     path: 'user',
  //     select: 'name photo',
  //   });
  this.populate({
    path: 'user',
    select: 'name photo',
  });
  next();
});

reviewSchema.statics.calcAverageRating = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: {
        tour: tourId,
      },
      $group: {
        _id: tourId,
        nRating: { $sum: 1 },
        avgRating: { $avg: 'rating' },
      },
    },
  ]);
  console.log(stats);
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats.avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

reviewSchema.post('save', function () {
  this.constructor.calcAverageRating(this.tour);
});

// in case if reviews get updated or deleted then we have to change the ratingsAverage
// findByIdAndUpdate
// findByIdAndDelete
// here we only get the query object and not the doc so we will use a lil trick

reviewSchema.pre(/^findOneAnd/, async function (next) {
  // why we didnt calculate here becuase here the doc is not uodated with the new value we did this to get id of the tour then sended it to post lecture 169
  this.r = await this.findOne();
  next();
});
// this is how we send vairble from post to pre do check it it is a nice concept

reviewSchema.post(/^findOneAnd/, async function () {
  // this.r = await this.findOne(); cant do this because query is executed in post and we dont get doc in findOneandUpdateor delete
  await this.r.constructor.calcAverageRating(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
