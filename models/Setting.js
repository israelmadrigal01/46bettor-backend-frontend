// models/Setting.js
const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true, collection: 'settings' }
);

module.exports = mongoose.model('Setting', SettingSchema);
