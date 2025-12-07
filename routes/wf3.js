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
const WHITELIST_FILE = path.join(DATA_DIR, 'whitelist.json');

// Assurer que le dossier data existe
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ═══════════════════════════════════════════════════════════
// CONFIGURATION DES RÈGLES DE SÉCURITÉ
// ═══════════════════════════════════════════════════════════

// Limites quotidiennes par défaut
const DEFAULT_LIMITS = {
  max_keywords_paused: 10,
  max_negatives_added: 20,
  max_bid_adjustments: 15
};

// Seuils de performance
const THRESHOLDS = {
  min_clicks: 5,              // Minimum de clics avant action
  min_impressions: 100,       // Minimum d'impressions avant action
  min_cost: 1.0,              // Minimum de coût (€) avant action
  max_cpa_multiplier: 2.0,    // CPA max = CPA cible × 2
  min_ctr: 0.5,               // CTR minimum (%)
  min_conversion_rate: 0.5,   // Taux de conversion minimum (%)
  no_conversion_days: 30,     // Jours sans conversion pour pause
  bid_decrease_max: -20,      // Baisse d'enchère max (%)
  bid_increase_max: 15,       // Hausse d'enchère max (%)
  min_confidence_score: 80    // Score de confiance minimum (%)
};

// Actions autorisées (selon le protocole)
const ALLOWED_ACTIONS = [
  'PAUSE_KEYWORD',
  'ADJUST_BID', 
  'ADD_NEGATIVE'
];

// Actions INTERDITES (JAMAIS exécutées)
const FORBIDDEN_ACTIONS = [
  'MODIFY_BUDGET',
  'PAUSE_CAMPAIGN',
  'ENABLE_CAMPAIGN',
  'DELETE_CAMPAIGN',
  'DELETE_AD_GROUP',
  'CREATE_CAMPAIGN',
  'DUPLICATE_CAMPAIGN',
  'MODIFY_CAMPAIGN_OBJECTIVE'
];

// ═══════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════

// Initialiser le fichier limits
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

// Charger la whitelist (mots-clés protégés)
function loadWhitelist() {
  if (!fs.existsSync(WHITELIST_FILE)) {
    const defaultWhitelist = {
      keywords: [],
      campaigns: [],
      ad_groups: [],
      last_updated: new Date().toISOString()
    };
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(defaultWhitelist, null, 2));
    return defaultWhitelist;
  }
  return JSON.parse(fs.readFileSync(WHITELIST_FILE, 'utf8'));
}

// Initialiser le fichier executions
if (!fs.existsSync(EXECUTIONS_FILE)) {
  fs.writeFileSync(EXECUTIONS_FILE, JSON.stringify({
    executions: [],
    last_execution: null
  }, null, 2));
}

// ═══════════════════════════════════════════════════════════
// POST /api/wf3/security-check
// 🔒 MOTEUR DE SÉCURITÉ - Valide chaque action avant exécution
// ═══════════════════════════════════════════════════════════
router.post('/security-check', (req, res) => {
  try {
    const { workflow, customer_id, run_id, date, action } = req.body;
    
    console.log(`🔒 Security Check - ${action?.type || 'UNKNOWN'} - Run: ${run_id}`);
    
    // Résultat par défaut
    const result = {
      allowed: false,
      reasons: [],
      warnings: [],
      action: action,
      limits: null,
      checked_at: new Date().toISOString(),
      run_id: run_id,
      customer_id: customer_id
    };
    
    // ═══════════════════════════════════════════════════════
    // VÉRIFICATION 1: Action fournie ?
    // ═══════════════════════════════════════════════════════
    if (!action || !action.type) {
      result.reasons.push('ACTION_MISSING: Aucune action fournie');
      return res.json(result);
    }
    
    const actionType = action.type.toUpperCase();
    const actionData = action.data || {};
    
    // ═══════════════════════════════════════════════════════
    // VÉRIFICATION 2: Action INTERDITE ?
    // ═══════════════════════════════════════════════════════
    if (FORBIDDEN_ACTIONS.includes(actionType)) {
      result.reasons.push(`FORBIDDEN_ACTION: L'action "${actionType}" est strictement interdite par le protocole`);
      console.log(`🚫 ACTION INTERDITE BLOQUÉE: ${actionType}`);
      return res.json(result);
    }
    
    // ═══════════════════════════════════════════════════════
    // VÉRIFICATION 3: Action autorisée ?
    // ═══════════════════════════════════════════════════════
    if (!ALLOWED_ACTIONS.includes(actionType)) {
      result.reasons.push(`UNAUTHORIZED_ACTION: L'action "${actionType}" n'est pas dans la liste des actions autorisées`);
      return res.json(result);
    }
    
    // ═══════════════════════════════════════════════════════
    // VÉRIFICATION 4: Limites journalières
    // ═══════════════════════════════════════════════════════
    const limits = initializeLimitsFile();
    result.limits = {
      current: limits.current,
      max: limits.max || DEFAULT_LIMITS,
      remaining: {
        keywords_paused: (limits.max?.max_keywords_paused || DEFAULT_LIMITS.max_keywords_paused) - limits.current.keywords_paused,
        negatives_added: (limits.max?.max_negatives_added || DEFAULT_LIMITS.max_negatives_added) - limits.current.negatives_added,
        bid_adjustments: (limits.max?.max_bid_adjustments || DEFAULT_LIMITS.max_bid_adjustments) - limits.current.bid_adjustments
      }
    };
    
    // Vérifier limite selon type d'action
    if (actionType === 'PAUSE_KEYWORD') {
      if (result.limits.remaining.keywords_paused <= 0) {
        result.reasons.push(`DAILY_LIMIT_REACHED: Limite de mots-clés pausés atteinte (${limits.max?.max_keywords_paused || DEFAULT_LIMITS.max_keywords_paused}/jour)`);
        return res.json(result);
      }
    } else if (actionType === 'ADJUST_BID') {
      if (result.limits.remaining.bid_adjustments <= 0) {
        result.reasons.push(`DAILY_LIMIT_REACHED: Limite d'ajustements d'enchères atteinte (${limits.max?.max_bid_adjustments || DEFAULT_LIMITS.max_bid_adjustments}/jour)`);
        return res.json(result);
      }
    } else if (actionType === 'ADD_NEGATIVE') {
      if (result.limits.remaining.negatives_added <= 0) {
        result.reasons.push(`DAILY_LIMIT_REACHED: Limite de mots-clés négatifs atteinte (${limits.max?.max_negatives_added || DEFAULT_LIMITS.max_negatives_added}/jour)`);
        return res.json(result);
      }
    }
    
    // ═══════════════════════════════════════════════════════
    // VÉRIFICATION 5: Whitelist (mots-clés protégés)
    // ═══════════════════════════════════════════════════════
    const whitelist = loadWhitelist();
    const keywordId = actionData.criterion_id || actionData.keyword_id;
    const keywordText = actionData.keyword || actionData.keyword_text;
    
    if (actionType === 'PAUSE_KEYWORD' && keywordId) {
      // Vérifier si le mot-clé est dans la whitelist
      const isWhitelisted = whitelist.keywords.some(k => 
        k.criterion_id === keywordId || 
        k.keyword_text?.toLowerCase() === keywordText?.toLowerCase()
      );
      
      if (isWhitelisted) {
        result.reasons.push(`WHITELIST_PROTECTED: Le mot-clé "${keywordText || keywordId}" est protégé (conversion récente)`);
        return res.json(result);
      }
    }
    
    // ═══════════════════════════════════════════════════════
    // VÉRIFICATION 6: Seuils de performance (si données fournies)
    // ═══════════════════════════════════════════════════════
    const metrics = actionData.metrics || {};
    
    // Vérifier volume minimum
    if (metrics.clicks !== undefined && metrics.clicks < THRESHOLDS.min_clicks) {
      result.warnings.push(`LOW_VOLUME: Seulement ${metrics.clicks} clics (minimum: ${THRESHOLDS.min_clicks})`);
    }
    
    if (metrics.impressions !== undefined && metrics.impressions < THRESHOLDS.min_impressions) {
      result.warnings.push(`LOW_IMPRESSIONS: Seulement ${metrics.impressions} impressions (minimum: ${THRESHOLDS.min_impressions})`);
    }
    
    // ═══════════════════════════════════════════════════════
    // VÉRIFICATION 7: Ajustement d'enchère dans les limites
    // ═══════════════════════════════════════════════════════
    if (actionType === 'ADJUST_BID') {
      const adjustment = actionData.adjustment || actionData.bid_adjustment || 0;
      
      if (adjustment < THRESHOLDS.bid_decrease_max) {
        result.reasons.push(`BID_ADJUSTMENT_TOO_LOW: Ajustement de ${adjustment}% dépasse la limite de ${THRESHOLDS.bid_decrease_max}%`);
        return res.json(result);
      }
      
      if (adjustment > THRESHOLDS.bid_increase_max) {
        result.reasons.push(`BID_ADJUSTMENT_TOO_HIGH: Ajustement de ${adjustment}% dépasse la limite de +${THRESHOLDS.bid_increase_max}%`);
        return res.json(result);
      }
    }
    
    // ═══════════════════════════════════════════════════════
    // VÉRIFICATION 8: Score de confiance (si fourni)
    // ═══════════════════════════════════════════════════════
    const confidence = actionData.confidence_score || actionData.confidence || 100;
    
    if (confidence < THRESHOLDS.min_confidence_score) {
      result.reasons.push(`LOW_CONFIDENCE: Score de confiance ${confidence}% inférieur au minimum (${THRESHOLDS.min_confidence_score}%)`);
      return res.json(result);
    }
    
    // ═══════════════════════════════════════════════════════
    // ✅ TOUTES LES VÉRIFICATIONS PASSÉES - ACTION AUTORISÉE
    // ═══════════════════════════════════════════════════════
    result.allowed = true;
    result.reasons = ['ALL_CHECKS_PASSED'];
    
    console.log(`✅ Security Check PASSED - ${actionType} - Run: ${run_id}`);
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Erreur security-check:', error);
    res.status(500).json({
      allowed: false,
      reasons: [`SERVER_ERROR: ${error.message}`],
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/wf3/security-rules
// Retourne les règles de sécurité actuelles
// ═══════════════════════════════════════════════════════════
router.get('/security-rules', (req, res) => {
  try {
    res.json({
      success: true,
      allowed_actions: ALLOWED_ACTIONS,
      forbidden_actions: FORBIDDEN_ACTIONS,
      thresholds: THRESHOLDS,
      default_limits: DEFAULT_LIMITS
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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
// GET /api/wf3/whitelist
// Retourne la whitelist actuelle
// ═══════════════════════════════════════════════════════════
router.get('/whitelist', (req, res) => {
  try {
    const whitelist = loadWhitelist();
    res.json({
      success: true,
      ...whitelist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/wf3/whitelist/add
// Ajouter un mot-clé à la whitelist
// ═══════════════════════════════════════════════════════════
router.post('/whitelist/add', (req, res) => {
  try {
    const { criterion_id, keyword_text, campaign_id, ad_group_id, reason } = req.body;
    
    const whitelist = loadWhitelist();
    
    // Vérifier si déjà présent
    const exists = whitelist.keywords.some(k => k.criterion_id === criterion_id);
    if (exists) {
      return res.json({
        success: false,
        message: 'Mot-clé déjà dans la whitelist'
      });
    }
    
    whitelist.keywords.push({
      criterion_id,
      keyword_text,
      campaign_id,
      ad_group_id,
      reason: reason || 'Manual addition',
      added_at: new Date().toISOString()
    });
    
    whitelist.last_updated = new Date().toISOString();
    
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(whitelist, null, 2));
    
    res.json({
      success: true,
      message: 'Mot-clé ajouté à la whitelist',
      keyword: keyword_text
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/wf3/whitelist/remove
// Retirer un mot-clé de la whitelist
// ═══════════════════════════════════════════════════════════
router.post('/whitelist/remove', (req, res) => {
  try {
    const { criterion_id } = req.body;
    
    const whitelist = loadWhitelist();
    
    const initialLength = whitelist.keywords.length;
    whitelist.keywords = whitelist.keywords.filter(k => k.criterion_id !== criterion_id);
    
    if (whitelist.keywords.length === initialLength) {
      return res.json({
        success: false,
        message: 'Mot-clé non trouvé dans la whitelist'
      });
    }
    
    whitelist.last_updated = new Date().toISOString();
    
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(whitelist, null, 2));
    
    res.json({
      success: true,
      message: 'Mot-clé retiré de la whitelist'
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
    const whitelist = loadWhitelist();
    
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
      security_engine: 'active',
      date: limits.date,
      current_limits: limits.current,
      max_limits: limits.max || DEFAULT_LIMITS,
      whitelist_count: whitelist.keywords?.length || 0,
      last_execution: lastExecution,
      total_executions: totalExecutions,
      allowed_actions: ALLOWED_ACTIONS,
      forbidden_actions: FORBIDDEN_ACTIONS
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
