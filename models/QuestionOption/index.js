const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const questionOptionSchema = new Schema({
  question_option_type: {
    type: ObjectId,
    ref: "question_type",
    required: true,
  },
  question: {
    type: ObjectId,
    ref: "question",
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
  is_correct: {
    type: Boolean,
    default: false,
  },
  display_order: {
    type: Number,
    default: 1,
    required: true,
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
questionOptionSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
mongoose.exports = mongoose.model("question_option", questionOptionSchema);
