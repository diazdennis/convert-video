"use client";

import { useState, useEffect } from "react";
import { videosApi, VideoFormat } from "../lib/api";

interface FormatSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFormat: (format: string) => void;
  videoFilename: string;
}

export function FormatSelectorModal({
  isOpen,
  onClose,
  onSelectFormat,
  videoFilename,
}: FormatSelectorModalProps) {
  const [formats, setFormats] = useState<VideoFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      const fetchFormats = async () => {
        try {
          setLoading(true);
          const availableFormats = await videosApi.getFormats();
          setFormats(availableFormats);
          if (availableFormats.length > 0) {
            setSelectedFormat(availableFormats[0].value);
          }
        } catch (err) {
          console.error("Failed to load formats:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchFormats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedFormat) {
      onSelectFormat(selectedFormat);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Select Download Format
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Choose the format you want to download for{" "}
          <span className="font-medium">{videoFilename}</span>
        </p>

        {loading ? (
          <div className="py-8 text-center text-gray-500">
            Loading formats...
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {formats.map((format) => (
              <label
                key={format.value}
                className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  selectedFormat === format.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={format.value}
                  checked={selectedFormat === format.value}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900">
                  {format.label}
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  .{format.value}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedFormat || loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
