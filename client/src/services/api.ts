import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("edu_token");

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && localStorage.getItem("edu_token")) {
            localStorage.removeItem("edu_token");
            localStorage.removeItem("edu_user");
            window.dispatchEvent(new Event("edu:unauthorized"));
        }
        return Promise.reject(error);
    },
);

export default api;
