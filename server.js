/* eslint-disable no-console */
const dotenv = require('dotenv');

dotenv.config({ path: './config.env' });
const mongoose = require('mongoose');

//  handling all sync error
process.on('uncaughtException', (err) => {
  console.log(err.name, err.message);
  console.log('Uncaught Exception, SHUTTING DOWN...');
  process.exit(1);
});

const app = require('./app');

// start server
// console.log(app.get('env'));
// console.log(process.env);
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

// const DB = 'mongodb+srv://asap:ayush9123@atlascluster.yf4y7l0.mongodb.net/?retryWrites=true&w=majority';
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => console.log('DB Connection successful'));

// const port = process.env.PORT || 3000;
const port = 3000;
const server = app.listen(port, () => {
  console.log(`Server is listening on port: ${port}`);
});
// handling all async error
process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  console.log('Unhandled Rejection, SHUTTING DOWN....');
  server.close(() => {
    process.exit(1);
  });
});
