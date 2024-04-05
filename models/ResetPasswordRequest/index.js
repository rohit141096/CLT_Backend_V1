const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const requestActivitiesSchema = new Schema(
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
    user: {
      type: ObjectId,
      required: true,
      ref: "user",
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
  {
    timestamps: true,
  }
);

requestActivitiesSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

const resetPasswordRequestSchema = new Schema(
  {
    request_id: {
      type: Number,
      required: true,
      default: 0,
    },
    user: {
      type: ObjectId,
      required: true,
      ref: "user",
    },
    role: {
      type: String,
      enum: [
        // 'SUPER_ADMIN', Not required as super admin resets the password directly without anyones approval
        "ADMIN",
        "CREATOR",
        "MODERATOR",
        "APPROVER",
      ],
      default: "ADMIN",
    },
    activities: [requestActivitiesSchema],
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
    },
  },
  {
    timestamps: true,
  }
);

resetPasswordRequestSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model(
  "reset_password_request",
  resetPasswordRequestSchema
);
