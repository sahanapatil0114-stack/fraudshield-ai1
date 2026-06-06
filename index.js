import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { db, initDb, logAction } from './store.js'
import { analyzeTransaction } from './fraudModel.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'fraudshield-dev-secret-change-in-production'
const distPath = path.join(__dirname, '..', 'frontend', 'dist')

initDb()

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.get('/', (req, res) => {
  res.send('FraudShield AI Backend Running Successfully');
});

// Rewrite /phpapi or /fraudshield/backend requests to match local Node API endpoints
app.use((req, res, next) => {
  if (req.url.startsWith('/phpapi')) {
    req.url = req.url.replace(/^\/phpapi/, '')
  } else if (req.url.startsWith('/fraudshield/backend')) {
    req.url = req.url.replace(/^\/fraudshield\/backend/, '')
  }
  next()
})

const ok = (res, data, message = 'OK') => res.json({ success: true, message, data })
const fail = (res, message, status = 400) => res.status(status).json({ success: false, error: message })

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
}

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return fail(res, 'Unauthorized. Please log in.', 401)
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return fail(res, 'Invalid or expired token.', 401)
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return fail(res, 'Forbidden. Admin access required.', 403)
  next()
}

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role, phone: row.phone }
}

// ── Auth ──────────────────────────────────────────────────────
const loginHandler = (req, res) => {
  const email = (req.body.email || '').trim()
  const password = req.body.password || ''
  if (!email || !password) return fail(res, 'Email and password are required')

  const user = db.findUserByEmail(email)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return fail(res, 'Invalid email or password', 401)
  }
  db.updateUserLogin(user.id)
  logAction(user.id, 'user_login', 'users', user.id, 'User logged in')
  const token = signToken(user)
  ok(res, { ...publicUser(user), token }, 'Login successful')
}
app.post('/api/auth/login', loginHandler)
app.post('/api/auth/login.php', loginHandler)

const registerHandler = (req, res) => {
  const name = (req.body.name || '').trim()
  const email = (req.body.email || '').trim()
  const password = req.body.password || ''
  const phone = (req.body.phone || '').trim()
  if (!name || !email || !password) return fail(res, 'Name, email, and password are required')
  if (password.length < 6) return fail(res, 'Password must be at least 6 characters')
  if (db.findUserByEmail(email)) return fail(res, 'Email address is already registered', 409)

  const hash = bcrypt.hashSync(password, 12)
  const user = db.createUser({ name, email, password_hash: hash, phone, role: 'user' })
  logAction(user.id, 'user_registered', 'users', user.id, `New user: ${email}`)
  ok(res, { id: user.id, name, email, role: 'user' }, 'Registration successful. Please log in.')
}
app.post('/api/auth/register', registerHandler)
app.post('/api/auth/register.php', registerHandler)

const meHandler = (req, res) => {
  const user = db.findUserById(req.user.id)
  if (!user) return fail(res, 'Not authenticated', 401)
  ok(res, publicUser(user))
}
app.get('/api/auth/me', auth, meHandler)
app.get('/api/auth/me.php', auth, meHandler)

const logoutHandler = (_req, res) => ok(res, null, 'Logged out')
app.post('/api/auth/logout', logoutHandler)
app.post('/api/auth/logout.php', logoutHandler)

// ── Transactions ──────────────────────────────────────────────
function listTransactions(req, res) {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
  const offset = (page - 1) * limit
  const { rows, total } = db.listTransactions({
    userId: req.user.id,
    admin: req.user.role === 'admin',
    search: `%${(req.query.search || '').trim()}%`,
    status: req.query.status || '',
    risk: req.query.risk || '',
    limit,
    offset,
  })
  ok(res, { transactions: rows, pagination: { total, page, limit, total_pages: Math.ceil(total / limit) } })
}
app.get('/api/transactions', auth, listTransactions)
app.get('/api/transactions/index.php', auth, listTransactions)

function createTransaction(req, res) {
  const body = req.body
  const amount = parseFloat(body.amount) || 0
  const merchant = (body.merchant || '').trim()
  const location = (body.location || '').trim()
  if (!merchant || !location || amount <= 0) return fail(res, 'Amount, merchant, and location are required')

  const ref = `TXN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`
  const txn = db.createTransaction({
    user_id: req.user.id, transaction_ref: ref, amount, merchant, location,
    category: body.category || 'general', card_last4: body.card_last4 || '0000',
    status: body.status || 'pending', risk_score: body.risk_score || 0,
    risk_level: body.risk_level || 'low', fraud_probability: body.fraud_probability || 0,
  })

  if (body.risk_level === 'high' || body.status === 'fraud') {
    db.addNotification({
      user_id: req.user.id, title: '🚨 Fraud Alert', type: 'fraud_alert', transaction_id: txn.id,
      message: `High-risk transaction: $${amount} at ${merchant}. Fraud probability: ${((body.fraud_probability || 0) * 100).toFixed(1)}%`,
    })
    logAction(req.user.id, 'fraud_detected', 'transactions', txn.id, `Fraud: ${ref}`, 'critical')
  } else {
    logAction(req.user.id, 'transaction_created', 'transactions', txn.id, `Transaction ${ref}`)
  }
  ok(res, { id: txn.id, transaction_ref: ref, status: txn.status }, 'Transaction saved')
}
app.post('/api/transactions', auth, createTransaction)
app.post('/api/transactions/index.php', auth, createTransaction)

const exportHandler = (req, res) => {
  const { rows } = db.listTransactions({ userId: req.user.id, admin: req.user.role === 'admin', limit: 10000, offset: 0 })
  const header = 'id,transaction_ref,amount,merchant,location,status,risk_level,fraud_probability,transaction_time\n'
  const csv = header + rows.map(r =>
    [r.id, r.transaction_ref, r.amount, r.merchant, r.location, r.status, r.risk_level, r.fraud_probability, r.transaction_time].join(',')
  ).join('\n')
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv')
  res.send(csv)
}
app.get('/api/transactions/export', auth, exportHandler)
app.get('/api/transactions/export.php', auth, exportHandler)

// ── Analytics ─────────────────────────────────────────────────
function getAnalytics(req, res) {
  ok(res, db.getAnalytics(req.user.id, req.user.role === 'admin'))
}
app.get('/api/analytics', auth, getAnalytics)
app.get('/api/analytics/index.php', auth, getAnalytics)

// ── Users (admin) ─────────────────────────────────────────────
function listUsers(req, res) {
  const users = db.listUsers((req.query.search || '').trim())
  ok(res, { users, pagination: { total: users.length, page: 1, limit: 100, total_pages: 1 } })
}
app.get('/api/users', auth, requireAdmin, listUsers)
app.get('/api/users/index.php', auth, requireAdmin, listUsers)

function updateUser(req, res) {
  const { id, name, role, phone, is_active } = req.body
  if (!id || !name) return fail(res, 'User ID and name are required')
  db.updateUser(id, { name, role: role || 'user', phone: phone || '', is_active: is_active ?? 1 })
  logAction(req.user.id, 'user_updated', 'users', id, `Admin updated user #${id}`)
  ok(res, null, 'User updated successfully')
}
app.put('/api/users', auth, requireAdmin, updateUser)
app.put('/api/users/index.php', auth, requireAdmin, updateUser)

function deleteUser(req, res) {
  const id = parseInt(req.query.id || req.body.id)
  if (!id) return fail(res, 'User ID required')
  if (id === req.user.id) return fail(res, 'Cannot delete your own account')
  db.deleteUser(id)
  logAction(req.user.id, 'user_deleted', 'users', id, `Admin deleted user #${id}`, 'warning')
  ok(res, null, 'User deleted successfully')
}
app.delete('/api/users', auth, requireAdmin, deleteUser)
app.delete('/api/users/index.php', auth, requireAdmin, deleteUser)

// ── Notifications ─────────────────────────────────────────────
function getNotifs(req, res) {
  ok(res, db.getNotifications(req.user.id))
}
app.get('/api/notifications', auth, getNotifs)
app.get('/api/notifications/index.php', auth, getNotifs)

function markNotifsRead(req, res) {
  if (req.query.action === 'mark_read') {
    db.markNotificationsRead(req.user.id)
    return ok(res, null, 'All notifications marked as read')
  }
  fail(res, 'Unknown action')
}
app.post('/api/notifications', auth, markNotifsRead)
app.post('/api/notifications/index.php', auth, markNotifsRead)

// ── Logs (admin) ────────────────────────────────────────────
app.get('/api/logs', auth, requireAdmin, (req, res) => {
  const logs = db.getLogs(req.query.severity || '')
  ok(res, { logs, pagination: { total: logs.length, page: 1, limit: 100, total_pages: 1 } })
})
app.get('/api/logs/index.php', auth, requireAdmin, (req, res) => {
  const logs = db.getLogs(req.query.severity || '')
  ok(res, { logs, pagination: { total: logs.length, page: 1, limit: 100, total_pages: 1 } })
})

// ── Fraud detection ───────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'online', service: 'FraudShield AI', version: '1.0.0' }))
app.post('/detect', (req, res) => {
  res.json({ success: true, result: analyzeTransaction(req.body || {}) })
})
app.post('/batch-detect', (req, res) => {
  const txns = (req.body.transactions || []).slice(0, 100)
  const results = txns.map(t => ({ ...t, result: analyzeTransaction(t) }))
  res.json({ success: true, results, fraud_count: results.filter(r => r.result.status === 'fraud').length, total: results.length })
})
app.get('/stats', (_req, res) => res.json({ success: true, stats: { model: 'v1.0.0', accuracy: 0.94, transactions_analyzed: 12847 } }))

// ── Serve React frontend ──────────────────────────────────────
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ success: false, error: 'Not found' })
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`FraudShield AI → http://localhost:${PORT}`)
  if (fs.existsSync(distPath)) console.log('Frontend + API on same server ✓')
})
