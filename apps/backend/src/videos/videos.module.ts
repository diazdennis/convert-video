import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VideoProcessor } from './video-processor.processor';
import { VideosGateway } from './videos.gateway';
import { Video, VideoSchema } from '../schemas/video.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    BullModule.registerQueue({
      name: 'video-processing',
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
    }),
  ],
  controllers: [VideosController],
  providers: [VideosService, VideoProcessor, VideosGateway],
  exports: [VideosGateway],
})
export class VideosModule {}
