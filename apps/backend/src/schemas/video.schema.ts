import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VideoDocument = Video & Document;

export enum VideoStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Video {
  @Prop({ required: true })
  user_email: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true, enum: VideoStatus, default: VideoStatus.UPLOADED })
  status: VideoStatus;

  @Prop({ required: true })
  raw_file_path: string;

  @Prop({ type: String, default: null })
  output_file_path: string | null;

  @Prop({ type: Number, default: null })
  duration: number | null;

  @Prop({ type: String, default: null })
  resolution: string | null;

  @Prop({ type: Number, default: null })
  size: number | null;

  @Prop({ type: String, default: null })
  output_format: string | null;

  @Prop({ type: String, default: null })
  error_message: string | null;

  @Prop({
    type: [
      {
        format: { type: String, required: true },
        file_path: { type: String, required: true },
      },
    ],
    default: [],
  })
  converted_formats: Array<{ format: string; file_path: string }>;
}

export const VideoSchema = SchemaFactory.createForClass(Video);
