"use client";

import { useState, useCallback } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import { videosApi } from "../lib/api";
import { AxiosError } from "axios";
import toast from "react-hot-toast";

const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

interface UploadProgress {
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

export function VideoUpload({
  onUploadComplete,
}: {
  onUploadComplete: () => void;
}) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {

      // Handle rejected files
      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach((err: unknown) => {
          if (
            err instanceof Error &&
            "code" in err &&
            err.code === "file-too-large"
          ) {
            const errorMsg = `File ${file.name} is too large. Maximum size is 500MB.`;
            toast.error(errorMsg, {
              duration: 5000,
            });
          } else if (
            err instanceof Error &&
            "code" in err &&
            err.code === "file-invalid-type"
          ) {
            const errorMsg = `File format not supported. Allowed formats are: ${ALLOWED_EXTENSIONS.join(", ").toUpperCase()}`;
            toast.error(errorMsg, {
              duration: 5000,
            });
          }
        });
      });

      if (acceptedFiles.length === 0) return;

      // Initialize upload progress
      const newUploads: UploadProgress[] = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: "uploading",
      }));
      setUploads(newUploads);

      try {
        await videosApi.upload(acceptedFiles);

        // Mark all as success
        setUploads((prev) =>
          prev.map((upload) => ({
            ...upload,
            progress: 100,
            status: "success",
          })),
        );

        // Show success toast
        if (acceptedFiles.length === 1) {
          toast.success(`Video "${acceptedFiles[0].name}" uploaded successfully!`, {
            duration: 4000,
          });
        } else {
          toast.success(`${acceptedFiles.length} videos uploaded successfully!`, {
            duration: 4000,
          });
        }

        setTimeout(() => {
          setUploads([]);
          onUploadComplete();
        }, 2000);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof AxiosError
            ? err.response?.data?.message
            : "Upload failed. Please try again.";
        toast.error(errorMessage, {
          duration: 5000,
        });
        setUploads((prev) =>
          prev.map((upload) => ({
            ...upload,
            status: "error",
            error: errorMessage,
          })),
        );
      }
    },
    [onUploadComplete],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": ALLOWED_EXTENSIONS,
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-sm text-gray-600">
            {isDragActive
              ? "Drop the videos here..."
              : "Drag and drop videos here, or click to select files"}
          </p>
          <p className="text-xs text-gray-500">
            Supported formats: MP4, MOV, AVI, MKV, WEBM (Max 500MB per file)
          </p>
        </div>
      </div>


      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div key={index} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {upload.file.name}
                </span>
                <span className="text-xs text-gray-500">
                  {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              {upload.status === "uploading" && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}
              {upload.status === "success" && (
                <div className="text-sm text-green-600">
                  ✓ Uploaded successfully
                </div>
              )}
              {upload.status === "error" && (
                <div className="text-sm text-red-600">{upload.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
