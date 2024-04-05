const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const counterSchema = new Schema(
  {
    entity: {
      type: String,
      enum: [
        "RESET_PASSWORD_REQUEST",
        "FOLDER",
        "WEBSITE_TYPE",
        "HIERARCHY",
        "EXECUTOR_TYPE",
        "ADMINISTRATOR_ROLE",
        "AVATAR",
        "OFFICER",
      ],
      default: "RESET_PASSWORD_REQUEST",
    },
    count: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

counterSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("counter", counterSchema);
