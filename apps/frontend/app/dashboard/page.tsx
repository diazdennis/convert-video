"use client";

import { useState } from "react";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { VideoUpload } from "../../components/VideoUpload";
import { VideoList } from "../../components/VideoList";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";

function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">
            Upload Videos
          </h2>
          <VideoUpload onUploadComplete={handleUploadComplete} />
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-bold text-gray-900">Your Videos</h2>
          <VideoList refreshTrigger={refreshKey} />
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
