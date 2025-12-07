const express = require('express');
const router = express.Router();
const reportGenerator = require('../modules/reportGenerator');
const fs = require('fs-extra');
const path = require('path');

router.get('/daily-summary', async (req, res) => {
  try {
    const { date } = req.query;
    const report = await reportGenerator.generateDailyReport(date);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/reports/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const report = await reportGenerator.generateDailyReport(date);
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/archive-report', async (req, res) => {
  try {
    const report = req.body;
    const archivePath = path.join(__dirname, '../data/reports_archive.json');
    let archive = [];
    try { archive = await fs.readJson(archivePath); } catch {}
    archive.push({ ...report, archived_at: new Date().toISOString() });
    await fs.writeJson(archivePath, archive, { spaces: 2 });
    res.json({ success: true, message: 'Rapport archivé' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats/overview', async (req, res) => {
  try {
    const limitsManager = require('../modules/limitsManager');
    const history = await limitsManager.getHistoricalLimits(7);
    const currentLimits = await limitsManager.getRemainingLimits();
    res.json({ success: true, data: { current_limits: currentLimits, history_7days: history } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
