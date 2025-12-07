// ======================================
// GOOGLE ADS AUTO - BACKEND PRINCIPAL
// ======================================
// Version: 1.0.0
// Backend pour n8n workflows WF1, WF2, WF3, WF4

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');

// Initialisation Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Servir les fichiers statiques du dossier /public
app.use(express.static(path.join(__dirname, 'public')));

// ======================================
// ROUTES WF1 (inline pour déploiement simple)
// ======================================

const DATA_DIR = path.join(__dirname, 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'ai_reports.json');

const initReportsFile = async () => {
  await fs.ensureDir(DATA_DIR);
  if (!await fs.pathExists(REPORTS_FILE)) {
    await fs.writeJson(REPORTS_FILE, { reports: [] });
  }
};

// ROUTE 1 : TEST / PING
app.get('/api/wf1/data-collect', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    
    res.json({
      success: true,
      message: 'Backend Google Ads Auto - Opérationnel',
      timestamp: timestamp,
      version: '1.0.0',
      endpoints: {
        ping: '/api/wf1/data-collect',
        save: '/api/wf1/save-report',
        last: '/api/wf1/last-report',
        history: '/api/wf1/reports-history'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ROUTE 2 : SAUVEGARDER RAPPORT IA
app.post('/api/wf1/save-report', async (req, res) => {
  try {
    await initReportsFile();
    
    const report = req.body;
    const timestamp = new Date().toISOString();
    
    // Validation du format JSON
    const requiredFields = [
      'budget_warnings',
      'add_negative_keywords',
      'adjust_bids',
      'landing_page_issues',
      'status'
    ];
    
    const missingFields = requiredFields.filter(field => !(field in report));
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Format JSON invalide',
        missing_fields: missingFields
      });
    }
    
    // Charger les rapports existants
    const reportsData = await fs.readJson(REPORTS_FILE);
    
    // Ajouter le nouveau rapport
    const newReport = {
      id: `report_${Date.now()}`,
      timestamp: timestamp,
      data: report
    };
    
    reportsData.reports.unshift(newReport);
    
    // Garder les 30 derniers
    if (reportsData.reports.length > 30) {
      reportsData.reports = reportsData.reports.slice(0, 30);
    }
    
    await fs.writeJson(REPORTS_FILE, reportsData, { spaces: 2 });
    
    console.log(`✅ Rapport IA sauvegardé: ${newReport.id}`);
    
    res.json({
      success: true,
      message: 'Rapport IA sauvegardé avec succès',
      report_id: newReport.id,
      timestamp: timestamp,
      summary: {
        budget_warnings: report.budget_warnings.length,
        negative_keywords: report.add_negative_keywords.length,
        bid_adjustments: report.adjust_bids.length,
        landing_issues: report.landing_page_issues.length
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur save-report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ROUTE 3 : RÉCUPÉRER DERNIER RAPPORT
app.get('/api/wf1/last-report', async (req, res) => {
  try {
    await initReportsFile();
    
    const reportsData = await fs.readJson(REPORTS_FILE);
    
    if (!reportsData.reports || reportsData.reports.length === 0) {
      return res.json({
        success: true,
        message: 'Aucun rapport disponible',
        report: null
      });
    }
    
    const lastReport = reportsData.reports[0];
    
    res.json({
      success: true,
      message: 'Dernier rapport récupéré',
      report: lastReport
    });
    
  } catch (error) {
    console.error('❌ Erreur last-report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ROUTE BONUS : HISTORIQUE
app.get('/api/wf1/reports-history', async (req, res) => {
  try {
    await initReportsFile();
    
    const limit = parseInt(req.query.limit) || 10;
    const reportsData = await fs.readJson(REPORTS_FILE);
    
    const reports = reportsData.reports.slice(0, limit);
    
    res.json({
      success: true,
      total_reports: reportsData.reports.length,
      returned_reports: reports.length,
      reports: reports
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ======================================
// ROUTES SYSTÈME
// ======================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'Google Ads Auto Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      dashboard: '/wf1-dashboard.html',
      wf1_ping: '/api/wf1/data-collect',
      wf1_save: '/api/wf1/save-report',
      wf1_last: '/api/wf1/last-report',
      wf1_history: '/api/wf1/reports-history'
    }
  });
});

// Dashboard WF1
app.get('/wf1-dashboard.html', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Google Ads Auto – Dashboard WF1/WF2</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 16px;
      background: #0f172a;
      color: #e5e7eb;
    }
    h1 {
      font-size: 1.4rem;
      margin-bottom: 4px;
    }
    h2 {
      font-size: 1.1rem;
      margin-top: 24px;
      margin-bottom: 8px;
    }
    .card {
      background: #111827;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      margin-bottom: 16px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      padding: 4px 10px;
      border-radius: 999px;
      background: #1f2937;
      color: #9ca3af;
    }
    .status-ok {
      color: #22c55e;
    }
    .status-warn {
      color: #f97316;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
      margin-top: 8px;
    }
    .metric {
      background: #020617;
      border-radius: 10px;
      padding: 10px 12px;
    }
    .metric-label {
      font-size: 0.75rem;
      color: #9ca3af;
    }
    .metric-value {
      font-size: 1.2rem;
      font-weight: 600;
      margin-top: 2px;
    }
    pre {
      background: #020617;
      padding: 12px;
      border-radius: 10px;
      overflow-x: auto;
      font-size: 0.8rem;
    }
    button {
      background: #2563eb;
      color: #e5e7eb;
      border: none;
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 0.9rem;
      cursor: pointer;
    }
    button:active {
      transform: scale(0.98);
    }
    .small {
      font-size: 0.75rem;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
      <div>
        <h1>Google Ads Auto – Dernier rapport</h1>
        <div id="timestamp" class="small">Chargement…</div>
      </div>
      <button onclick="loadReport()">Rafraîchir</button>
    </div>

    <div id="status-tag" class="tag" style="margin-top:10px;">
      <span>Statut :</span>
      <strong id="status-value">–</strong>
    </div>

    <h2>Résumé rapide</h2>
    <div class="grid">
      <div class="metric">
        <div class="metric-label">Budget warnings</div>
        <div class="metric-value" id="m-budget">0</div>
      </div>
      <div class="metric">
        <div class="metric-label">Mots-clés négatifs</div>
        <div class="metric-value" id="m-negatives">0</div>
      </div>
      <div class="metric">
        <div class="metric-label">Ajustements d'enchères</div>
        <div class="metric-value" id="m-bids">0</div>
      </div>
      <div class="metric">
        <div class="metric-label">Problèmes de landing</div>
        <div class="metric-value" id="m-landing">0</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Détail complet du rapport (JSON)</h2>
    <pre id="json-raw">Chargement…</pre>
  </div>

  <script>
    async function loadReport() {
      try {
        const res = await fetch('/api/wf1/last-report');
        const data = await res.json();

        const ts = data.report?.timestamp || null;
        document.getElementById('timestamp').textContent =
          ts ? 'Reçu : ' + new Date(ts).toLocaleString() : 'Aucun rapport disponible';

        const status = data.report?.data?.status || 'unknown';
        const statusEl = document.getElementById('status-value');
        statusEl.textContent = status;

        const tag = document.getElementById('status-tag');
        if (status === 'analysis_complete') {
          tag.classList.add('status-ok');
          tag.classList.remove('status-warn');
        } else {
          tag.classList.add('status-warn');
          tag.classList.remove('status-ok');
        }

        const r = data.report?.data || {};
        document.getElementById('m-budget').textContent = (r.budget_warnings || []).length;
        document.getElementById('m-negatives').textContent = (r.add_negative_keywords || []).length;
        document.getElementById('m-bids').textContent = (r.adjust_bids || []).length;
        document.getElementById('m-landing').textContent = (r.landing_page_issues || []).length;

        document.getElementById('json-raw').textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        document.getElementById('timestamp').textContent = 'Erreur de chargement';
        document.getElementById('json-raw').textContent = String(err);
      }
    }

    loadReport();
  </script>
</body>
</html>`);
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// ======================================
// DÉMARRAGE SERVEUR
// ======================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================');
  console.log('🚀 Google Ads Auto - Backend Started');
  console.log('===========================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`✅ Routes WF1 activées`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('===========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM - Arrêt propre...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT - Arrêt propre...');
  process.exit(0);
});
