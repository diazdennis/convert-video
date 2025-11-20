"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { ProtectedRoute } from "../../../../components/ProtectedRoute";
import { FormatSelectorModal } from "../../../../components/FormatSelectorModal";
import { DeleteConfirmationModal } from "../../../../components/DeleteConfirmationModal";
import { videosApi, Video, VideoFormat } from "../../../../lib/api";
import { getSocket } from "../../../../lib/socket";
import { AxiosError } from "axios";
import { Header } from "../../../../components/Header";
import { Footer } from "../../../../components/Footer";

function VideoDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [availableFormats, setAvailableFormats] = useState<VideoFormat[]>([]);
  const formatsRef = useRef<VideoFormat[]>([]);
  const videoRef = useRef<Video | null>(null);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        const data = await videosApi.getOne(params.id as string);
        setVideo(data);
        videoRef.current = data;
        setError("");
        
        // Show toast if video has an error message
        if (data.error_message) {
          toast.error(`Video processing error: ${data.error_message}`, {
            duration: 5000,
          });
        }
      } catch (err: unknown) {
        if (err instanceof AxiosError && err.response?.status === 404) {
          setError("Video not found.");
        } else {
          setError("Failed to load video details. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    const fetchFormats = async () => {
      try {
        const formats = await videosApi.getFormats();
        setAvailableFormats(formats);
        formatsRef.current = formats;
      } catch (err) {
        console.error("Failed to load formats:", err);
      }
    };

    fetchVideo();
    fetchFormats();

    // Set up WebSocket connection
    const socket = getSocket();

    socket.on("video-processed", (data: { videoId: string; video: Video }) => {
      if (data.videoId === params.id) {
        const oldStatus = videoRef.current?.status;
        const oldErrorMessage = videoRef.current?.error_message;
        setVideo(data.video);
        videoRef.current = data.video;

        // Show toast notification for status changes
        if (oldStatus && oldStatus !== data.video.status) {
          if (data.video.status === "completed") {
            toast.success("Video processed successfully!", {
              duration: 4000,
            });
          } else if (data.video.status === "failed") {
            const errorMsg = data.video.error_message 
              ? `Video processing failed: ${data.video.error_message}`
              : "Video processing failed";
            toast.error(errorMsg, {
              duration: 5000,
            });
          }
        }
        
        // Show toast if error message is updated
        if (data.video.error_message && data.video.error_message !== oldErrorMessage) {
          toast.error(`Video error: ${data.video.error_message}`, {
            duration: 5000,
          });
        }
      }
    });

    socket.on(
      "format-converted",
      (data: { videoId: string; format: string; filePath: string }) => {
        if (data.videoId === params.id) {
          // Show toast notification
          const formatLabel =
            formatsRef.current.find((f) => f.value === data.format)?.label ||
            data.format.toUpperCase();
          toast.success(`${formatLabel} format converted successfully!`, {
            duration: 4000,
          });

          // Update video state directly without refetching
          setVideo((prevVideo) => {
            if (!prevVideo) return prevVideo;
            
            const existingFormatIndex = prevVideo.converted_formats?.findIndex(
              (cf) => cf.format === data.format
            ) ?? -1;

            const updatedFormats = [...(prevVideo.converted_formats || [])];
            
            if (existingFormatIndex >= 0) {
              // Update existing format
              updatedFormats[existingFormatIndex] = {
                format: data.format,
                file_path: data.filePath,
              };
            } else {
              // Add new format
              updatedFormats.push({
                format: data.format,
                file_path: data.filePath,
              });
            }

            const updatedVideo = {
              ...prevVideo,
              converted_formats: updatedFormats,
            };
            videoRef.current = updatedVideo;
            return updatedVideo;
          });
        }
      },
    );

    return () => {
      socket.off("video-processed");
      socket.off("format-converted");
    };
  }, [params.id]);

  const handleDownloadClick = () => {
    setShowFormatModal(true);
  };

  const handleFormatSelect = async (format: string) => {
    if (!video) return;
    try {
      setDownloading(true);
      const blob = await videosApi.download(video._id, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseFilename = video.filename.replace(/\.[^/.]+$/, "");
      a.download = `${baseFilename}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to download video. Please try again.",
        {
          duration: 5000,
        },
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!video) return;

    try {
      setIsDeleting(true);
      await videosApi.delete(video._id);
      toast.success(`Video "${video.filename}" deleted successfully`, {
        duration: 3000,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to delete video. Please try again.",
        {
          duration: 5000,
        },
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header />
        <main className="flex-1 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">
              {error || "Video not found"}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      <main className="flex-1 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {video.filename}
            </h1>
          </div>

          <div className="px-6 py-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  Video Information
                </h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Status
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          video.status === "processing"
                            ? "bg-yellow-100 text-yellow-800"
                            : video.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : video.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {video.status.charAt(0).toUpperCase() +
                          video.status.slice(1)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Duration
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDuration(video.duration)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Resolution
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {video.resolution || "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      File Size
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatFileSize(video.size)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Created
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(video.createdAt).toLocaleString()}
                    </dd>
                  </div>
                  {video.error_message && (
                    <div>
                      <dt className="text-sm font-medium text-red-500">
                        Error
                      </dt>
                      <dd className="mt-1 text-sm text-red-600">
                        {video.error_message}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {(video.status === "completed" || video.status === "processing") && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">
                    Video Preview
                  </h2>

                  {/* Format Selection */}
                  <div className="mb-4">
                    <h3 className="mb-2 text-sm font-medium text-gray-700">
                      Available Formats:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedFormat(null)}
                        className={`rounded-md px-3 py-1 text-sm font-medium ${
                          selectedFormat === null
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        Original
                      </button>
                      {availableFormats.map((format) => {
                        const isConverted = (video.converted_formats || []).some(
                          (cf) => cf.format === format.value,
                        );
                        return (
                          <button
                            key={format.value}
                            onClick={() => setSelectedFormat(format.value)}
                            className={`rounded-md px-3 py-1 text-sm font-medium ${
                              selectedFormat === format.value
                                ? "bg-blue-600 text-white"
                                : isConverted
                                  ? "bg-green-200 text-green-800 hover:bg-green-300"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                          >
                            {format.label}
                            {isConverted && " ✓"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-100 p-4">
                    <video
                      controls
                      className="w-full rounded"
                      src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/videos/${video._id}/download${selectedFormat ? `?format=${selectedFormat}` : ""}`}
                      key={selectedFormat || "original"}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex space-x-4">
              {(video.status === "completed" || video.status === "processing") && (
                <button
                  onClick={handleDownloadClick}
                  disabled={downloading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloading ? "Downloading..." : "Download Video"}
                </button>
              )}
              <button
                onClick={handleDeleteClick}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete Video
              </button>
            </div>
          </div>
        </div>
      </main>

      <FormatSelectorModal
        isOpen={showFormatModal}
        onClose={() => setShowFormatModal(false)}
        onSelectFormat={handleFormatSelect}
        videoFilename={video.filename}
      />

      {video && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          videoFilename={video.filename}
          isDeleting={isDeleting}
        />
      )}

      <Footer />
    </div>
  );
}

export default function VideoDetailsPage() {
  return (
    <ProtectedRoute>
      <VideoDetailsContent />
    </ProtectedRoute>
  );
}
