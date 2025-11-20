# Video Conversion Admin Dashboard

A full-stack application for uploading, converting, and managing videos with automatic watermarking and multi-format conversion capabilities. Built with Next.js and NestJS in a Turbo monorepo.

## Features

- 🔐 **User Authentication**: JWT-based authentication with HttpOnly cookies
- 📤 **Video Upload**: Drag-and-drop interface with support for multiple files
- 🎬 **Multi-Format Conversion**: Automatic conversion to MP4, WebM, AVI, MOV, MKV, and FLV
- 💧 **Watermarking**: Automatic watermark with format identification (e.g., "Convert Video - Entvas - MP4")
- 📊 **Real-time Updates**: WebSocket-based real-time status updates
- 🗑️ **File Management**: Delete videos and all associated converted files
- 📱 **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- ⚡ **Async Processing**: Background job processing with BullMQ and Redis
- 🔍 **Duplicate Prevention**: Prevents uploading duplicate filenames per user

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, TypeScript
- **Backend**: NestJS 11, TypeScript
- **Monorepo**: Turbo
- **Video Processing**: FFmpeg
- **Job Queue**: BullMQ (Redis)
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with HttpOnly cookies
- **Real-time**: Socket.IO (WebSocket)
- **File Upload**: Multer
- **UI Components**: React Hot Toast for notifications

## Architectural Thinking


### Requirements & Key Features

The project was designed around these core requirements:
- User authentication and authorization
- Video file upload with validation
- Multi-format video conversion (MP4, WebM, AVI, MOV, MKV, FLV)
- Automatic watermarking with format identification
- Real-time processing status updates
- File management (view, download, delete)

### Technology Selection Process

#### Frontend: Next.js + React
- **Why**: Server-side rendering for SEO, modern App Router, excellent developer experience, built-in optimizations
- **Alternative Considered**: Create React App (no SSR), Vite (less features)

#### Backend: NestJS
- **Why**: TypeScript-first, modular architecture, built-in DI, enterprise-ready, decorator-based clean code
- **Alternative Considered**: Express (less structured), Fastify (smaller ecosystem)

#### Database: MongoDB
- **Why**: Document model fits flexible video metadata, easy array storage for converted formats, good read performance
- **Alternative Considered**: PostgreSQL (requires migrations, more structured)

#### Video Processing: FFmpeg (Backend)
- **Why**: Industry standard, supports all formats, fast native C library, full feature set
- **Alternative Considered**: FFmpeg.wasm (slower, limited codec support)

### Critical Decision: Frontend vs Backend Video Processing

**Decision**: Backend-based video processing

**Reasoning**:
- **Frontend Approach (WebAssembly)**:
  - ❌ Heavy performance impact on browser with large files
  - ❌ Very slow processing
  - ❌ Limited format support
  - ❌ Browser resource constraints

- **Backend Approach (FFmpeg)**:
  - ✅ Fast and stable processing
  - ✅ Handles large files efficiently
  - ✅ Full FFmpeg feature support
  - ✅ Better resource utilization
  - ⚠️ More complex architecture (workers, queues)

**Conclusion**: Backend approach chosen for robust, scalable foundation despite added complexity.

### Storage Decision: Local Filesystem vs Cloud Storage

**Decision**: Local filesystem storage (`uploads/raw/` and `uploads/processed/`)

**Reasoning**:
- **Cloud Storage (AWS S3, GCP)**:
  - ✅ Better for horizontal scaling
  - ✅ Production-ready
  - ❌ Requires premium account (cost consideration)
  - ❌ Additional setup complexity

- **Local Storage**:
  - ✅ Simple setup (no cloud account needed)
  - ✅ Fast direct access
  - ✅ No storage costs
  - ❌ Doesn't scale horizontally
  - ❌ Single point of failure

**Conclusion**: Local storage chosen due to project constraints. Architecture allows easy migration to cloud storage later.

### State Management: Context API vs Redux/Zustand

**Decision**: React Context API

**Reasoning**:
- **Context API**:
  - ✅ Sufficient for simple auth state
  - ✅ No additional dependencies
  - ✅ Built-in React feature
  - ✅ Less boilerplate

- **Redux/Zustand**:
  - ✅ Better for complex state
  - ❌ Overkill for this project size
  - ❌ More boilerplate
  - ❌ Additional learning curve

**Conclusion**: Context API chosen for simplicity. Can migrate to Redux/Zustand if state complexity grows.

### Architecture Principles

1. **Right Tool for the Job**: Avoid over-engineering; choose solutions that fit project scale
2. **Scalability**: Design allows growth (modules can become microservices, local storage can migrate to cloud)
3. **Developer Experience**: Prioritize maintainability and clear structure
4. **User Experience**: Real-time updates, fast responses, intuitive interface
5. **Cost Efficiency**: Balance features with implementation complexity and cost

### Design Patterns Used

- **Module-Based Architecture**: Feature-based modules (Auth, Videos)
- **Queue-Based Processing**: Asynchronous job processing with BullMQ
- **WebSocket Gateway**: Real-time updates via Socket.IO
- **Dependency Injection**: NestJS DI container
- **Repository Pattern**: Service layer abstracts data access


## Project Structure

```
.
├── apps/
│   ├── frontend/          # Next.js application
│   │   ├── app/          # App router pages (login, signup, dashboard)
│   │   ├── components/   # React components
│   │   ├── contexts/     # React contexts (AuthContext)
│   │   └── lib/          # API utilities and Socket.IO client
│   └── backend/          # NestJS application
│       ├── src/
│       │   ├── auth/     # Authentication module
│       │   ├── schemas/  # MongoDB schemas
│       │   └── videos/   # Video processing module
│       └── uploads/      # Video storage (raw/ and processed/)
├── package.json          # Root package.json with Turbo scripts
└── turbo.json            # Turbo configuration
```

## Prerequisites

**⚠️ Linux or macOS environment is required to run this application.**

- Node.js >= 18.0.0
- FFmpeg installed on your system
- MongoDB running locally or connection string
- Redis running locally (for BullMQ)
- Linux operating system (macOS support available for development)

### Installing FFmpeg

- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt-get install ffmpeg` or `sudo yum install ffmpeg`

### Installing Redis

- **macOS**: `brew install redis && redis-server`
- **Linux**: `sudo apt-get install redis-server && redis-server`

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

**Backend** (`apps/backend/.env`):

```env
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MONGODB_URI=mongodb://localhost:27017/video-converter
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

**Frontend** (`apps/frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Start MongoDB and Redis

Make sure MongoDB and Redis are running before starting the application.

**Note**: This application is designed to run on Linux. While macOS instructions are provided for development purposes, production deployment requires a Linux environment.

### 4. Run Development Servers

```bash
npm run dev
```

The frontend will be available at http://localhost:3000  
The backend will be available at http://localhost:3001

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **HttpOnly Cookies**: Prevents XSS attacks on tokens
- **Password Hashing**: bcrypt with salt rounds
- **CORS Protection**: Configured for specific frontend origin
- **Input Validation**: Class-validator for request validation
- **File Type Validation**: Strict file extension checking
- **User Isolation**: Users can only access their own videos
- **Duplicate Prevention**: Prevents uploading duplicate filenames per user

## Supported Video Formats

### Input Formats

- MP4 (`.mp4`)
- MOV (`.mov`)
- AVI (`.avi`)
- MKV (`.mkv`)
- WebM (`.webm`)

### Output Formats

All input formats can be converted to:

- MP4
- WebM
- AVI
- MOV
- MKV
- FLV

### Browser Compatibility

**Important Note**: Not all formats are playable directly in web browsers:

- ✅ **Browser-Compatible Formats**: MP4, WebM, MOV, MKV (with proper codecs)
- ❌ **Not Browser-Compatible**: AVI and FLV formats cannot be displayed/played in browsers

**Why This Matters**:
- AVI and FLV files are converted successfully on the backend
- These format-specific files can be downloaded but cannot be previewed/played in the browser
- Users can download AVI/FLV files for use in desktop media players or other applications
- For browser playback, use MP4 or WebM formats

## Video Processing Details

- **FFmpeg Preset**: `fast` for optimal speed/quality balance
- **CRF**: 23 (constant rate factor for quality)
- **Threading**: Multi-threaded processing (`-threads 0`)
- **Watermark**: Centered text with format identifier
- **Codecs**:
  - MP4/MOV/MKV: H.264 (libx264) + AAC
  - WebM: VP9 (libvpx-vp9) + Opus
  - AVI/FLV: H.264 (libx264) + MP3

## Development

### Backend Development

```bash
cd apps/backend
npm run start:dev
```

### Frontend Development

```bash
cd apps/frontend
npm run dev
```

### Running Tests

```bash
# Backend tests
cd apps/backend
npm test

# E2E tests
npm run test:e2e
```

### Linting

```bash
# Lint all packages
npm run lint

# Lint specific package
cd apps/backend && npm run lint
cd apps/frontend && npm run lint
```

## Production Build

```bash
# Build all packages
npm run build

# Start production servers
npm run start
```

### Production Considerations

- Set strong `JWT_SECRET` in environment variables
- Use production MongoDB instance
- Configure Redis for high availability
- Set up proper file storage (consider cloud storage for scalability)
- Configure reverse proxy (nginx) for frontend
- Set up SSL/TLS certificates
- Monitor disk space for video storage
- Configure FFmpeg paths if not in system PATH
- Set up logging and monitoring
- Configure CORS for production domain

## File Storage

- **Raw Videos**: `apps/backend/uploads/raw/`
- **Processed Videos**: `apps/backend/uploads/processed/`
- Files are stored with unique timestamps to prevent conflicts
- All files are deleted when a video record is deleted

## Troubleshooting

### FFmpeg Not Found

Ensure FFmpeg is installed and available in system PATH:

```bash
ffmpeg -version
```

### Redis Connection Error

Ensure Redis is running:

```bash
redis-cli ping
# Should return: PONG
```

### MongoDB Connection Error

Check MongoDB connection string and ensure MongoDB is running:

```bash
mongosh mongodb://localhost:27017/video-converter
```

### WebSocket Connection Issues

- Check CORS configuration matches frontend URL
- Verify JWT token is being sent in cookies
- Check browser console for connection errors

### Video Processing Fails

- Check FFmpeg installation and codec support
- Verify sufficient disk space
- Check file permissions on upload directories
- Review backend logs for FFmpeg errors

## Notes

- Videos are stored locally in `uploads/raw/` and `uploads/processed/`
- Raw videos are kept after processing
- Watermark includes format identifier (e.g., "Convert Video - Entvas - MP4")
- Video processing happens asynchronously via BullMQ queue
- Status remains "processing" during format conversions, then changes to "completed"
- All converted formats are processed in parallel for better performance
- Duplicate filename uploads are prevented per user
- Error messages are displayed via toast notifications
- Real-time updates via WebSocket eliminate need for page refreshes
