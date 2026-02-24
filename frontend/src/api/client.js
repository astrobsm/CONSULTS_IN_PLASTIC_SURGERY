/**
 * PS Consult – UNTH: Axios API Client
 */
import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,  // 30s to accommodate Vercel serverless cold starts
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ps_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 (only redirect if on protected pages)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only clear auth and redirect if we're not on the public landing page
      const isPublicPage = window.location.pathname === '/' || window.location.pathname === '/login';
      if (!isPublicPage) {
        localStorage.removeItem('ps_token');
        localStorage.removeItem('ps_user');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  codeLogin: (code) => api.post('/auth/code-login', { code }),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
  listUsers: () => api.get('/auth/users'),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
};

// ── Consults ────────────────────────────────────────
export const consultsAPI = {
  create: (data) => api.post('/consults/', data),
  createPublic: (data) => api.post('/consults/public', data),
  uploadPhotoPublic: (consultId, formData) =>
    api.post(`/consults/public/${consultId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list: (params) => api.get('/consults/', { params }),
  get: (id) => api.get(`/consults/${id}`),
  updateStatus: (id, data) => api.patch(`/consults/${id}/status`, data),
  acknowledge: (id) => api.patch(`/consults/${id}/acknowledge`),
  syncOffline: (consults) => api.post('/consults/sync', consults),
};

// ── Reviews ─────────────────────────────────────────
export const reviewsAPI = {
  create: (consultId, data) => api.post(`/reviews/${consultId}`, data),
  list: (consultId) => api.get(`/reviews/${consultId}`),
  update: (reviewId, data) => api.put(`/reviews/${reviewId}`, data),
  uploadPhoto: (consultId, formData) =>
    api.post(`/reviews/${consultId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  listPhotos: (consultId) => api.get(`/reviews/${consultId}/photos`),
};

// ── Dashboard ───────────────────────────────────────
export const dashboardAPI = {
  stats: () => api.get('/dashboard/stats'),
  analyticsByWard: () => api.get('/dashboard/analytics/by-ward'),
  analyticsByUrgency: () => api.get('/dashboard/analytics/by-urgency'),
  responseTimes: (days = 30) => api.get('/dashboard/analytics/response-times', { params: { days } }),
  dailyTrend: (days = 30) => api.get('/dashboard/analytics/daily-trend', { params: { days } }),
  notifications: (unreadOnly = false) =>
    api.get('/dashboard/notifications', { params: { unread_only: unreadOnly } }),
  markRead: (id) => api.patch(`/dashboard/notifications/${id}/read`),
  markAllRead: () => api.patch('/dashboard/notifications/read-all'),
  auditLogs: (params) => api.get('/dashboard/audit-logs', { params }),
};

// ── Schedule ────────────────────────────────────────
export const scheduleAPI = {
  list: () => api.get('/schedule/'),
  today: () => api.get('/schedule/today'),
  create: (data) => api.post('/schedule/', data),
  update: (id, data) => api.put(`/schedule/${id}`, data),
  remove: (id) => api.delete(`/schedule/${id}`),
};

export default api;
