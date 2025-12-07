const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

router.get('/', async (req, res) => {
  try {
    const settings = await fs.readJson(path.join(__dirname, '../config/settings.json'));
    const rules = await fs.readJson(path.join(__dirname, '../config/security_rules.json'));
    const thresholds = await fs.readJson(path.join(__dirname, '../config/thresholds.json'));
    res.json({ success: true, data: { settings, rules, thresholds } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { settings, thresholds } = req.body;
    if (settings) await fs.writeJson(path.join(__dirname, '../config/settings.json'), settings, { spaces: 2 });
    if (thresholds) await fs.writeJson(path.join(__dirname, '../config/thresholds.json'), thresholds, { spaces: 2 });
    res.json({ success: true, message: 'Configuration mise à jour' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/mode', async (req, res) => {
  try {
    const { mode } = req.body;
    const validModes = ['analyse', 'semi-auto', 'auto'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ success: false, error: 'Mode invalide' });
    }
    const settingsPath = path.join(__dirname, '../config/settings.json');
    const settings = await fs.readJson(settingsPath);
    settings.mode = mode;
    settings.auto_execute = (mode === 'auto');
    await fs.writeJson(settingsPath, settings, { spaces: 2 });
    res.json({ success: true, message: `Mode changé: ${mode}`, data: { mode, auto_execute: settings.auto_execute } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
