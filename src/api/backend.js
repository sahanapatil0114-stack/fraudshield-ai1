import axios from 'axios'

const TOKEN_KEY = 'fraudshield_token'

let BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const api = axios.create({
  baseURL: BASE || '/phpapi',
  headers: { 'Content-Type': 'application/json' },
})

/** Call before app renders — loads InfinityFree URL from config.json on Render */
export async function initApi() {
  if (BASE) {
    api.defaults.baseURL = BASE
    return BASE
  }
  if (import.meta.env.PROD) {
    try {
      const res = await fetch('/config.json')
      const cfg = await res.json()
      if (cfg.API_BASE_URL && !cfg.API_BASE_URL.includes('YOUR-SITE')) {
        BASE = cfg.API_BASE_URL.replace(/\/$/, '')
        api.defaults.baseURL = BASE
        return BASE
      }
    } catch { /* use fallback */ }
  }
  BASE = '/phpapi'
  api.defaults.baseURL = BASE
  return BASE
}

export function getApiBase() {
  return api.defaults.baseURL
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || ''
      const onLoginPage = window.location.pathname === '/login'
      if (url.includes('/auth/me.php')) {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('fraudshield_user')
      } else if (!onLoginPage) {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('fraudshield_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export function saveToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export const authAPI = {
  login:    (data) => api.post('/api/auth/login.php', data),
  register: (data) => api.post('/api/auth/register.php', data),
  logout:   ()     => api.post('/api/auth/logout.php'),
  me:       ()     => api.get('/api/auth/me.php'),
}

export const txnAPI = {
  list:   (params) => api.get('/api/transactions/index.php', { params }),
  create: (data)   => api.post('/api/transactions/index.php', data),
  export: (params) => `${getApiBase()}/api/transactions/export.php?${new URLSearchParams(params)}`,
}

export const usersAPI = {
  list:   (params) => api.get('/api/users/index.php', { params }),
  update: (data)   => api.put('/api/users/index.php', data),
  delete: (id)     => api.delete(`/api/users/index.php?id=${id}`),
}

export const analyticsAPI = {
  get: () => api.get('/api/analytics/index.php'),
}

export const notifAPI = {
  list:     () => api.get('/api/notifications/index.php'),
  markRead: () => api.post('/api/notifications/index.php?action=mark_read'),
}

export const logsAPI = {
  list: (params) => api.get('/api/logs/index.php', { params }),
}

export default api
