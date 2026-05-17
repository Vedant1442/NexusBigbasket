const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true // For search
  },
  image: {
    type: String,
  },
  category: {
    type: String,
    index: true // For filtering
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: String, // e.g., "500g", "1 kg"
  },
  source: {
    type: String,
    default: 'blinkit' // blinkit, instamart, zepto
  },
  productUrl: {
    type: String,
  }
}, {
  timestamps: true
});

mongoose.set('autoIndex', false); // Optional: disable autoIndex in production if needed

module.exports = mongoose.model('Product', productSchema);
