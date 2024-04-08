const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const testSchema = new Schema({
  applicant: {
    type: ObjectId,
    ref: "applicant",
    required: true,
  },
  slot: {
    type: ObjectId,
    ref: "selected_slot",
    required: true,
  },
  is_completed: {
    type: Boolean,
    default: false,
  },
  result: {
    mcqs_received: {
      type: Number,
      default: 0,
    },
    mcqs_attempted: {
      type: Number,
      default: 0,
    },
    mcqs_correct_answers: {
      type: Number,
      default: 0,
    },
    mcqs_incorrect_answers: {
      type: Number,
      default: 0,
    },
    kn_typing_received: {
      type: Boolean,
      default: false,
    },
    kn_typing: {
      marks: {
        type: Number,
        default: 0,
      },
      time_taken: {
        type: Number,
        default: 0,
      },
      accuracy: {
        type: Number,
        default: 0,
      },
    },
    en_typing_received: {
      type: Boolean,
      default: false,
    },
    en_typing: {
      marks: {
        type: Number,
        default: 0,
      },
      time_taken: {
        type: Number,
        default: 0,
      },
      accuracy: {
        type: Number,
        default: 0,
      },
    },
    total_marks: {
      type: Number,
      default: 0,
    },
    certificate: {
      is_required: {
        type: Boolean,
        default: false,
      },
      is_verified: {
        type: Boolean,
        default: false,
      },
      is_signed: {
        type: Boolean,
        default: false,
      },
      is_generated: {
        type: Boolean,
        default: false,
      },
      certificate_url: {
        type: String,
        required: false,
      },
    },
  },
});
testSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
mongoose.exports = mongoose.model("test", testSchema);
