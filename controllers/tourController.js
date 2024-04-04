// const fs = require('fs');
// eslint-disable-next-line import/no-dynamic-require
const multer = require('multer');
const sharp = require('sharp');

const Tour = require(`${__dirname}/../models/tourModel`);
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handleFactory');

// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`),
// );

// no longer needed and was there to explain middleware function
// exports.checkId = (req, res, next, val) => {
//   if (val > tours.length) {
//     return res.status(400).json({
//       status: 'fail',
//       message: 'Invalid Id',
//     });
//   }
//   next();
// };

// exports.checkBody = (req, res, next) => {
//   if (!req.body.name || !req.body.price) {
//     return res.status(400).json({
//       status: 'fail',
//       message: 'Missing name or price',
//     });
//   }
//   next();
// };

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('upload image only', 400), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

exports.uploadTourImages = upload.fields([
  { name: 'ImageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);
// upload.single('imageCover');
// upload.array('images',3) req.files

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();
  // cover image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;

  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // images
  req.body.images = [];
  const imagePromises = req.files.images.map(async (el, i) => {
    const imageFilename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;
    await sharp(el.buffer)
      .resize(2000, 1333)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(`public/img/tours/${imageFilename}`);
    req.body.images.push(imageFilename);
  });
  await Promise.all(imagePromises);
  next();
});

exports.aliasTopTour = async (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,ratingsAverage,price,difficulty,summary';
  next();
};

exports.tourStats = async (req, res) => {
  try {
    const stats = await Tour.aggregate([
      {
        $match: { ratingsAverage: { $gte: 4.5 } },
      },
      {
        $group: {
          _id: { $toUpper: '$difficulty' },
          numTours: { $sum: 1 },
          numRating: { $sum: '$ratingsQuantity' },
          averageRating: { $avg: '$ratingsAverage' },
          averagePrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
        },
      },
      {
        $sort: { averagePrice: 1 },
      },
      {
        $match: { _id: { $ne: 'EASY' } },
      },
    ]);
    res.status(200).json({
      status: 'success',
      data: {
        tourStats: stats,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: 'Invalid data sent!',
    });
  }
};

exports.getMonthlyPlan = async (req, res) => {
  const year = req.params.year * 1; //2021
  try {
    const plan = await Tour.aggregate([
      {
        $unwind: '$startDates',
      },
      {
        $match: {
          startDates: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { $month: '$startDates' },
          numTourStarts: { $sum: 1 },
          tours: { $push: '$name' },
        },
      },
      {
        $sort: { numTourStarts: -1 },
      },
      {
        $addFields: { month: '$_id' },
      },
      {
        $project: { _id: 0 },
      },
      { $limit: 6 },
    ]);
    res.status(200).json({
      status: 'success',
      data: {
        plan,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: 'Invalid data sent!',
    });
  }
};

// '/tours-within/:distance/center/:latlng/unit/:unit'
// /tours-within/250/center/-40,45/unit/mi prefer than
exports.toursWithIn = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;
  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in format lat,lng',
        400,
      ),
    );
  }
  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lat, lng], radius] } },
  });
  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getAllTours = factory.getAll(Tour);
// if we want optional then we can use /:id?
exports.getTour = factory.getOne(Tour, { path: 'review' });

exports.createTour = factory.createOne(Tour);

// exports.createTour = catchAsync(async (req, res, next) => {
//   const newTour = await Tour.create(req.body);

//   res.status(201).json({
//     status: 'success',
//     data: { tour: newTour },
//   });
// try {
// const newTour = new Tour({});
// newTour.save();

// const newTour = await Tour.create(req.body);

// res.status(201).json({
//   status: 'success',
//   data: { tour: newTour },
// });
// } catch (err) {
//   res.status(400).json({
//     status: 'fail',
//     message: 'Invalid data sent!',
//   });
// }

// console.log(req.body);
// const newId = tours.length;
// const newTour = Object.assign({ id: newId }, req.body);
// tours.push(newTour);
// // we are in callback so we cannot use sync function because they will block our code.
// fs.writeFile(
//   `${__dirname}/dev-data/data/tours-simple.json`,
//   JSON.stringify(tours),
//   (err) => {
//     if (err) {
//       console.log(err.message);
//       return res.sendStatus(422);
//     }
//     res.status(201).json({
//       status: 'success',
//       data: { tours: newTour },
//     });
//   },
// );
// });

exports.updateTour = factory.updateOne(Tour);

// exports.deleteTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndDelete(req.params.id);
//   if (!tour) {
//     return next(new AppError('No tour found with that id', 404));
//   }
//   res.status(204).json({
//     status: 'success',
//     data: null,
//   });
// });
exports.deleteTour = factory.deleteOne(Tour);
