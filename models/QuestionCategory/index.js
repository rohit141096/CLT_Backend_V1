const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const questionCategorySchema = new Schema({
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
questionCategorySchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
mongoose.exports = mongoose.model("question_Category", questionCategorySchema);
