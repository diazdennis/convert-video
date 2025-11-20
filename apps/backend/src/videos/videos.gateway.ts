import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { VideoDocument } from 'src/schemas/video.schema';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/videos',
})
export class VideosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VideosGateway.name);
  private userSockets = new Map<string, Set<string>>(); // userEmail -> Set of socketIds

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Get token from cookies or auth header
      const cookies = client.handshake.headers.cookie || '';
      const tokenMatch = cookies.match(/token=([^;]+)/);
      const token: string | undefined | null =
        tokenMatch?.[1] ||
        (client.handshake.auth?.token as string | undefined | null) ||
        client.handshake.headers?.authorization?.split(' ')[1] ||
        null;

      if (!token) {
        this.logger.warn('Connection rejected: No token provided');
        client.disconnect();
        return;
      }

      const payload: { email: string } =
        await this.jwtService.verifyAsync(token);
      const userEmail: string = payload.email;

      if (!userEmail) {
        this.logger.warn('Connection rejected: Invalid token');
        client.disconnect();
        return;
      }

      // Store user's socket
      if (!this.userSockets.has(userEmail)) {
        this.userSockets.set(userEmail, new Set());
      }
      this.userSockets.get(userEmail)!.add(client.id);
      (client.data as { userEmail: string }).userEmail = userEmail;

      this.logger.log(`Client connected: ${client.id} (User: ${userEmail})`);
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userEmail: string | undefined = (client.data as { userEmail: string })
      .userEmail;
    if (userEmail && this.userSockets.has(userEmail)) {
      this.userSockets.get(userEmail)!.delete(client.id);
      if (this.userSockets.get(userEmail)!.size === 0) {
        this.userSockets.delete(userEmail);
      }
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  notifyVideoProcessed(
    userEmail: string,
    videoId: string,
    video: VideoDocument,
  ) {
    const sockets = this.userSockets.get(userEmail);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('video-processed', {
          videoId,
          video,
        });
      });
    }
  }

  notifyFormatConverted(
    userEmail: string,
    videoId: string,
    format: string,
    filePath: string,
  ) {
    const sockets = this.userSockets.get(userEmail);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('format-converted', {
          videoId,
          format,
          filePath,
        });
      });
    }
  }
}
