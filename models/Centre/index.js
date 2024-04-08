const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const centreSchema = new Schema({
  name: {
    en: {
      type: String,
      required: true,
    },
    kn: {
      type: String,
      required: true,
    },
  },
  district: {
    type: ObjectId,
    ref: "district",
    required: true,
  },
  capacity: {
    type: Number,
    required: true,
  },
  contact_details: {
    address: {
      type: String,
      required: true,
    },
    phone_number: {
      type: String,
      required: true,
    },
    email_id: {
      type: String,
      required: true,
    },
    location: {
      lat: {
        type: String,
        required: true,
      },
      long: {
        type: String,
        required: true,
      },
    },
  },
  created_by: {
    type: ObjectId,
    ref: "admin",
    required: true,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  is_archived: {
    type: Boolean,
    default: false,
  },
});
centreSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
mongoose.exports = mongoose.model("centre", centreSchema);
