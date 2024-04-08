const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const ChapterSchema = new Schema({
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
  difficulty_level: {
    type: ObjectId,
    ref: "difficulty_level",
    required: true,
  },
  weightage: {
    type: Number,
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
ChapterSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
mongoose.exports = mongoose.model("chapter", ChapterSchema);
