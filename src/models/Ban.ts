import mongoose, { Schema, Document } from 'mongoose';

export interface IBan extends Document {
  type: 'ip' | 'email';
  value: string;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BanSchema = new Schema<IBan>({
  type: { type: String, enum: ['ip', 'email'], required: true },
  value: { type: String, required: true, unique: true },
  reason: { type: String }
}, {
  timestamps: true
});

// Index for fast lookups
BanSchema.index({ type: 1, value: 1 });

export default mongoose.models.Ban || mongoose.model<IBan>('Ban', BanSchema);
