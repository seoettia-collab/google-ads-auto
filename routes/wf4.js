// ============================================
// WF4 ROUTES - REPORT GENERATOR
// ============================================

const express = require('express');
const router = express.Router();

// === DATA STORAGE ===
let wf4Reports = [];

// POST /api/wf4/save-report
router.post('/save-report', (req, res) => {
  try {
    const reportData = req.body;
    
    const report = {
      id: reportData.report_id || `RPT_${Date.now()}`,
      ...reportData,
      saved_at: new Date().toISOString()
    };
    
    wf4Reports.push(report);
    
    if (wf4Reports.length > 30) {
      wf4Reports = wf4Reports.slice(-30);
    }
    
    res.json({
      success: true,
      message: 'Rapport sauvegardé avec succès',
      report_id: report.id,
      timestamp: report.saved_at
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wf4/last-report
router.get('/last-report', (req, res) => {
  try {
    if (wf4Reports.length === 0) {
      return res.json({ success: true, message: 'Aucun rapport disponible', report: null });
    }
    res.json({ success: true, report: wf4Reports[wf4Reports.length - 1] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wf4/reports
router.get('/reports', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const reports = wf4Reports.slice(-limit).reverse();
    res.json({ success: true, count: reports.length, total: wf4Reports.length, reports: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/wf4/latest-html
router.get('/latest-html', (req, res) => {
  try {
    if (wf4Reports.length === 0) {
      return res.send('<h1>Aucun rapport disponible</h1>');
    }
    const lastReport = wf4Reports[wf4Reports.length - 1];
    if (!lastReport.html_report) {
      return res.send('<h1>Rapport HTML non disponible</h1>');
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(lastReport.html_report);
  } catch (error) {
    res.status(500).send('<h1>Erreur serveur</h1>');
  }
});

// GET /api/wf4/dashboard
router.get('/dashboard', (req, res) => {
  try {
    const reports = wf4Reports.slice(-10).reverse();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Dashboard Google Ads Auto</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #fff; }
    h1 { color: #4da6ff; }
    .reports-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
    .report-card { background: #16213e; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
    .report-card h3 { margin-top: 0; color: #4da6ff; }
    .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 15px 0; }
    .metric { background: #1a1a2e; padding: 10px; border-radius: 6px; text-align: center; }
    .metric-value { font-size: 20px; font-weight: bold; color: #4da6ff; }
    .metric-label { font-size: 11px; color: #888; }
    .btn { display: inline-block; padding: 8px 16px; background: #4da6ff; color: #1a1a2e; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .no-reports { text-align: center; padding: 50px; color: #888; }
  </style>
</head>
<body>
  <h1>📊 Dashboard Google Ads Auto</h1>
  <p>Rapports quotidiens - Mistral Pro Reno</p>
  
  ${reports.length === 0 ? '<div class="no-reports"><h2>Aucun rapport disponible</h2><p>Exécutez WF4 pour générer le premier rapport.</p></div>' : `
    <div class="reports-grid">
      ${reports.map(r => `
        <div class="report-card">
          <h3>📋 ${r.report_date || 'N/A'}</h3>
          <div class="metrics">
            <div class="metric"><div class="metric-value">${r.performance?.impressions?.toLocaleString() || 0}</div><div class="metric-label">Impressions</div></div>
            <div class="metric"><div class="metric-value">${r.performance?.clicks || 0}</div><div class="metric-label">Clics</div></div>
            <div class="metric"><div class="metric-value">${r.performance?.conversions || 0}</div><div class="metric-label">Conversions</div></div>
            <div class="metric"><div class="metric-value">${r.ai_analysis?.total_recommendations || 0}</div><div class="metric-label">Recos</div></div>
          </div>
          <a href="/api/wf4/html/${r.id}" class="btn">Voir détails</a>
        </div>
      `).join('')}
    </div>
  `}
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).send('<h1>Erreur serveur</h1>');
  }
});

// GET /api/wf4/html/:id
router.get('/html/:id', (req, res) => {
  try {
    const report = wf4Reports.find(r => r.id === req.params.id || r.report_id === req.params.id);
    if (!report || !report.html_report) {
      return res.status(404).send('<h1>Rapport non trouvé</h1>');
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(report.html_report);
  } catch (error) {
    res.status(500).send('<h1>Erreur serveur</h1>');
  }
});

module.exports = router;
