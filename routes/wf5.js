// ============================================
// WF5 ROUTES - EMERGENCY STOP
// ============================================
// Fichier: routes/wf5.js

const express = require('express');
const router = express.Router();

// === DATA STORAGE ===
let wf5Checks = [];
let emergencyState = {
  active: false,
  reason: null,
  triggered_by: null,
  activated_at: null,
  alerts: []
};

// ============================================
// GET /api/wf5/status
// Statut du système et de l'arrêt d'urgence
// ============================================
router.get('/status', (req, res) => {
  try {
    res.json({
      success: true,
      system_status: emergencyState.active ? 'EMERGENCY' : 'OK',
      emergency_active: emergencyState.active,
      emergency_since: emergencyState.activated_at,
      emergency_reason: emergencyState.reason,
      limits: {
        keywords_paused: 0,
        max_keywords_paused: 10,
        bids_adjusted: 0,
        max_bids_adjusted: 15,
        negatives_added: 0,
        max_negatives_added: 20
      },
      last_check: wf5Checks.length > 0 ? wf5Checks[wf5Checks.length - 1].checked_at : null,
      total_checks: wf5Checks.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /api/wf5/activate-emergency
// Activer l'arrêt d'urgence
// ============================================
router.post('/activate-emergency', (req, res) => {
  try {
    const { reason, triggered_by, alerts, timestamp } = req.body;
    
    emergencyState = {
      active: true,
      reason: reason || 'Raison non spécifiée',
      triggered_by: triggered_by || 'MANUAL',
      activated_at: timestamp || new Date().toISOString(),
      alerts: alerts || []
    };
    
    console.log('🚨 EMERGENCY STOP ACTIVATED:', emergencyState.reason);
    
    res.json({
      success: true,
      message: '🚨 ARRÊT D\'URGENCE ACTIVÉ',
      emergency: emergencyState
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /api/wf5/deactivate-emergency
// Désactiver l'arrêt d'urgence
// ============================================
router.post('/deactivate-emergency', (req, res) => {
  try {
    const { deactivated_by, reason } = req.body;
    
    const previousState = { ...emergencyState };
    
    emergencyState = {
      active: false,
      reason: null,
      triggered_by: null,
      activated_at: null,
      alerts: []
    };
    
    console.log('✅ EMERGENCY STOP DEACTIVATED by:', deactivated_by || 'MANUAL');
    
    res.json({
      success: true,
      message: '✅ Arrêt d\'urgence désactivé',
      previous_state: previousState,
      deactivated_by: deactivated_by || 'MANUAL',
      deactivation_reason: reason || 'Manuel',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /api/wf5/log-check
// Enregistrer un check de surveillance
// ============================================
router.post('/log-check', (req, res) => {
  try {
    const checkData = req.body;
    
    const check = {
      id: checkData.check_id || `CHK_${Date.now()}`,
      ...checkData,
      logged_at: new Date().toISOString()
    };
    
    wf5Checks.push(check);
    
    // Garder les 100 derniers checks
    if (wf5Checks.length > 100) {
      wf5Checks = wf5Checks.slice(-100);
    }
    
    console.log(`✅ WF5 Check logged: ${check.id} - Status: ${check.system?.status || 'OK'}`);
    
    res.json({
      success: true,
      message: 'Check enregistré',
      check_id: check.id,
      timestamp: check.logged_at
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/wf5/checks
// Liste des checks récents
// ============================================
router.get('/checks', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const checks = wf5Checks.slice(-limit).reverse();
    
    res.json({
      success: true,
      count: checks.length,
      total: wf5Checks.length,
      checks: checks
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/wf5/last-check
// Dernier check
// ============================================
router.get('/last-check', (req, res) => {
  try {
    if (wf5Checks.length === 0) {
      return res.json({
        success: true,
        message: 'Aucun check disponible',
        check: null
      });
    }
    
    res.json({
      success: true,
      check: wf5Checks[wf5Checks.length - 1]
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/wf5/dashboard
// Dashboard de surveillance
// ============================================
router.get('/dashboard', (req, res) => {
  try {
    const recentChecks = wf5Checks.slice(-10).reverse();
    const alertChecks = wf5Checks.filter(c => c.alerts && c.alerts.length > 0).slice(-5).reverse();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>WF5 - Emergency Stop Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="60">
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 20px; 
      background: #0f172a; 
      color: #e5e7eb; 
    }
    h1 { color: #4da6ff; margin-bottom: 5px; }
    .subtitle { color: #9ca3af; margin-bottom: 30px; }
    
    .status-banner {
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
    }
    .status-ok {
      background: linear-gradient(135deg, #065f46, #047857);
      border: 2px solid #10b981;
    }
    .status-emergency {
      background: linear-gradient(135deg, #991b1b, #dc2626);
      border: 2px solid #f87171;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }
    .status-banner h2 { margin: 0 0 10px 0; font-size: 24px; }
    .status-banner p { margin: 0; opacity: 0.9; }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #1e293b;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .stat-value { font-size: 32px; font-weight: bold; color: #4da6ff; }
    .stat-label { font-size: 12px; color: #9ca3af; margin-top: 5px; text-transform: uppercase; }
    
    .section { margin-bottom: 30px; }
    .section h3 { color: #4da6ff; margin-bottom: 15px; }
    
    .check-list {
      background: #1e293b;
      border-radius: 12px;
      overflow: hidden;
    }
    .check-item {
      padding: 15px 20px;
      border-bottom: 1px solid #0f172a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .check-item:last-child { border-bottom: none; }
    .check-status {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
    }
    .check-ok { background: #065f46; color: #6ee7b7; }
    .check-warning { background: #92400e; color: #fcd34d; }
    .check-critical { background: #991b1b; color: #fca5a5; }
    .check-time { color: #9ca3af; font-size: 13px; }
    
    .btn {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: bold;
      text-decoration: none;
      cursor: pointer;
      border: none;
      font-size: 14px;
    }
    .btn-danger { background: #dc2626; color: white; }
    .btn-success { background: #059669; color: white; }
    .btn-secondary { background: #1e293b; color: #4da6ff; border: 1px solid #4da6ff; }
    .btn:hover { opacity: 0.9; }
    
    .actions { display: flex; gap: 10px; margin-top: 20px; justify-content: center; }
    
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #1e293b;
      color: #9ca3af;
      font-size: 13px;
    }
    .footer a { color: #4da6ff; }
  </style>
</head>
<body>
  <h1>🛡️ WF5 - Emergency Stop Dashboard</h1>
  <p class="subtitle">Surveillance automatique du système Google Ads Auto</p>
  
  <div class="status-banner ${emergencyState.active ? 'status-emergency' : 'status-ok'}">
    ${emergencyState.active ? `
      <h2>🚨 ARRÊT D'URGENCE ACTIF</h2>
      <p><strong>Raison:</strong> ${emergencyState.reason || 'Non spécifiée'}</p>
      <p><strong>Depuis:</strong> ${emergencyState.activated_at ? new Date(emergencyState.activated_at).toLocaleString('fr-FR') : 'N/A'}</p>
    ` : `
      <h2>✅ SYSTÈME OPÉRATIONNEL</h2>
      <p>Aucune anomalie détectée - Surveillance active</p>
    `}
  </div>
  
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${wf5Checks.length}</div>
      <div class="stat-label">Checks totaux</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${wf5Checks.filter(c => c.alerts && c.alerts.length > 0).length}</div>
      <div class="stat-label">Checks avec alertes</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${emergencyState.active ? '🚨' : '✅'}</div>
      <div class="stat-label">Statut</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">30min</div>
      <div class="stat-label">Intervalle</div>
    </div>
  </div>
  
  <div class="actions">
    ${emergencyState.active ? `
      <button class="btn btn-success" onclick="deactivateEmergency()">✅ Désactiver l'arrêt d'urgence</button>
    ` : `
      <button class="btn btn-danger" onclick="activateEmergency()">🚨 Activer l'arrêt d'urgence (TEST)</button>
    `}
    <button class="btn btn-secondary" onclick="location.reload()">🔄 Rafraîchir</button>
  </div>
  
  <div class="section">
    <h3>📋 Derniers Checks</h3>
    <div class="check-list">
      ${recentChecks.length === 0 ? `
        <div class="check-item">
          <span>Aucun check enregistré</span>
        </div>
      ` : recentChecks.map(c => `
        <div class="check-item">
          <div>
            <strong>${c.check_id || c.id}</strong>
            <span class="check-time"> - ${new Date(c.checked_at || c.logged_at).toLocaleString('fr-FR')}</span>
          </div>
          <span class="check-status ${c.system?.status === 'EMERGENCY' ? 'check-critical' : c.alerts?.length > 0 ? 'check-warning' : 'check-ok'}">
            ${c.system?.status || 'OK'} ${c.alerts?.length > 0 ? `(${c.alerts.length} alertes)` : ''}
          </span>
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="footer">
    <p>🚀 Google Ads Auto v1.2.0 - Mistral Pro Reno</p>
    <p>
      <a href="/">Backend</a> | 
      <a href="/api/wf4/dashboard">WF4 Dashboard</a> |
      <a href="/wf1-dashboard.html">WF1 Dashboard</a>
    </p>
    <p style="font-size: 11px;">Auto-refresh toutes les 60 secondes</p>
  </div>
  
  <script>
    async function activateEmergency() {
      if (!confirm('⚠️ Voulez-vous vraiment activer l\\'arrêt d\\'urgence ?')) return;
      
      try {
        const res = await fetch('/api/wf5/activate-emergency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'Activation manuelle via dashboard',
            triggered_by: 'MANUAL_DASHBOARD'
          })
        });
        const data = await res.json();
        alert(data.message);
        location.reload();
      } catch (err) {
        alert('Erreur: ' + err.message);
      }
    }
    
    async function deactivateEmergency() {
      if (!confirm('✅ Voulez-vous désactiver l\\'arrêt d\\'urgence ?')) return;
      
      try {
        const res = await fetch('/api/wf5/deactivate-emergency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deactivated_by: 'MANUAL_DASHBOARD',
            reason: 'Désactivation manuelle via dashboard'
          })
        });
        const data = await res.json();
        alert(data.message);
        location.reload();
      } catch (err) {
        alert('Erreur: ' + err.message);
      }
    }
  </script>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    res.status(500).send('<h1>Erreur serveur</h1>');
  }
});

module.exports = router;
