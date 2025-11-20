import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { VideosService } from './videos.service';
import { VideosGateway } from './videos.gateway';
import { VideoDocument, VideoStatus } from '../schemas/video.schema';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

@Processor('video-processing')
@Injectable()
export class VideoProcessor {
  private readonly logger = new Logger(VideoProcessor.name);

  constructor(
    private videosService: VideosService,
    @Inject(forwardRef(() => VideosGateway))
    private videosGateway: VideosGateway,
  ) {}

  @Process('process-video')
  async handleVideoProcessing(job: Job) {
    const { videoId, rawFilePath } = job.data as {
      videoId: string;
      rawFilePath: string;
    };
    try {
      // Get video to access user_email
      const video: VideoDocument = await this.videosService.findOne(videoId);
      const userEmail = video.user_email;

      // Update status to processing
      await this.videosService.updateVideoStatus(
        videoId,
        VideoStatus.PROCESSING,
      );

      // Get video metadata from raw file (no conversion yet)
      const normalizedProbePath = path.resolve(rawFilePath).replace(/\\/g, '/');
      const probeCommand = `ffprobe -v error -show_entries format=duration:stream=width,height -of json "${normalizedProbePath}"`;
      const { stdout } = await execAsync(probeCommand);
      const metadata = JSON.parse(stdout) as {
        format?: { duration: string };
        streams?: { width: number; height: number }[];
      };

      const duration = metadata.format?.duration
        ? parseFloat(metadata.format.duration)
        : null;
      const width = metadata.streams?.[0]?.width ?? null;
      const height = metadata.streams?.[0]?.height ?? null;
      const resolution = width && height ? `${width}x${height}` : null;
      const stats = fs.statSync(rawFilePath);
      const size = stats.size;

      // Update metadata but keep status as PROCESSING
      const updatedVideo = await this.videosService.updateVideoStatus(
        videoId,
        VideoStatus.PROCESSING,
        {
          duration,
          resolution,
          size,
        },
      );

      // Notify user via WebSocket that metadata extraction is complete
      if (updatedVideo) {
        this.videosGateway.notifyVideoProcessed(
          userEmail,
          videoId,
          updatedVideo.toObject() as VideoDocument,
        );
      }

      this.logger.log(`Video ${videoId} metadata extracted successfully`);

      // Automatically convert to all available formats in parallel for better performance
      const formats = this.videosService.getAvailableFormats();
      this.logger.log(
        `Starting automatic conversion to ${formats.length} formats for video ${videoId}`,
      );

      // Convert all formats in parallel for better performance
      // Each conversion will notify via WebSocket when complete
      await Promise.allSettled(
        formats.map(async (format) => {
          try {
            await this.convertVideoToFormat(
              videoId,
              userEmail,
              rawFilePath,
              format.value,
            );
            this.logger.log(
              `Successfully converted video ${videoId} to ${format.value}`,
            );
          } catch (error: unknown) {
            this.logger.error(
              `Failed to convert video ${videoId} to ${format.value}:`,
              error instanceof Error ? error.message : String(error),
            );
            // Continue with other formats even if one fails
          }
        }),
      );

      this.logger.log(`Completed automatic conversion for video ${videoId}`);

      // Update status to COMPLETED after all conversions are done
      const finalVideo = await this.videosService.updateVideoStatus(
        videoId,
        VideoStatus.COMPLETED,
      );

      // Notify user via WebSocket that all processing is complete
      if (finalVideo) {
        this.videosGateway.notifyVideoProcessed(
          userEmail,
          videoId,
          finalVideo.toObject() as VideoDocument,
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing video ${videoId}:`, errorMessage);
      await this.videosService.updateVideoStatus(videoId, VideoStatus.FAILED, {
        error_message: errorMessage.substring(0, 500),
      });
    }
  }

  async convertVideoToFormat(
    videoId: string,
    userEmail: string,
    rawFilePath: string,
    outputFormat: string,
  ): Promise<string> {
    // Ensure processed directory exists
    const processedDir = './uploads/processed';
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }

    // Generate output file path
    const outputFileName = `processed-${Date.now()}.${outputFormat}`;
    const outputFilePath = path.join(processedDir, outputFileName);

    // Watermark text (escape single quotes for FFmpeg)
    const formatUpper = outputFormat.toUpperCase();
    const watermarkText = `Convert Video - Entvas - ${formatUpper}`;
    const escapedText = watermarkText.replace(/'/g, "\\'");

    // Normalize paths for cross-platform compatibility
    const normalizedInputPath = path.resolve(rawFilePath).replace(/\\/g, '/');
    const normalizedOutputPath = path
      .resolve(outputFilePath)
      .replace(/\\/g, '/');

    // Determine codec based on format
    let videoCodec = 'libx264';
    let audioCodec = 'aac';

    switch (outputFormat.toLowerCase()) {
      case 'mp4':
        videoCodec = 'libx264';
        audioCodec = 'aac';
        break;
      case 'webm':
        videoCodec = 'libvpx-vp9';
        audioCodec = 'libopus';
        break;
      case 'avi':
        videoCodec = 'libx264';
        audioCodec = 'mp3';
        break;
      case 'mov':
        videoCodec = 'libx264';
        audioCodec = 'aac';
        break;
      case 'mkv':
        videoCodec = 'libx264';
        audioCodec = 'aac';
        break;
      case 'flv':
        videoCodec = 'libx264';
        audioCodec = 'mp3';
        break;
      default:
        videoCodec = 'libx264';
        audioCodec = 'aac';
    }

    // FFmpeg command to convert and add watermark
    // Using faster preset and optimized settings for better performance
    const ffmpegCommand = `ffmpeg -i "${normalizedInputPath}" -vf "drawtext=text='${escapedText}':fontcolor=green:fontsize=32:font='cursive':x=(w-text_w)/2:y=(h-text_h)/2" -c:v ${videoCodec} -c:a ${audioCodec} -preset fast -crf 23 -threads 0 "${normalizedOutputPath}"`;

    this.logger.log(`Converting video to ${outputFormat} format...`);
    this.logger.debug(`FFmpeg command: ${ffmpegCommand}`);

    // Execute FFmpeg
    await execAsync(ffmpegCommand);

    // Store converted format in database
    await this.videosService.addConvertedFormat(
      videoId,
      outputFormat.toLowerCase(),
      outputFilePath,
    );

    // Notify user via WebSocket
    this.videosGateway.notifyFormatConverted(
      userEmail,
      videoId,
      outputFormat.toLowerCase(),
      outputFilePath,
    );

    return outputFilePath;
  }
}
