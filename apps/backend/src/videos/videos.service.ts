import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Video, VideoDocument, VideoStatus } from '../schemas/video.schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VideosService {
  private readonly SUPPORTED_FORMATS = [
    { value: 'mp4', label: 'MP4' },
    { value: 'webm', label: 'WebM' },
    { value: 'avi', label: 'AVI' },
    { value: 'mov', label: 'MOV' },
    { value: 'mkv', label: 'MKV' },
    { value: 'flv', label: 'FLV' },
  ];

  constructor(
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    @InjectQueue('video-processing') private videoQueue: Queue,
  ) {}

  async createVideo(userEmail: string, filename: string, rawFilePath: string) {
    // Check for duplicate filename for this user
    const existingVideo = await this.videoModel.findOne({
      user_email: userEmail,
      filename: filename,
    });

    if (existingVideo) {
      throw new BadRequestException(
        `A video with filename "${filename}" already exists`,
      );
    }

    const video = new this.videoModel({
      user_email: userEmail,
      filename,
      status: VideoStatus.UPLOADED,
      raw_file_path: rawFilePath,
    });

    await video.save();

    // Add to processing queue
    await this.videoQueue.add('process-video', {
      videoId: video._id.toString(),
      rawFilePath,
    });

    return video;
  }

  async findAll(userEmail: string) {
    return this.videoModel
      .find({ user_email: userEmail })
      .sort({ createdAt: -1 });
  }

  async findOne(id: string, userEmail?: string): Promise<VideoDocument> {
    const query: FilterQuery<VideoDocument> = { _id: id };
    if (userEmail) {
      query.user_email = userEmail;
    }

    const video = await this.videoModel.findOne(query);

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return video;
  }

  getAvailableFormats() {
    return this.SUPPORTED_FORMATS;
  }

  getSupportedFormatValues(): string[] {
    return this.SUPPORTED_FORMATS.map((f) => f.value);
  }

  validateFormat(format: string): boolean {
    return this.SUPPORTED_FORMATS.some((f) => f.value === format.toLowerCase());
  }

  async getVideoStream(id: string, userEmail: string, format?: string) {
    const video = await this.findOne(id, userEmail);

    if (
      video.status !== VideoStatus.COMPLETED &&
      video.status !== VideoStatus.PROCESSING
    ) {
      throw new BadRequestException('Video is not ready for download');
    }

    if (!fs.existsSync(video.raw_file_path)) {
      throw new NotFoundException('Video file not found');
    }

    // If format is specified, validate it
    if (format) {
      if (!this.validateFormat(format)) {
        throw new BadRequestException(
          `Invalid format. Supported formats: ${this.SUPPORTED_FORMATS.map((f) => f.value).join(', ')}`,
        );
      }
      // Return raw file path and format info - conversion will be handled by controller
      const baseFilename = path.parse(video.filename).name;
      const filename = `${baseFilename}.${format.toLowerCase()}`;

      return {
        filePath: video.raw_file_path,
        filename,
        format: format.toLowerCase(),
        needsConversion: true,
      };
    }

    // If no format specified, return raw file info
    return {
      filePath: video.raw_file_path,
      filename: video.filename,
      needsConversion: false,
    };
  }

  async delete(id: string, userEmail: string): Promise<{ message: string }> {
    const video = await this.findOne(id, userEmail);

    // Delete raw file
    if (fs.existsSync(video.raw_file_path)) {
      try {
        fs.unlinkSync(video.raw_file_path);
      } catch (error) {
        // Log but continue with other deletions
        console.error(
          `Failed to delete raw file: ${video.raw_file_path}`,
          error,
        );
      }
    }

    // Delete output file if exists
    if (video.output_file_path && fs.existsSync(video.output_file_path)) {
      try {
        fs.unlinkSync(video.output_file_path);
      } catch (error) {
        console.error(
          `Failed to delete output file: ${video.output_file_path}`,
          error,
        );
      }
    }

    // Delete all converted format files
    if (video.converted_formats && video.converted_formats.length > 0) {
      for (const convertedFormat of video.converted_formats) {
        if (
          convertedFormat.file_path &&
          fs.existsSync(convertedFormat.file_path)
        ) {
          try {
            fs.unlinkSync(convertedFormat.file_path);
          } catch (error) {
            console.error(
              `Failed to delete converted file: ${convertedFormat.file_path}`,
              error,
            );
          }
        }
      }
    }

    await this.videoModel.deleteOne({ _id: id });
    return { message: 'Video deleted successfully' };
  }

  async updateVideoStatus(
    videoId: string,
    status: VideoStatus,
    data?: Partial<VideoDocument>,
  ): Promise<VideoDocument | null> {
    const updateData: Partial<VideoDocument> = { status };

    if (data?.output_file_path)
      updateData.output_file_path = data.output_file_path;
    if (data?.duration) updateData.duration = data.duration;
    if (data?.resolution) updateData.resolution = data.resolution;
    if (data?.size) updateData.size = data.size;
    if (data?.output_format) updateData.output_format = data.output_format;
    if (data?.error_message) updateData.error_message = data.error_message;

    const video = await this.videoModel.findByIdAndUpdate(
      { _id: videoId },
      updateData,
      { new: true },
    );
    return video;
  }

  async addConvertedFormat(
    videoId: string,
    format: string,
    filePath: string,
  ): Promise<VideoDocument> {
    const video = await this.videoModel.findById(videoId);
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Check if format already exists
    const existingFormat = video.converted_formats.find(
      (cf) => cf.format === format,
    );
    if (existingFormat) {
      // Update existing format
      existingFormat.file_path = filePath;
    } else {
      // Add new format
      video.converted_formats.push({ format, file_path: filePath });
    }

    await video.save();
    return video;
  }

  async getConvertedFormatPath(
    videoId: string,
    format: string,
  ): Promise<string | null> {
    const video = await this.videoModel.findById(videoId);
    if (!video) {
      return null;
    }

    const convertedFormat = video.converted_formats.find(
      (cf) => cf.format === format,
    );
    return convertedFormat?.file_path || null;
  }
}
