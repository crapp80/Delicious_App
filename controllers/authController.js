const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail');

exports.login = passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: 'Login Failed!',
  successRedirect: '/',
  successFlash: 'You are now logged in.',
});

exports.logout = (req, res) => {
  req.logOut();
  req.flash('success', 'You are now logged out.');
  res.redirect('/');
};

exports.isLoggedIn = (req, res, next) => {
  // first check if the user is authenticated, passport method
  if (req.isAuthenticated()) {
    // carry on, they are logged in
    next();
    return;
  }

  req.flash('error', 'You must be logged in.');
  res.redirect('/login');
};

exports.forgot = async (req, res) => {
  // 1. see if a user with that email exists
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash('error', 'No account with that email exists.');
    return res.redirect('/login');
  }

  // 2. Set reset tokens and expiry on their account
  user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
  await user.save();

  // 3. Send them an email with the token
  const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
  await mail.send({
    user, // equal to user: user
    subject: 'Password Reset',
    resetURL,
    filename: 'password-reset',
  });
  req.flash('success', 'You have been emailed a password reset link.');

  // 4. Redirect to the login page
  res.redirect('/login');
};

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token, // check if tokens are equal
    resetPasswordExpires: { $gt: Date.now() }, // check if expiry date is greater than now
  });
  if (!user) {
    req.flash('error', 'Link has expired. Please try again.');
    return res.redirect('/login');
  }

  // if there is a user, show reset password loginForm
  res.render('reset', { title: 'Reset your Password' });
};

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body['password-confirm']) {
    next();
    return;
  }
  req.flash('error', 'Passwords do not match.');
  res.redirect('back');
};

exports.update = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired.');
    return res.redirect('/login');
  }
  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);
  user.resetPasswordToken = undefined; // get rid of the fields
  user.resetPasswordExpires = undefined;
  const updatedUser = await user.save(); // save it in the database
  await req.login(updatedUser); // passport method, pass a user and it gets logged in
  req.flash('success', 'Success, your password has been reset.');
  res.redirect('/');
};
