import mongoose from 'mongoose';

const reviewMediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
  },
  { _id: false }
);

const reviewSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    food: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Food',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: '',
    },
    // Lưu cả ảnh và video đính kèm
    images: {
      type: [reviewMediaSchema],
      default: [],
    },
    adminReply: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ food: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;
