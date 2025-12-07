// ======================================
// ROUTES WF1 - Google Ads Auto Backend
// ======================================
// Fichier: routes/wf1.js

const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

// Chemins de stockage
const DATA_DIR = path.join(__dirname, '../data');
const REPORTS_FILE = path.join(DATA_DIR, 'ai_reports.json');

// Initialiser le fichier des rapports s'il n'existe pas
const initReportsFile = async () => {
  await fs.ensureDir(DATA_DIR);
  if (!await fs.pathExists(REPORTS_FILE)) {
    await fs.writeJson(REPORTS_FILE, { reports: [] });
  }
};

// ===================================
// ROUTE 1 : TEST / PING BACKEND
// ===================================
// GET /api/wf1/data-collect
router.get('/data-collect', async (req, res) => {
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
        last: '/api/wf1/last-report'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===================================
// ROUTE 2 : SAUVEGARDER RAPPORT IA
// ===================================
// POST /api/wf1/save-report
router.post('/save-report', async (req, res) => {
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
    
    // Ajouter le nouveau rapport avec timestamp et ID
    const newReport = {
      id: `report_${Date.now()}`,
      timestamp: timestamp,
      data: report
    };
    
    reportsData.reports.unshift(newReport); // Ajouter au début
    
    // Garder seulement les 30 derniers rapports
    if (reportsData.reports.length > 30) {
      reportsData.reports = reportsData.reports.slice(0, 30);
    }
    
    // Sauvegarder
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

// ===================================
// ROUTE 3 : RÉCUPÉRER DERNIER RAPPORT
// ===================================
// GET /api/wf1/last-report
router.get('/last-report', async (req, res) => {
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
    
    // Retourner le dernier rapport
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

// ===================================
// ROUTE BONUS : HISTORIQUE COMPLET
// ===================================
// GET /api/wf1/reports-history?limit=10
router.get('/reports-history', async (req, res) => {
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

module.exports = router;
