// functions and middleware for user login and registration

const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');

exports.loginForm = (req, res) => {
  res.render('login', { title: 'Login' });
};

exports.registerForm = (req, res) => {
  res.render('register', { title: 'Register' });
};

exports.validateRegister = (req, res, next) => {
  // use express-validator
  req.sanitizeBody('name');
  req.checkBody('name', 'You must supply a name!').notEmpty();
  req.checkBody('email', 'That Email is not valid!').isEmail();
  req.sanitizeBody('email').normalizeEmail({
    remove_dots: false,
    remove_extension: false,
    gmail_remove_subaddress: false,
  });
  req.checkBody('password', 'Password cannot be blank!').notEmpty();
  req.checkBody('password-confirm', 'Confirmed Password cannot be blank!').notEmpty();
  req.checkBody('password-confirm', 'Your Passords do not match!').equals(req.body.password);

  const errors = req.validationErrors();
  if (errors) {
    req.flash('error', errors.map(err => err.msg));
    res.render('register', { title: 'Register', body: req.body, flashes: req.flash() });
    return; // stop the function from running
  }

  next(); // there were no errors -> hand over to next middleware
};

exports.register = async (req, res, next) => {
  const user = new User({ email: req.body.email, name: req.body.name, });
  const register = promisify(User.register, User); // .register is a method of passportLocalMongoose
  await register(user, req.body.password); // stores a hash in the database, not the password
  next(); // pass to authController.js
};

exports.account = (req, res) => {
  res.render('account', { title: 'Edit your account' });
};

exports.updateAccount = async (req, res) => {
  const updates = {
    name: req.body.name,
    email: req.body.email,
  };

  const user = await User.findOneAndUpdate(
   { _id: req.user._id },  // the query
   { $set: updates },  // takes whats inside of updates and writes it to the db entry
   { new: true, runValidators: true, context: 'query' }
  );

  req.flash('success', 'Updated the profile.');
  res.redirect('back');  // same as /account here
};
