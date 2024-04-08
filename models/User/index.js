const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

// const authorizedWebsiteSchema = new Schema(
//   {
//     website: {
//       type: ObjectId,
//       ref: "website",
//       required: false,
//     },
//     created_by: {
//       type: ObjectId,
//       ref: "user",
//       required: false,
//     },
//     is_active: {
//       type: Boolean,
//       default: true,
//     },
//     is_archived: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   {
//     timestamps: true,
//   }
// );

// authorizedWebsiteSchema.set("toJSON", {
//   transform: (doc, ret, options) => {
//     ret.id = ret._id;
//     delete ret._id;
//     delete ret.__v;
//   },
// });

const loginAttemptSchema = new Schema(
  {
    attempted_on: {
      type: Date,
      required: true,
    },
    attempt_result: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "PROCESSED"],
      default: "FAILURE",
    },
    attempt_stage: {
      type: String,
      enum: ["LOGIN", "VALIDATE_EMAIL", "VALIDATE_PHONE_NO", "VALIDATE_2FA"],
      default: "LOGIN",
    },
    remarks: {
      type: String,
      required: false,
    },
    metadata: {
      ip_address: {
        type: String,
        required: false,
      },
      country_code: {
        type: String,
        required: true,
      },
      country_name: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      pincode: {
        type: String,
        required: true,
      },
      latitude: {
        type: String,
        required: true,
      },
      longitude: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

loginAttemptSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

const userSchema = new Schema({
  first_name: {
    type: String,
    required: true,
    maxLength: 20,
  },
  last_name: {
    type: String,
    required: true,
  },
  email_data: {
    email_id: {
      type: String,
      required: true,
    },
    is_validated: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      required: false,
    },
  },
  phone_data: {
    phone_number: {
      type: String,
      required: true,
    },
    is_validated: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      required: false,
    },
  },
  two_factor_auth_data: {
    secret: {
      ascii: {
        type: String,
        required: true,
      },
      hex: {
        type: String,
        required: true,
      },
      base32: {
        type: String,
        required: true,
      },
      otpauth_url: {
        type: String,
        required: true,
      },
    },
    is_validated: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      required: false,
    },
  },
  password: {
    type: String,
    required: true,
  },
  profile_pic: {
    pic_type: {
      type: String,
      enum: ["AVATAR", "MEDIA"],
      default: "AVATAR",
    },
    avatar: {
      type: ObjectId,
      ref: "avatar",
      required: false,
    },
    media: {
      type: ObjectId,
      ref: "file",
      required: false,
    },
  },
  role: {
    type: String,
    enum: [
      "SUPER_ADMIN",
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
  created_by: {
    type: ObjectId,
    ref: "user",
    required: false,
  },
  recent_login_attempts: [loginAttemptSchema],
  is_active: {
    type: Boolean,
    default: true,
  },
  is_archived: {
    type: Boolean,
    default: false,
  },
});

userSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("user", userSchema);
