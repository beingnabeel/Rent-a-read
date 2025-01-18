import mongoose from 'mongoose';

const languageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Language name is required"],
      unique: true,
      trim: true,
      minlength: [2, "Language name must be at least 2 characters long"],
      maxlength: [50, "Language name cannot exceed 50 characters"],
    },
    code: {
      type: String,
      required: [true, "Language code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, "Language code must be at least 2 characters long"],
      maxlength: [3, "Language code cannot exceed 3 characters"],
      validate: {
        validator: function (v) {
          return /^[A-Z]{2,3}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid language code!`,
      },
    },
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "INACTIVE"],
        message: "{VALUE} is not a valid status",
      },
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

const languages = mongoose.model("languages", languageSchema);

export default languages;
