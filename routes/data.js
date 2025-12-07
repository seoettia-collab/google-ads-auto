const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

router.post('/store-raw-data', async (req, res) => {
  try {
    const data = req.body;
    const dataPath = path.join(__dirname, '../data/raw_ads_data.json');
    await fs.writeJson(dataPath, { ...data, last_updated: new Date().toISOString() }, { spaces: 2 });
    res.json({ success: true, message: 'Données stockées', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/raw-data', async (req, res) => {
  try {
    const dataPath = path.join(__dirname, '../data/raw_ads_data.json');
    const data = await fs.readJson(dataPath);
    res.json({ success: true, data });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Aucune donnée disponible' });
  }
});

router.post('/store-recommendations', async (req, res) => {
  try {
    const recommendations = req.body;
    const recoPath = path.join(__dirname, '../data/recommendations.json');
    await fs.writeJson(recoPath, { recommendations: recommendations.recommendations || recommendations, generated_at: new Date().toISOString() }, { spaces: 2 });
    res.json({ success: true, message: 'Recommandations stockées', count: recommendations.recommendations?.length || 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/recommendations', async (req, res) => {
  try {
    const recoPath = path.join(__dirname, '../data/recommendations.json');
    const data = await fs.readJson(recoPath);
    res.json({ success: true, data: data.recommendations || [] });
  } catch (error) {
    res.status(404).json({ success: false, error: 'Aucune recommandation disponible' });
  }
});

module.exports = router;
