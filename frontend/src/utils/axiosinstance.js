import axios from 'axios';

// On Vercel the API is served from the same origin under /api, so the deployed
// build needs no absolute URL. VITE_BASE_URL still wins, for a frontend hosted
// separately from the API (Vite inlines it at build time).
const base_url = import.meta.env.VITE_BASE_URL
    || (import.meta.env.DEV ? 'http://localhost:3000' : '/api');

const axiosInstance = axios.create({
    baseURL: base_url,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default axiosInstance;