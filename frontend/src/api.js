import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("salon_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fmtEUR = (n) => {
  const v = Number(n || 0);
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(v);
};

export const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};
