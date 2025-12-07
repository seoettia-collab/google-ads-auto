// ═══════════════════════════════════════════════════════════
// WF3 ROUTES - Action Executor
// Google Ads Auto - Option C
// ═══════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Chemins vers les fichiers de données
const DATA_DIR = path.join(__dirname, '..', 'data');
const LIMITS_FILE = path.join(DATA_DIR, 'daily_limits.json');
const EXECUTIONS_FILE = path.join(DATA_DIR, 'executions_log.json');

// Assurer que le dossier data existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Configuration des limites par défaut
const DEFAULT_LIMITS = {
  max_keywords_paused: 10,
  max_negatives_added: 20,
  max_bid_adjustments: 15
};

// Initialiser le fichier limits si nécessaire
function initializeLimitsFile() {
  const today = new Date().toISOString().split('T')[0];
  
  if (!fs.existsSync(LIMITS_FILE)) {
    const initialData = {
      date: today,
      current: {
        keywords_paused: 0,
        negatives_added: 0,
        bid_adjustments: 0
      },
      max: DEFAULT_LIMITS,
      last_reset: new Date().toISOString()
    };
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  
  // Vérifier si on doit reset (nouveau jour)
  const data = JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf8'));
  if (data.date !== today) {
    data.date = today;
    data.current = {
      keywords_paused: 0,
      negatives_added: 0,
      bid_adjustments: 0
    };
    data.last_reset = new Date().toISOString();
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(data, null, 2));
  }
  
  return data;
}

// Initialiser le fichier executions si nécessaire
if (!fs.existsSync(EXECUTIONS_FILE)) {
  fs.writeFileSync(EXECUTIONS_FILE, JSON.stringify({
    executions: [],
    last_execution: null
  }, null, 2));
}

// ═══════════════════════════════════════════════════════════
// GET /api/wf3/get-limits
// Retourne les limites quotidiennes et compteurs actuels
// ═══════════════════════════════════════════════════════════
router.get('/get-limits', (req, res) => {
  try {
    const data = initializeLimitsFile();
    
    res.json({
      success: true,
      date: data.date,
      current: data.current,
      max: data.max || DEFAULT_LIMITS,
      remaining: {
        keywords_paused: (data.max?.max_keywords_paused || DEFAULT_LIMITS.max_keywords_paused) - data.current.keywords_paused,
        negatives_added: (data.max?.max_negatives_added || DEFAULT_LIMITS.max_negatives_added) - data.current.negatives_added,
        bid_adjustments: (data.max?.max_bid_adjustments || DEFAULT_LIMITS.max_bid_adjustments) - data.current.bid_adjustments
      },
      last_reset: data.last_reset
    });
  } catch (error) {
    console.error('Erreur lecture limits:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la lecture des limites',
      details: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/wf3/update-limits
// Met à jour les compteurs après exécution d'actions
// ═══════════════════════════════════════════════════════════
router.post('/update-limits', (req, res) => {
  try {
    const { keywords_paused, negatives_added, bid_adjustments } = req.body;
    
    const data = initializeLimitsFile();
    
    // Incrémenter les compteurs
    if (keywords_paused) data.current.keywords_paused += keywords_paused;
    if (negatives_added) data.current.negatives_added += negatives_added;
    if (bid_adjustments) data.current.bid_adjustments += bid_adjustments;
    
    data.last_updated = new Date().toISOString();
    
    // Sauvegarder
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(data, null, 2));
    
    console.log(`✅ Limites mises à jour:`, data.current);
    
    res.json({
      success: true,
      message: 'Limites mises à jour',
      current: data.current,
      remaining: {
        keywords_paused: (data.max?.max_keywords_paused || DEFAULT_LIMITS.max_keywords_paused) - data.current.keywords_paused,
        negatives_added: (data.max?.max_negatives_added || DEFAULT_LIMITS.max_negatives_added) - data.current.negatives_added,
        bid_adjustments: (data.max?.max_bid_adjustments || DEFAULT_LIMITS.max_bid_adjustments) - data.current.bid_adjustments
      }
    });
  } catch (error) {
    console.error('Erreur update limits:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour des limites',
      details: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/wf3/save-execution
// Sauvegarde le rapport d'exécution de WF3
// ═══════════════════════════════════════════════════════════
router.post('/save-execution', (req, res) => {
  try {
    const executionReport = req.body;
    
    // Ajouter timestamp si manquant
    if (!executionReport.saved_at) {
      executionReport.saved_at = new Date().toISOString();
    }
    
    // Charger les exécutions existantes
    let data = { executions: [], last_execution: null };
    if (fs.existsSync(EXECUTIONS_FILE)) {
      data = JSON.parse(fs.readFileSync(EXECUTIONS_FILE, 'utf8'));
    }
    
    // Ajouter la nouvelle exécution
    data.executions.push(executionReport);
    data.last_execution = executionReport.saved_at;
    
    // Garder seulement les 100 dernières exécutions
    if (data.executions.length > 100) {
      data.executions = data.executions.slice(-100);
    }
    
    // Sauvegarder
    fs.writeFileSync(EXECUTIONS_FILE, JSON.stringify(data, null, 2));
    
    console.log(`✅ Exécution sauvegardée: ${executionReport.report_id || 'N/A'}`);
    
    res.json({
      success: true,
      message: 'Exécution sauvegardée',
      report_id: executionReport.report_id,
      timestamp: executionReport.saved_at
    });
  } catch (error) {
    console.error('Erreur sauvegarde exécution:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la sauvegarde',
      details: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/wf3/last-execution
// Retourne la dernière exécution
// ═══════════════════════════════════════════════════════════
router.get('/last-execution', (req, res) => {
  try {
    if (fs.existsSync(EXECUTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(EXECUTIONS_FILE, 'utf8'));
      const lastExecution = data.executions[data.executions.length - 1] || null;
      
      res.json({
        success: true,
        last_execution: lastExecution,
        total_executions: data.executions.length
      });
    } else {
      res.json({
        success: true,
        last_execution: null,
        message: 'Aucune exécution enregistrée'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/wf3/executions-history
// Retourne l'historique des exécutions
// ═══════════════════════════════════════════════════════════
router.get('/executions-history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    if (fs.existsSync(EXECUTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(EXECUTIONS_FILE, 'utf8'));
      const executions = data.executions.slice(-limit).reverse();
      
      res.json({
        success: true,
        executions: executions,
        total: data.executions.length,
        showing: executions.length
      });
    } else {
      res.json({
        success: true,
        executions: [],
        total: 0
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/wf3/reset-limits
// Reset manuel des limites (admin)
// ═══════════════════════════════════════════════════════════
router.post('/reset-limits', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const data = {
      date: today,
      current: {
        keywords_paused: 0,
        negatives_added: 0,
        bid_adjustments: 0
      },
      max: DEFAULT_LIMITS,
      last_reset: new Date().toISOString(),
      reset_reason: req.body.reason || 'Manual reset'
    };
    
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(data, null, 2));
    
    console.log(`🔄 Limites reset manuellement`);
    
    res.json({
      success: true,
      message: 'Limites réinitialisées',
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/wf3/status
// Statut du système d'exécution
// ═══════════════════════════════════════════════════════════
router.get('/status', (req, res) => {
  try {
    const limits = initializeLimitsFile();
    
    let lastExecution = null;
    let totalExecutions = 0;
    
    if (fs.existsSync(EXECUTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(EXECUTIONS_FILE, 'utf8'));
      lastExecution = data.last_execution;
      totalExecutions = data.executions?.length || 0;
    }
    
    res.json({
      success: true,
      status: 'operational',
      date: limits.date,
      current_limits: limits.current,
      last_execution: lastExecution,
      total_executions: totalExecutions
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
