export function analyzeTransaction({ amount, merchant, location, hour, category = 'general' }) {
  let score = 0
  const flags = []
  const amt = parseFloat(amount) || 0
  const h = hour ?? new Date().getHours()

  if (amt > 10000) { score += 0.4; flags.push('Extremely high transaction amount') }
  else if (amt > 5000) { score += 0.3; flags.push('Very high transaction amount') }
  else if (amt > 2000) { score += 0.2; flags.push('High transaction amount') }
  else if (amt > 1000) { score += 0.1; flags.push('Above-average transaction amount') }

  const badMerchant = ['unknown', 'unnamed', 'anonymous', 'mystery', 'phantom', 'suspicious', 'crypto', 'vendor 0', 'merchant #', 'store #', 'trader']
  if (badMerchant.some(k => (merchant || '').toLowerCase().includes(k))) {
    score += 0.3
    flags.push('Suspicious or unknown merchant')
  }

  const badLoc = ['nigeria', 'russia', 'unknown', 'offshore', 'anonymous', 'vpn']
  if (badLoc.some(k => (location || '').toLowerCase().includes(k))) {
    score += 0.3
    flags.push('High-risk geographic location')
  }

  if (h >= 1 && h <= 5) { score += 0.2; flags.push('Unusual transaction time') }
  else if (h === 0 || h === 23) { score += 0.1; flags.push('Late-night transaction') }

  if (['crypto', 'transfer', 'wire', 'gambling'].includes((category || '').toLowerCase())) {
    score += 0.2
    flags.push(`High-risk category: ${category}`)
  }

  score = Math.max(0.01, Math.min(0.99, score + (Math.random() * 0.1 - 0.05)))
  const risk_level = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  const status = score >= 0.7 ? 'fraud' : score >= 0.4 ? 'pending' : 'safe'

  return {
    fraud_probability: parseFloat(score.toFixed(4)),
    risk_level,
    risk_score: parseFloat((score * 100).toFixed(2)),
    status,
    flags,
    model_version: 'v1.0.0',
    confidence: parseFloat((1 - Math.abs(score - 0.5) * 0.3).toFixed(4)),
  }
}
