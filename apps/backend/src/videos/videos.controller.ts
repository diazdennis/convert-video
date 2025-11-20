import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { diskStorage } from 'multer';
import { extname } from 'path';
import { VideosService } from './videos.service';
import { VideoProcessor } from './video-processor.processor';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { User } from 'src/schemas/user.schema';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const storage = diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/raw';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  const ext = extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new BadRequestException(
        `File format not supported. Allowed formats are: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`,
      ),
      false,
    );
  }
};

@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideosController {
  constructor(
    private videosService: VideosService,
    private videoProcessor: VideoProcessor,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage,
      fileFilter,
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
    }),
  )
  async uploadFiles(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @CurrentUser() user: User,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const videos = await Promise.all(
      files.map((file) => {
        if (file.size > MAX_FILE_SIZE) {
          throw new BadRequestException(
            `File ${file.originalname} is too large. Maximum size is 500MB.`,
          );
        }
        return this.videosService.createVideo(
          user.email,
          file.originalname,
          file.path,
        );
      }),
    );

    return { videos };
  }

  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.videosService.findAll(user.email);
  }

  @Get('formats')
  getFormats() {
    return { formats: this.videosService.getAvailableFormats() };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.videosService.findOne(id, user.email);
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('format') format: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const video = await this.videosService.findOne(id, user.email);
    let filePath: string;
    let outputFormat: string | undefined;

    // If format is specified, check if already converted or convert
    if (format) {
      const convertedPath = await this.videosService.getConvertedFormatPath(
        id,
        format.toLowerCase(),
      );

      if (convertedPath && fs.existsSync(convertedPath)) {
        // Use existing converted file
        filePath = convertedPath;
        outputFormat = format.toLowerCase();
      } else {
        // Convert on-demand
        filePath = await this.videoProcessor.convertVideoToFormat(
          id,
          user.email,
          video.raw_file_path,
          format.toLowerCase(),
        );
        outputFormat = format.toLowerCase();
      }
    } else {
      // No format specified, return raw file
      filePath = video.raw_file_path;
    }

    const filename = format
      ? `${path.parse(video.filename).name}.${format.toLowerCase()}`
      : video.filename;

    // Determine content type based on format
    const contentTypeMap: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      flv: 'video/x-flv',
    };

    const contentType =
      outputFormat && contentTypeMap[outputFormat]
        ? contentTypeMap[outputFormat]
        : 'video/mp4';

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);

    return res.sendFile(filePath, { root: '.' });
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    return await this.videosService.delete(id, user.email);
  }
}
