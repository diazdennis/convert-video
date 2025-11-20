"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { videosApi, Video, VideoFormat } from "../lib/api";
import { FormatSelectorModal } from "./FormatSelectorModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { getSocket } from "../lib/socket";

export function VideoList({ refreshTrigger }: { refreshTrigger?: number }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const formatsRef = useRef<VideoFormat[]>([]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const data = await videosApi.getAll();
      setVideos(data);
      setError("");
      
      // Show toast notifications for videos with error messages
      data.forEach((video) => {
        if (video.error_message) {
          toast.error(`Video "${video.filename}" error: ${video.error_message}`, {
            duration: 5000,
          });
        }
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load videos. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchFormats = async () => {
      try {
        const formats = await videosApi.getFormats();
        formatsRef.current = formats;
      } catch (err) {
        console.error("Failed to load formats:", err);
      }
    };

    fetchVideos();
    fetchFormats();

    // Set up WebSocket connection for real-time updates
    const socket = getSocket();

    socket.on("video-processed", (data: { videoId: string; video: Video }) => {
      // Get previous video state before updating
      let prevVideo: Video | undefined;
      setVideos((prevVideos) => {
        prevVideo = prevVideos.find((v) => v._id === data.videoId);
        return prevVideos.map((v) =>
          v._id === data.videoId ? { ...data.video, _id: data.videoId } : v,
        );
      });

      // Show toast notifications after state update (outside of setState callback)
      if (prevVideo) {
        // Show toast notification for status changes
        if (prevVideo.status !== data.video.status) {
          if (data.video.status === "completed") {
            toast.success(
              `Video "${data.video.filename}" processed successfully!`,
              {
                duration: 4000,
              },
            );
          } else if (data.video.status === "failed") {
            const errorMsg = data.video.error_message
              ? `Video "${data.video.filename}" processing failed: ${data.video.error_message}`
              : `Video "${data.video.filename}" processing failed`;
            toast.error(errorMsg, {
              duration: 5000,
            });
          }
        }
        
        // Show toast if error message is updated
        if (data.video.error_message && prevVideo.error_message !== data.video.error_message) {
          toast.error(`Video "${data.video.filename}" error: ${data.video.error_message}`, {
            duration: 5000,
          });
        }
      }
    });

    socket.on(
      "format-converted",
      (data: { videoId: string; format: string; filePath: string }) => {
        // Get format label
        const formatLabel =
          formatsRef.current.find((f) => f.value === data.format)?.label ||
          data.format.toUpperCase();

        // Show notification
        toast.success(`${formatLabel} format converted successfully!`, {
          duration: 4000,
        });

        // Update video list state directly without refetching
        setVideos((prevVideos) => {
          return prevVideos.map((video) => {
            if (video._id === data.videoId) {
              const existingFormatIndex = video.converted_formats?.findIndex(
                (cf) => cf.format === data.format
              ) ?? -1;

              const updatedFormats = [...(video.converted_formats || [])];
              
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

              return {
                ...video,
                converted_formats: updatedFormats,
              };
            }
            return video;
          });
        });
      },
    );

    return () => {
      socket.off("video-processed");
      socket.off("format-converted");
    };
  }, []);

  // Refresh when upload completes
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchVideos();
    }
  }, [refreshTrigger]);

  const handleDeleteClick = (video: Video) => {
    setVideoToDelete(video);
  };

  const handleDeleteConfirm = async () => {
    if (!videoToDelete) return;

    try {
      setIsDeleting(true);
      await videosApi.delete(videoToDelete._id);
      toast.success(`Video "${videoToDelete.filename}" deleted successfully`, {
        duration: 3000,
      });
      setVideoToDelete(null);
      fetchVideos();
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

  const getStatusBadge = (status: string) => {
    const colors = {
      uploaded: "bg-gray-100 text-gray-800",
      processing: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
          colors[status as keyof typeof colors] || colors.uploaded
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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

  if (loading && videos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading videos...</div>
      </div>
    );
  }

  if (error && videos.length === 0) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-800">{error}</div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">
          No videos uploaded yet. Upload your first video to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow">
      {/* Mobile View - Table-like Layout */}
      <div className="md:hidden divide-y divide-gray-200">
        {videos.map((video) => (
          <div key={video._id} className="p-4">
            <div className="space-y-2 text-sm">
              <div className="flex border-b border-gray-100 pb-2">
                <div className="w-24 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Filename
                </div>
                <div className="flex-1 text-gray-900 truncate">
                  {video.filename}
                </div>
              </div>
              <div className="flex border-b border-gray-100 pb-2">
                <div className="w-24 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </div>
                <div className="flex-1">
                  {getStatusBadge(video.status)}
                  {video.error_message && (
                    <div className="mt-1 text-xs text-red-600">
                      {video.error_message}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex border-b border-gray-100 pb-2">
                <div className="w-24 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Duration
                </div>
                <div className="flex-1 text-gray-900">
                  {formatDuration(video.duration)}
                </div>
              </div>
              <div className="flex border-b border-gray-100 pb-2">
                <div className="w-24 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Size
                </div>
                <div className="flex-1 text-gray-900">
                  {formatFileSize(video.size)}
                </div>
              </div>
              <div className="flex border-b border-gray-100 pb-2">
                <div className="w-24 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Created
                </div>
                <div className="flex-1 text-gray-900">
                  {new Date(video.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex pt-1">
                <div className="w-24 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </div>
                <div className="flex-1 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/videos/${video._id}`}
                    className="text-blue-600 hover:text-blue-900 font-medium"
                  >
                    View
                  </Link>
                  {(video.status === "completed" || video.status === "processing") && (
                    <button
                      onClick={() => setSelectedVideo(video)}
                      disabled={downloading}
                      className="text-green-600 hover:text-green-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Download
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteClick(video)}
                    className="text-red-600 hover:text-red-900 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View - Table Layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                File Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {videos.map((video) => (
              <tr key={video._id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {video.filename}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {getStatusBadge(video.status)}
                  {video.error_message && (
                    <div className="mt-1 text-xs text-red-600">
                      {video.error_message}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {formatDuration(video.duration)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {formatFileSize(video.size)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {new Date(video.createdAt).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <Link
                      href={`/dashboard/videos/${video._id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </Link>
                    {video.status === "completed" && (
                      <button
                        onClick={() => setSelectedVideo(video)}
                        disabled={downloading}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Download
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteClick(video)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedVideo && (
        <FormatSelectorModal
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onSelectFormat={async (format: string) => {
            if (!selectedVideo) return;
            try {
              setDownloading(true);
              const blob = await videosApi.download(selectedVideo._id, format);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              const baseFilename = selectedVideo.filename.replace(
                /\.[^/.]+$/,
                "",
              );
              a.download = `${baseFilename}.${format}`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
              setSelectedVideo(null);
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
          }}
          videoFilename={selectedVideo.filename}
        />
      )}

      {videoToDelete && (
        <DeleteConfirmationModal
          isOpen={!!videoToDelete}
          onClose={() => setVideoToDelete(null)}
          onConfirm={handleDeleteConfirm}
          videoFilename={videoToDelete.filename}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
