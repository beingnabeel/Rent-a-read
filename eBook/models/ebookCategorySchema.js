import mongoose from 'mongoose';

const eBookcategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a category title name'],
      minlength: [3, 'Title name should be at least 3 characters'],
      maxlength: [30, 'Category title cannot exceed 30 characters'],
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a category description'],
      minlength: [5, 'Description should be at least 5 characters'],
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE"
    },
    imageUrl: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const eBookCategory = mongoose.model('eBookCategory', eBookcategorySchema);

export default eBookCategory;
