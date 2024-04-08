const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const instructionSchema = new Schema({
  instruction_type: {
    type: ObjectId,
    ref: "instruction_type",
    required: true,
  },
  content: {
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
instructionSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
mongoose.exports = mongoose.model("instruction", instructionSchema);
