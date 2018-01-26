/* eslint no-underscore-dangle: 0 */
/* eslint-disable consistent-return */
/* eslint-disable prefer-destructuring */
/* eslint-disable object-curly-newline */

const mongoose = require('mongoose');

const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer'); // for file/image upload
const jimp = require('jimp'); // for image resizing
const uuid = require('uuid'); // gives us unique identifiers for filenames

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if (isPhoto) {
      next(null, true);
    } else {
      next({ message: 'That filetype is not allowed!' }, false);
    }
  },
};

exports.homePage = (req, res) => {
  res.render('index');
};

exports.addStore = (req, res) => {
  res.render('editStore', { title: 'Add Store' });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
  // check if there is no new file to resize
  if (!req.file) {
    next(); // skip to the next middleware
    return;
  }
  const extension = req.file.mimetype.split('/')[1]; // f.e. mimetype = 'image/jpeg' -> with .split('/') we get an Array [0] = 'image', [1] = 'jpeg'
  req.body.photo = `${uuid.v4()}.${extension}`; // generates 'unique_filename.extension'
  // now we resize
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(800, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  // once we have written the photo to our filesystem, keep going! -> hand over to next middleware
  next();
};

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await (new Store(req.body)).save();
  req.flash('success', `Successfully Created ${store.name}. Care to leave a review?`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = (page * limit) - limit;

  // Query the database for a list of all stores
  const storesPromise = Store
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc' });

  const countPromise = Store.count();

  const [stores, count] = await Promise.all([storesPromise, countPromise]);
  const pages = Math.ceil(count / limit);
  if (!stores.length && skip) {
    req.flash('info', `Hey you asked for ${page}. But that doesn't exist. So I put you on page ${pages}.`);
    res.redirect(`/stores/page/${pages}`);
    return;
  }

  res.render('stores', { title: 'Stores', stores, page, pages, count });
};

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error('You must own a store in order to edit it.');
  }
};

exports.editStore = async (req, res) => {
  // 1. Find the store given the ID
  const store = await Store.findOne({ _id: req.params.id });
  // 2. Confirm they are the owner of the store
  confirmOwner(store, req.user);
  // 3. Render out the edit form so the user can update their store
  res.render('editStore', { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
  // set the location to be a Point
  req.body.location.type = 'Point';
  // find and update the store
  const store = await Store.findOneAndUpdate(
    { _id: req.params.id }, req.body,
    {
      new: true,
      runValidators: true,
    },
  )
    .exec();
  req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/store/${store.slug}">View store</a>`);
  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
  if (!store) return next();
  res.render('store', { store, title: store.name });
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag; // object destructuring
  // if there is no tag selected, just give me any store that has a tag property on it
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList(); // new method, added to our storeSchemas in Store.js
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]); // ES6 destructuring
  res.render(
    'tag',
    {
      tags, title: 'Tags', tag, stores,
    },
  );
};

exports.searchStores = async (req, res) => {
  const stores = await Store
    .find({
      // $text performs a search on the content of the fields indexed as text,
      // see mongoDB documentation
      $text: {
        $search: req.query.q, // the query, f.e. '...?q=burgers'
      },
    }, {
      score: { $meta: 'textScore' }, // $meta returns the metadata for each matching document
    })
    .sort({ // sort them
      score: { $meta: 'textScore' },
    })
    .limit(5); // limit to 5 results
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  // parseFloat converts string to integer
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates,
        },
        $maxDistance: 10000, // metres
      },
    },
  };

  const stores = await Store.find(q).select('slug name description location photo').limit(10);
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render('map', { title: 'Map' });
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map(obj => obj.toString());
  const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
  const user = await User
    .findByIdAndUpdate(
      req.user._id,
      { [operator]: { hearts: req.params.id } },
      { new: true },
    );
  res.json(user);
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    _id: { $in: req.user.hearts }, // find any stores where the id is in the array hearts
  });
  res.render('stores', { title: 'Hearted Stores', stores });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  res.render('topStores', { title: '★ Top Stores', stores });
};
