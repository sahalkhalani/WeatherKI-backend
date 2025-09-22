import mongoose, { Document, Schema } from 'mongoose';

export interface IWidget extends Document {
  _id: string;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

const WidgetSchema: Schema = new Schema({
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
    minlength: [2, 'Location must be at least 2 characters long'],
    maxlength: [100, 'Location must be less than 100 characters'],
  },
}, {
  timestamps: true,
});

WidgetSchema.index({ location: 1 });
WidgetSchema.index({ createdAt: -1 });

WidgetSchema.virtual('formattedCreatedAt').get(function() {
  return (this.createdAt as Date).toLocaleDateString();
});

WidgetSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete (ret as any).__v;
    return ret;
  }
});

export default mongoose.model<IWidget>('Widget', WidgetSchema);