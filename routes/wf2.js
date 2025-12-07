// ═══════════════════════════════════════════════════════════
// WF2 ROUTES - Recommandations GPT
// Google Ads Auto - Option C
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Chemin vers le fichier de données
const DATA_DIR = path.join(__dirname, '..', 'data');
const RECOMMENDATIONS_FILE = path.join(DATA_DIR, 'recommendations.json');

// Assurer que le dossier data existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialiser le fichier si nécessaire
if (!fs.existsSync(RECOMMENDATIONS_FILE)) {
  fs.writeFileSync(RECOMMENDATIONS_FILE, JSON.stringify({
    last_updated: null,
    recommendations: [],
    campaign_id: null,
    campaign_name: null,
    analysis_date: null,
    summary: {}
  }, null, 2));
}

// ═══════════════════════════════════════════════════════════
// GET /api/wf2/last-recommendations
// Retourne les dernières recommandations générées par WF2
// ═══════════════════════════════════════════════════════════
router.get('/last-recommendations', (req, res) => {
  try {
    if (fs.existsSync(RECOMMENDATIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(RECOMMENDATIONS_FILE, 'utf8'));
      res.json({
        success: true,
        ...data
      });
    } else {
      res.json({
        success: true,
        recommendations: [],
        message: 'Aucune recommandation disponible'
      });
    }
  } catch (error) {
    console.error('Erreur lecture recommandations:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la lecture des recommandations',
      details: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/wf2/save-recommendations
// Sauvegarde les recommandations générées par WF2/GPT
// ═══════════════════════════════════════════════════════════
router.post('/save-recommendations', (req, res) => {
  try {
    const data = req.body;
    
    // Ajouter timestamp
    data.last_updated = new Date().toISOString();
    data.saved_by = 'WF2_ANALYZER_GPT';
    
    // Sauvegarder
    fs.writeFileSync(RECOMMENDATIONS_FILE, JSON.stringify(data, null, 2));
    
    console.log(`✅ Recommandations sauvegardées: ${data.recommendations?.length || 0} items`);
    
    res.json({
      success: true,
      message: 'Recommandations sauvegardées',
      count: data.recommendations?.length || 0,
      timestamp: data.last_updated
    });
  } catch (error) {
    console.error('Erreur sauvegarde recommandations:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la sauvegarde',
      details: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/wf2/status
// Statut du système de recommandations
// ═══════════════════════════════════════════════════════════
router.get('/status', (req, res) => {
  try {
    let lastUpdate = null;
    let recoCount = 0;
    
    if (fs.existsSync(RECOMMENDATIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(RECOMMENDATIONS_FILE, 'utf8'));
      lastUpdate = data.last_updated;
      recoCount = data.recommendations?.length || 0;
    }
    
    res.json({
      success: true,
      status: 'operational',
      last_update: lastUpdate,
      recommendations_count: recoCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;
