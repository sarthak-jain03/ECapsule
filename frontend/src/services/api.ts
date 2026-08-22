import axios from 'axios';
import { User, EmailJob, EmailStats, PaginatedResponse, ScheduleEmailPayload, CsvParseResponse } from '../types';

const api = axios.create({
  baseURL: '',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  getCurrentUser: () => api.get<User>('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  getGoogleLoginUrl: () => '/auth/google',
};

export const emailApi = {
  schedule: (payload: ScheduleEmailPayload) =>
    api.post<{ message: string; campaignId: string; jobCount: number }>(
      '/api/emails/schedule',
      payload
    ).then((r) => r.data),

  parseCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<CsvParseResponse>('/api/emails/parse-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  getScheduled: (page = 1, limit = 50) =>
    api.get<PaginatedResponse<EmailJob>>(`/api/emails/scheduled?page=${page}&limit=${limit}`)
      .then((r) => r.data),

  getSent: (page = 1, limit = 50) =>
    api.get<PaginatedResponse<EmailJob>>(`/api/emails/sent?page=${page}&limit=${limit}`)
      .then((r) => r.data),

  getById: (id: string) =>
    api.get<EmailJob>(`/api/emails/${id}`).then((r) => r.data),

  getStats: () =>
    api.get<EmailStats>('/api/emails/stats').then((r) => r.data),
};

export default api;
