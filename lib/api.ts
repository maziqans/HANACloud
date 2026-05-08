import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.56.101:8080/api';

const apiClient = axios.create({
  baseURL: API_URL,
});

export const fetchItems = async (parentId: string | null) => {
  const response = await apiClient.get('/drive/', {
    params: {
      parent_id: parentId,
    },
  });
  return response.data;
};

export const uploadFiles = async (formData: FormData) => {
  const response = await apiClient.post('/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const moveToTrash = async (itemId: string) => {
  const response = await apiClient.patch(`/drive/${itemId}/`, {
    is_trashed: true,
  });
  return response.data;
};

export const updateProfile = async (formData: FormData) => {
  const response = await apiClient.post('/profile/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getStorageInfo = async () => {
  const response = await apiClient.get('/storage/');
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

export default apiClient;