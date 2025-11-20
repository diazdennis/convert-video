import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Video {
  _id: string;
  filename: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  raw_file_path: string;
  output_file_path: string | null;
  duration: number | null;
  resolution: string | null;
  size: number | null;
  output_format: string | null;
  error_message: string | null;
  converted_formats: Array<{ format: string; file_path: string }>;
  createdAt: string;
  updatedAt: string;
}

export const authApi = {
  signup: async (email: string, password: string, name: string) => {
    const response = await api.post("/auth/signup", { email, password, name });
    return response.data;
  },
  login: async (email: string, password: string) => {
    const response = await api.post("/auth/login", { email, password });
    return response.data;
  },
  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },
  getProfile: async (): Promise<User> => {
    const response = await api.get("/auth/profile");
    return response.data.user;
  },
};

export interface VideoFormat {
  value: string;
  label: string;
}

export const videosApi = {
  upload: async (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    const response = await api.post("/videos/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
  getAll: async (): Promise<Video[]> => {
    const response = await api.get("/videos");
    return response.data;
  },
  getOne: async (id: string): Promise<Video> => {
    const response = await api.get(`/videos/${id}`);
    return response.data;
  },
  getFormats: async (): Promise<VideoFormat[]> => {
    const response = await api.get("/videos/formats");
    return response.data.formats;
  },
  download: async (id: string, format?: string) => {
    const url = format
      ? `/videos/${id}/download?format=${format}`
      : `/videos/${id}/download`;
    const response = await api.get(url, {
      responseType: "blob",
    });
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/videos/${id}`);
    return response.data;
  },
};
