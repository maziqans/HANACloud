import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.56.101:8080/api';

const apiClient = axios.create({
  baseURL: API_URL,
});

// Automatically attach the JWT token to every request
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const fetchItems = async (parentId: string | null) => {
  const response = await apiClient.get('/drive/', {
    params: {
      parent_id: parentId,
    },
  });
  return response.data;
};

export const uploadFiles = async (formData: FormData, parentId: string | null, onProgress?: (progressEvent: any) => void) => {
  if (parentId) formData.append('parent_id', parentId);
  const response = await apiClient.post('/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onProgress,
  });
  return response.data;
};

export const moveToTrash = async (itemId: string) => {
  const response = await apiClient.patch(`/drive/${itemId}/`, {
    is_trashed: true,
  });
  return response.data;
};

export const createFolder = async (name: string, parentId: string | null) => {
  const response = await apiClient.post('/create-folder/', { name, parent_id: parentId });
  return response.data;
};

export const updateProfile = async (formData: FormData) => {
  const response = await apiClient.post('/profile/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getStorageInfo = async () => {
  const response = await apiClient.get('/storage/summary/');
  return response.data;
};

export const requestStorage = async (reason: string) => {
  const response = await apiClient.post('/storage/request/', { reason });
  return response.data;
};

export const deleteAccount = async () => {
  const response = await apiClient.delete('/account/');
  return response.data;
};

export const login = async (credentials: any) => {
  const response = await apiClient.post('/token/', credentials);
  if (response.data.access) {
    localStorage.setItem('access_token', response.data.access);
  }
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await apiClient.get('/users/me/');
  return response.data;
};

export const logout = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
  }
};

export default apiClient;