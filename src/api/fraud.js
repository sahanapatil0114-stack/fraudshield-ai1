import axios from 'axios'

// Fraud detection uses built-in JS mock when Flask is not deployed
const FLASK_URL = import.meta.env.VITE_FLASK_API_URL || 'http://localhost:5001'

const flaskApi = axios.create({ baseURL: FLASK_URL, timeout: 5000 })

export const fraudAPI = {
  detect: (data) => flaskApi.post('/detect', data),
  batchDetect: (transactions) => flaskApi.post('/batch-detect', { transactions }),
  stats: () => flaskApi.get('/stats'),
  health: () => flaskApi.get('/health'),
}

export default fraudAPI
