const express = require('express');
const router = express.Router();
const securityChecker = require('../modules/securityChecker');
const limitsManager = require('../modules/limitsManager');
const fs = require('fs-extra');
const path = require('path');

router.get('/security-check', async (req, res) => {
  try {
    const action = req.query;
    if (typeof action.metrics === 'string') action.metrics = JSON.parse(action.metrics);
    const result = await securityChecker.checkAction(action);
    res.json({ success: true, check: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/security-check', async (req, res) => {
  try {
    const { actions } = req.body;
    const result = await securityChecker.checkBatchActions(actions);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/log-action', async (req, res) => {
  try {
    const action = req.body;
    const logPath = path.join(__dirname, '../data/actions_log.json');
    let log = [];
    try { log = await fs.readJson(logPath); } catch {}
    log.push({ ...action, logged_at: new Date().toISOString() });
    await fs.writeJson(logPath, log, { spaces: 2 });
    if (action.status === 'success') await limitsManager.incrementLimit(action.action_type);
    res.json({ success: true, message: 'Action loggée' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/daily-limits', async (req, res) => {
  try {
    const limits = await limitsManager.getRemainingLimits();
    res.json({ success: true, data: limits });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/emergency-alert', async (req, res) => {
  try {
    const alertSystem = require('../modules/alertSystem');
    const { type, message, data } = req.body;
    const alert = await alertSystem.sendAlert(type, message, data);
    res.json({ success: true, alert });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
