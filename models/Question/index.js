const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const questionchema = new Schema({
  question_type: {
    type: ObjectId,
    ref: "question_type",
    required: true,
  },
  question_category: {
    type: ObjectId,
    ref: "question_category",
    required: true,
  },
  chapter: {
    type: ObjectId,
    ref: "chapter",
    required: true,
  },
  title: {
    en: {
      type: String,
      required: true,
    },
    kn: {
      type: String,
      required: true,
    },
  },
  url: {
    en: {
      type: String,
      required: false,
    },
    kn: {
      type: String,
      required: false,
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
questionchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
mongoose.exports = mongoose.model("question", questionchema);
