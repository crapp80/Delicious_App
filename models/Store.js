/* eslint-disable func-names */

const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: 'Please enter a store name!',
  },
  slug: String,
  description: {
    type: String,
    trim: true,
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now,
  },
  location: {
    type: {
      type: String,
      default: 'Point',
    },
    coordinates: [{
      type: Number,
      required: 'You must supply coordinates!',
    }],
    address: {
      type: String,
      required: 'You must supply an address!',
    },
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must suppy an author',
  },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Define our indexes
storeSchema.index({
  name: 'text', // index the name field of our storeSchema as text
  description: 'text',
});

storeSchema.index({ location: '2dsphere' });

storeSchema.pre('save', async function (next) {
  if (!this.isModified('name')) {
    next(); // skip it
    return; // stop this function from running
  }
  this.slug = slug(this.name);
  // find other stores that have a slug of f.e. bar, bar-1, bar-2, ...
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i'); // pattern: slug_name('- 0 to 9' optional)
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  if (storesWithSlug.length) {
    this.slug = `${this}-${storesWithSlug.length + 1}`;
  }
  next();
});

storeSchema.statics.getTagsList = function () {
  return this.aggregate([
    { $unwind: '$tags' }, // creates one entry for each tag set for a store
    { $group: { _id: '$tags', count: { $sum: 1 } } }, // group by tag and count
    { $sort: { count: -1 } }, // sort by count, 1 -> sort ascending, -1 -> sort descending
  ]);
};

storeSchema.statics.getTopStores = function () {
  return this.aggregate([
    // lookup stores and populate their reviews
    {
      $lookup:
      {
        from: 'reviews',
        localField: '_id',
        foreignField: 'store',
        as: 'reviews',
      },
    },
    // filter for only items that have 2 or more reviews
    {
      $match: { 'reviews.1': { $exists: true } },
    },
    // add the average ratings field
    {
      $project: // in mongoDB v3.4 and up, you can use $addField instead
      {
        photo: '$$ROOT.photo',
        name: '$$ROOT.name',
        slug: '$$ROOT.slug',
        reviews: '$$ROOT.reviews',
        averageRating: { $avg: '$reviews.rating' },
      },
    },
    // sort it by our new field, highest rating first
    {
      $sort: { averageRating: -1 },
    },
    // limit to at most 10
    { $limit: 10 },
  ]);
};

// Get access to the Review Model and do a query
// find reviews where the stores _id property === reviews store property
storeSchema.virtual('reviews', {
  ref: 'Review', // what model to link?
  localField: '_id', // which field on the store?
  foreignField: 'store', // which field on the review?
});

function autopopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);
