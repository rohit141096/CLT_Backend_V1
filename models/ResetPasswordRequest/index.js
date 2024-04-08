const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
const resetPasswordSchema = new Schema({
  request_id: {
    type: Number,
    default: 0,
    required: true,
  },
  admin: {
    type: ObjectId,
    ref: "admin",
    required: true,
  },
  role: {
    type: String,
    enum: [
      "CONTENT_ADMIN",
      "CONTENT_CREATOR",
      "CONTENT_MODERATOR",
      "CONTENT_APPROVER",
      "TEST_ADMIN",
      "APPLICANT_VERIFIER",
      "CERTIFICATE_AUTHORIZER",
    ],
    default: "CONTENT_ADMIN",
  },
  activities: [
    {
      activity_type: {
        type: String,
        enum: [
          "REQUESTED",
          "APPROVED",
          "REJECTED",
          "VALIDATION_SUCCESS",
          "VALIDATION_FAILED",
          "REQUESTED_NEW_OTP",
          "WITHDRAWN",
          "SUCCESSFULLY_UPDATED",
        ],
        default: "REQUESTED",
      },
      activity_by: {
        type: String,
        enum: ["REQUESTER", "APPROVER"],
        default: "REQUESTER",
      },
      admin: {
        type: ObjectId,
        ref: "admin",
        required: true,
      },
      validation_data: {
        otp: {
          type: Number,
          required: false,
        },
        timestamp: {
          type: Date,
          required: false,
        },
        is_validated: {
          type: Boolean,
          default: false,
        },
      },
      remarks: {
        type: String,
        required: false,
      },
    },
  ],
  status: {
    type: String,
    enum: ["OPEN", "CLOSED"],
    default: "OPEN",
  },
});
resetPasswordSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});
mongoose.exports = mongoose.model("reset_password_schema", resetPasswordSchema);
