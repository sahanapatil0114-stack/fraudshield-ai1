import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const storePath = process.env.DATABASE_PATH || path.join(dataDir, 'store.json')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const defaultStore = () => ({
  users: [],
  transactions: [],
  notifications: [],
  system_logs: [],
  _seq: { users: 0, transactions: 0, notifications: 0, system_logs: 0 },
})

let store = defaultStore()

function save() {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2))
}

function load() {
  if (fs.existsSync(storePath)) {
    store = JSON.parse(fs.readFileSync(storePath, 'utf8'))
  }
}

function nextId(table) {
  store._seq[table] = (store._seq[table] || 0) + 1
  return store._seq[table]
}

export function initDb() {
  load()
  if (store.users.length > 0) return

  const hash = bcrypt.hashSync('password', 12)
  const users = [
    { name: 'Super Admin', email: 'admin@fraudshield.ai', role: 'admin', phone: '+1-555-0100' },
    { name: 'John Anderson', email: 'john@example.com', role: 'user', phone: '+1-555-0101' },
    { name: 'Sarah Mitchell', email: 'sarah@example.com', role: 'user', phone: '+1-555-0102' },
    { name: 'Mike Thompson', email: 'mike@example.com', role: 'user', phone: '+1-555-0103' },
    { name: 'Emily Chen', email: 'emily@example.com', role: 'user', phone: '+1-555-0104' },
  ]
  for (const u of users) {
    store.users.push({
      id: nextId('users'), ...u, password_hash: hash, is_active: 1,
      last_login: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
  }

  const txns = [
    [2,'TXN-20240101-001',45.99,'Starbucks Coffee','New York, NY','food','4532','2024-01-15T09:23:00','safe',0.0821,'low',0.0821],
    [2,'TXN-20240101-002',5847,'Unknown Merchant #4821','Lagos, Nigeria','general','4532','2024-01-15T03:14:00','fraud',0.9234,'high',0.9234],
    [2,'TXN-20240101-003',129.99,'Amazon Prime','Seattle, WA','shopping','4532','2024-01-16T14:05:00','safe',0.0512,'low',0.0512],
    [2,'TXN-20240101-004',2800,'Crypto Exchange XYZ','Unknown Location','crypto','4532','2024-01-17T02:47:00','fraud',0.8791,'high',0.8791],
    [2,'TXN-20240101-005',78.5,'Shell Gas Station','Chicago, IL','fuel','4532','2024-01-18T11:30:00','safe',0.1023,'low',0.1023],
    [2,'TXN-20240101-006',349.99,'Best Buy Electronics','Los Angeles, CA','electronics','4532','2024-01-19T16:22:00','safe',0.1543,'low',0.1543],
    [2,'TXN-20240101-007',1200,'Unnamed Store #9911','Miami, FL','general','4532','2024-01-20T23:58:00','fraud',0.7234,'high',0.7234],
    [2,'TXN-20240101-008',23.45,"McDonald's",'Houston, TX','food','4532','2024-01-21T12:15:00','safe',0.0334,'low',0.0334],
    [2,'TXN-20240101-009',567,'Nike Official Store','Dallas, TX','shopping','4532','2024-01-22T10:45:00','safe',0.0621,'low',0.0621],
    [2,'TXN-20240101-010',3500,'Mystery Vendor 01','Unknown','general','4532','2024-01-23T04:22:00','fraud',0.8912,'high',0.8912],
    [3,'TXN-20240201-001',92.1,'Whole Foods Market','Boston, MA','groceries','7891','2024-02-01T08:10:00','safe',0.0412,'low',0.0412],
    [3,'TXN-20240201-002',4200,'Phantom Electronics','Moscow, Russia','electronics','7891','2024-02-02T01:30:00','fraud',0.9112,'high',0.9112],
    [4,'TXN-20240301-001',234.56,'Home Depot','Atlanta, GA','home','3214','2024-03-01T10:00:00','safe',0.0912,'low',0.0912],
    [4,'TXN-20240301-002',1890,'Suspicious Trader XO','Unknown IP','general','3214','2024-03-02T02:15:00','fraud',0.8234,'high',0.8234],
  ]
  for (const t of txns) {
    store.transactions.push({
      id: nextId('transactions'), user_id: t[0], transaction_ref: t[1], amount: t[2],
      merchant: t[3], location: t[4], category: t[5], card_last4: t[6],
      transaction_time: t[7], status: t[8], risk_score: t[9], risk_level: t[10],
      fraud_probability: t[11], created_at: t[7],
    })
  }

  store.notifications.push({
    id: nextId('notifications'), user_id: 2, title: '🚨 Fraud Alert',
    message: 'High-risk transaction: $5,847 at Unknown Merchant', type: 'fraud_alert',
    is_read: 0, transaction_id: 2, created_at: new Date().toISOString(),
  })
  store.system_logs.push({
    id: nextId('system_logs'), user_id: 1, action: 'system_startup',
    entity_type: 'system', description: 'FraudShield AI initialized',
    severity: 'info', created_at: new Date().toISOString(),
  })
  save()
}

export const db = {
  name: storePath,
  findUserByEmail: (email) => store.users.find(u => u.email === email && u.is_active),
  findUserById: (id) => store.users.find(u => u.id === id && u.is_active),
  updateUserLogin: (id) => {
    const u = store.users.find(x => x.id === id)
    if (u) { u.last_login = new Date().toISOString(); save() }
  },
  createUser: (data) => {
    const user = { id: nextId('users'), ...data, is_active: 1, last_login: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    store.users.push(user)
    save()
    return user
  },
  updateUser: (id, data) => {
    const u = store.users.find(x => x.id === id)
    if (u) { Object.assign(u, data, { updated_at: new Date().toISOString() }); save() }
  },
  deleteUser: (id) => {
    store.users = store.users.filter(u => u.id !== id)
    store.transactions = store.transactions.filter(t => t.user_id !== id)
    save()
  },
  listUsers: (search = '') => {
    const s = search.toLowerCase()
    return store.users.filter(u => !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s))
      .map(u => ({
        ...u, password_hash: undefined,
        transaction_count: store.transactions.filter(t => t.user_id === u.id).length,
        fraud_count: store.transactions.filter(t => t.user_id === u.id && t.status === 'fraud').length,
      }))
  },
  listTransactions: ({ userId, admin, search, status, risk, limit, offset }) => {
    let rows = store.transactions.map(t => {
      const u = store.users.find(x => x.id === t.user_id)
      return { ...t, user_name: u?.name, user_email: u?.email }
    })
    if (!admin) rows = rows.filter(t => t.user_id === userId)
    if (search && search !== '%%') {
      const s = search.replace(/%/g, '').toLowerCase()
      rows = rows.filter(t => t.merchant.toLowerCase().includes(s) || t.location.toLowerCase().includes(s) || t.transaction_ref.toLowerCase().includes(s))
    }
    if (status) rows = rows.filter(t => t.status === status)
    if (risk) rows = rows.filter(t => t.risk_level === risk)
    rows.sort((a, b) => new Date(b.transaction_time) - new Date(a.transaction_time))
    const total = rows.length
    return { rows: rows.slice(offset, offset + limit), total }
  },
  createTransaction: (data) => {
    const txn = { id: nextId('transactions'), created_at: new Date().toISOString(), transaction_time: new Date().toISOString(), ...data }
    store.transactions.push(txn)
    save()
    return txn
  },
  getAnalytics: (userId, admin) => {
    let txns = admin ? store.transactions : store.transactions.filter(t => t.user_id === userId)
    const summary = {
      total_transactions: txns.length,
      fraud_count: txns.filter(t => t.status === 'fraud').length,
      safe_count: txns.filter(t => t.status === 'safe').length,
      pending_count: txns.filter(t => t.status === 'pending').length,
      avg_fraud_probability: txns.length ? txns.reduce((s, t) => s + t.fraud_probability, 0) / txns.length : 0,
      total_amount: txns.reduce((s, t) => s + t.amount, 0),
      fraud_amount: txns.filter(t => t.status === 'fraud').reduce((s, t) => s + t.amount, 0),
    }
    const risk_distribution = ['low', 'medium', 'high'].map(level => ({
      risk_level: level, count: txns.filter(t => t.risk_level === level).length,
    })).filter(r => r.count > 0)
    const daily = {}
    for (const t of txns) {
      const d = t.transaction_time.slice(0, 10)
      if (!daily[d]) daily[d] = { date: d, total: 0, fraud: 0, safe: 0 }
      daily[d].total++
      if (t.status === 'fraud') daily[d].fraud++
      if (t.status === 'safe') daily[d].safe++
    }
    const category_breakdown = {}
    for (const t of txns) {
      if (!category_breakdown[t.category]) category_breakdown[t.category] = { category: t.category, count: 0, fraud_count: 0 }
      category_breakdown[t.category].count++
      if (t.status === 'fraud') category_breakdown[t.category].fraud_count++
    }
    let system = null
    if (admin) {
      system = {
        active_users: store.users.filter(u => u.role === 'user' && u.is_active).length,
        today_logs: store.system_logs.filter(l => l.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
      }
    }
    return { summary, risk_distribution, daily_trend: Object.values(daily), category_breakdown: Object.values(category_breakdown), system }
  },
  getNotifications: (userId) => {
    const notifications = store.notifications.filter(n => n.user_id === userId)
      .map(n => {
        const t = store.transactions.find(x => x.id === n.transaction_id)
        return { ...n, transaction_ref: t?.transaction_ref, amount: t?.amount, merchant: t?.merchant }
      })
    return { notifications, unread_count: notifications.filter(n => !n.is_read).length }
  },
  markNotificationsRead: (userId) => {
    store.notifications.filter(n => n.user_id === userId).forEach(n => { n.is_read = 1 })
    save()
  },
  addNotification: (data) => {
    store.notifications.push({ id: nextId('notifications'), is_read: 0, created_at: new Date().toISOString(), ...data })
    save()
  },
  getLogs: (severity) => {
    let logs = store.system_logs.map(l => ({
      ...l, user_name: store.users.find(u => u.id === l.user_id)?.name || null,
    }))
    if (severity) logs = logs.filter(l => l.severity === severity)
    return logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 100)
  },
}

export function logAction(userId, action, entityType = '', entityId = null, description = '', severity = 'info') {
  store.system_logs.push({
    id: nextId('system_logs'), user_id: userId, action, entity_type: entityType,
    entity_id: entityId, description, severity, created_at: new Date().toISOString(),
  })
  save()
}
