/* eslint-disable prefer-destructuring */
/* eslint-disable func-names */

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
mongoose.Promise = global.Promise;
const md5 = require('md5');
const validator = require('validator');
const mongodbErrorHandler = require('mongoose-mongodb-errors');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
  email: {
    type: String,
    unique: true, // avoids duplicate email adresses
    lowercase: true, // lowercase string
    trim: true, // removes spaces before and after
    validate: [validator.isEmail, 'Invalid Email Adress'], // validator package, usage [validator.isEmail, 'Error Message']
    required: 'Please Supply an Email Address',
  },
  name: {
    type: String,
    required: 'Please Supply a name',
    trim: true,
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  hearts: [
    { type: mongoose.Schema.ObjectId, ref: 'Store' },
  ],
});

userSchema.virtual('gravatar').get(function () {
  const hash = md5(this.email);
  return `https://gravatar.com/avatar/${hash}?s=200`;
});

userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });
userSchema.plugin(mongodbErrorHandler);

module.exports = mongoose.model('User', userSchema);
