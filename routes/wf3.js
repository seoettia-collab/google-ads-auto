// ============================================
// WF3 ROUTES - Action Executor (TEST MODE)
// À ajouter dans votre backend Render.com
// ============================================

const express = require('express');
const router = express.Router();

// Storage en mémoire (remplacer par DB en production)
let wf3Executions = [];
let dailyLimits = {
  date: new Date().toISOString().split('T')[0],
  keywords_paused: 0,
  bids_adjusted: 0,
  negatives_added: 0,
  max_keywords_paused: 10,
  max_bids_adjusted: 15,
  max_negatives_added: 20
};

// ============================================
// SECURITY ENGINE - Valide chaque action
// POST /api/wf3/security-check
// ============================================
router.post('/security-check', (req, res) => {
  try {
    const { workflow, customer_id, run_id, date, action } = req.body;
    
    // Règles de sécurité
    const ALLOWED_ACTIONS = ['PAUSE_KEYWORD', 'ADJUST_BID', 'ADD_NEGATIVE'];
    const FORBIDDEN_ACTIONS = ['MODIFY_BUDGET', 'PAUSE_CAMPAIGN', 'DELETE_CAMPAIGN', 'CREATE_CAMPAIGN'];
    const LIMITS = {
      max_keywords_paused: 10,
      max_bids_adjusted: 15,
      max_negatives_added: 20,
      bid_decrease_min: -20,
      bid_decrease_max: -10,
      bid_increase_min: 5,
      bid_increase_max: 15,
      min_confidence_score: 80
    };
    
    // Reset quotas si nouveau jour
    const today = new Date().toISOString().split('T')[0];
    if (dailyLimits.date !== today) {
      dailyLimits = {
        date: today,
        keywords_paused: 0,
        bids_adjusted: 0,
        negatives_added: 0,
        ...LIMITS
      };
    }
    
    let allowed = true;
    let reason = 'Action autorisée';
    const validations = [];
    
    // ===== VALIDATION 1: Action autorisée? =====
    if (!action || !action.type) {
      allowed = false;
      reason = 'Type d\'action manquant';
      validations.push({ check: 'action_type', passed: false, message: reason });
    } else if (FORBIDDEN_ACTIONS.includes(action.type)) {
      allowed = false;
      reason = `Action INTERDITE: ${action.type}. Les modifications de budget/campagne sont strictement interdites.`;
      validations.push({ check: 'forbidden_action', passed: false, message: reason });
    } else if (!ALLOWED_ACTIONS.includes(action.type)) {
      allowed = false;
      reason = `Action non reconnue: ${action.type}. Actions autorisées: ${ALLOWED_ACTIONS.join(', ')}`;
      validations.push({ check: 'unknown_action', passed: false, message: reason });
    } else {
      validations.push({ check: 'action_type', passed: true, message: `Action ${action.type} autorisée` });
    }
    
    // ===== VALIDATION 2: Limites quotidiennes =====
    if (allowed) {
      const actionData = action.data || {};
      
      switch (action.type) {
        case 'PAUSE_KEYWORD':
          if (dailyLimits.keywords_paused >= LIMITS.max_keywords_paused) {
            allowed = false;
            reason = `Limite quotidienne atteinte: ${LIMITS.max_keywords_paused} mots-clés pausés maximum par jour`;
            validations.push({ check: 'daily_limit', passed: false, message: reason });
          } else {
            validations.push({ 
              check: 'daily_limit', 
              passed: true, 
              message: `Quota OK: ${dailyLimits.keywords_paused}/${LIMITS.max_keywords_paused} keywords pausés` 
            });
          }
          break;
          
        case 'ADJUST_BID':
          if (dailyLimits.bids_adjusted >= LIMITS.max_bids_adjusted) {
            allowed = false;
            reason = `Limite quotidienne atteinte: ${LIMITS.max_bids_adjusted} ajustements d'enchères maximum par jour`;
            validations.push({ check: 'daily_limit', passed: false, message: reason });
          } else {
            // Vérifier les limites d'ajustement
            const adjustment = actionData.adjustment || 0;
            if (adjustment < LIMITS.bid_decrease_min) {
              allowed = false;
              reason = `Ajustement ${adjustment}% invalide. Minimum autorisé: ${LIMITS.bid_decrease_min}%`;
              validations.push({ check: 'bid_range', passed: false, message: reason });
            } else if (adjustment > LIMITS.bid_increase_max) {
              allowed = false;
              reason = `Ajustement ${adjustment}% invalide. Maximum autorisé: +${LIMITS.bid_increase_max}%`;
              validations.push({ check: 'bid_range', passed: false, message: reason });
            } else {
              validations.push({ 
                check: 'daily_limit', 
                passed: true, 
                message: `Quota OK: ${dailyLimits.bids_adjusted}/${LIMITS.max_bids_adjusted} ajustements` 
              });
              validations.push({ 
                check: 'bid_range', 
                passed: true, 
                message: `Ajustement ${adjustment}% dans la plage autorisée` 
              });
            }
          }
          break;
          
        case 'ADD_NEGATIVE':
          if (dailyLimits.negatives_added >= LIMITS.max_negatives_added) {
            allowed = false;
            reason = `Limite quotidienne atteinte: ${LIMITS.max_negatives_added} mots-clés négatifs maximum par jour`;
            validations.push({ check: 'daily_limit', passed: false, message: reason });
          } else {
            validations.push({ 
              check: 'daily_limit', 
              passed: true, 
              message: `Quota OK: ${dailyLimits.negatives_added}/${LIMITS.max_negatives_added} négatifs ajoutés` 
            });
          }
          break;
      }
    }
    
    // ===== VALIDATION 3: Score de confiance =====
    if (allowed) {
      const confidenceScore = action.data?.confidence_score || 0;
      if (confidenceScore < LIMITS.min_confidence_score) {
        allowed = false;
        reason = `Score de confiance insuffisant: ${confidenceScore}% (minimum requis: ${LIMITS.min_confidence_score}%)`;
        validations.push({ check: 'confidence_score', passed: false, message: reason });
      } else {
        validations.push({ 
          check: 'confidence_score', 
          passed: true, 
          message: `Score ${confidenceScore}% >= ${LIMITS.min_confidence_score}% minimum` 
        });
      }
    }
    
    // Réponse
    res.json({
      success: true,
      allowed: allowed,
      reason: reason,
      validations: validations,
      limits: {
        current: dailyLimits,
        max: LIMITS
      },
      rules: {
        allowed_actions: ALLOWED_ACTIONS,
        forbidden_actions: FORBIDDEN_ACTIONS
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      allowed: false,
      reason: `Erreur Security Engine: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// SAVE EXECUTION - Log chaque action
// POST /api/wf3/save-execution
// ============================================
router.post('/save-execution', (req, res) => {
  try {
    const execution = {
      id: `exec_${Date.now()}`,
      ...req.body,
      saved_at: new Date().toISOString()
    };
    
    wf3Executions.push(execution);
    
    // Garder les 100 dernières exécutions
    if (wf3Executions.length > 100) {
      wf3Executions = wf3Executions.slice(-100);
    }
    
    res.json({
      success: true,
      message: 'Exécution enregistrée',
      execution_id: execution.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// UPDATE LIMITS - Mettre à jour les quotas
// POST /api/wf3/update-limits
// ============================================
router.post('/update-limits', (req, res) => {
  try {
    const { action_type, allowed, executed } = req.body;
    
    // Reset quotas si nouveau jour
    const today = new Date().toISOString().split('T')[0];
    if (dailyLimits.date !== today) {
      dailyLimits = {
        date: today,
        keywords_paused: 0,
        bids_adjusted: 0,
        negatives_added: 0,
        max_keywords_paused: 10,
        max_bids_adjusted: 15,
        max_negatives_added: 20
      };
    }
    
    // Incrémenter les compteurs même en mode TEST (pour simuler)
    if (allowed) {
      switch (action_type) {
        case 'PAUSE_KEYWORD':
          dailyLimits.keywords_paused++;
          break;
        case 'ADJUST_BID':
          dailyLimits.bids_adjusted++;
          break;
        case 'ADD_NEGATIVE':
          dailyLimits.negatives_added++;
          break;
      }
    }
    
    res.json({
      success: true,
      message: 'Limites mises à jour',
      limits: dailyLimits,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// GET EXECUTIONS - Récupérer les logs
// GET /api/wf3/executions
// ============================================
router.get('/executions', (req, res) => {
  const { limit = 20, run_id } = req.query;
  
  let results = wf3Executions;
  
  if (run_id) {
    results = results.filter(e => e.run_id === run_id);
  }
  
  results = results.slice(-parseInt(limit)).reverse();
  
  res.json({
    success: true,
    count: results.length,
    executions: results,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// GET LIMITS - Récupérer les quotas actuels
// GET /api/wf3/limits
// ============================================
router.get('/limits', (req, res) => {
  res.json({
    success: true,
    limits: dailyLimits,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// RESET LIMITS - Réinitialiser les quotas (admin)
// POST /api/wf3/reset-limits
// ============================================
router.post('/reset-limits', (req, res) => {
  dailyLimits = {
    date: new Date().toISOString().split('T')[0],
    keywords_paused: 0,
    bids_adjusted: 0,
    negatives_added: 0,
    max_keywords_paused: 10,
    max_bids_adjusted: 15,
    max_negatives_added: 20
  };
  
  res.json({
    success: true,
    message: 'Limites réinitialisées',
    limits: dailyLimits,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

// ============================================
// INSTRUCTIONS D'INTÉGRATION
// ============================================
/*
Dans votre fichier principal (index.js ou app.js), ajoutez:

const wf3Routes = require('./routes/wf3');
app.use('/api/wf3', wf3Routes);

Routes disponibles:
- POST /api/wf3/security-check   → Valider une action
- POST /api/wf3/save-execution   → Enregistrer une exécution
- POST /api/wf3/update-limits    → Mettre à jour les quotas
- GET  /api/wf3/executions       → Voir les logs
- GET  /api/wf3/limits           → Voir les quotas actuels
- POST /api/wf3/reset-limits     → Réinitialiser les quotas

*/
