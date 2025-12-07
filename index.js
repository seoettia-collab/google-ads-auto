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
      wf1_ping: '/api/wf1/data-collect',
      wf1_save: '/api/wf1/save-report',
      wf1_last: '/api/wf1/last-report',
      wf1_history: '/api/wf1/reports-history'
    }
  });
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
