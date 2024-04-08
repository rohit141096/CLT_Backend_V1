const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const testQuestionsSchema = new Schema({
  test: {
    type: ObjectId,
    ref: "test",
    required: true,
  },
  question: {
    type: ObjectId,
    ref: "question",
    required: true,
  },
  is_marked_for_review: {
    type: Boolean,
    default: false,
  },
  is_skipped: {
    type: Boolean,
    default: false,
  },
  is_answered: {
    type: Boolean,
    default: false,
  },
  result: {
    is_correct: {
      type: Boolean,
      default: false,
    },
    selected_option: {
      type: ObjectId,
      ref: "question_option",
      required: true,
    },
  },
});
testQuestionsSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
mongoose.exports = mongoose.model("test_questions", testQuestionsSchema);
