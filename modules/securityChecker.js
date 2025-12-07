const fs = require('fs-extra');
const path = require('path');

class SecurityChecker {
  constructor() {
    this.rulesPath = path.join(__dirname, '../config/security_rules.json');
    this.thresholdsPath = path.join(__dirname, '../config/thresholds.json');
    this.settingsPath = path.join(__dirname, '../config/settings.json');
  }

  async loadRules() {
    const rules = await fs.readJson(this.rulesPath);
    const thresholds = await fs.readJson(this.thresholdsPath);
    const settings = await fs.readJson(this.settingsPath);
    return { rules, thresholds, settings };
  }

  async checkAction(action) {
    const { rules, thresholds, settings } = await this.loadRules();

    if (settings.emergency_mode) {
      return { allowed: false, reason: 'EMERGENCY_MODE_ACTIVE', details: 'Toutes les actions sont bloquées en mode urgence' };
    }

    if (rules.forbidden_actions.includes(action.action_type)) {
      return { allowed: false, reason: 'FORBIDDEN_ACTION', details: `Action ${action.action_type} strictement interdite` };
    }

    const allowedAction = rules.allowed_actions[action.action_type];
    if (!allowedAction) {
      return { allowed: false, reason: 'UNKNOWN_ACTION', details: `Action ${action.action_type} non reconnue` };
    }

    const conditionCheck = await this.checkConditions(action, allowedAction, thresholds);
    if (!conditionCheck.valid) {
      return { allowed: false, reason: 'CONDITIONS_NOT_MET', details: conditionCheck.reason };
    }

    const whitelistCheck = await this.checkWhitelist(action, rules.whitelist_rules);
    if (!whitelistCheck.allowed) {
      return { allowed: false, reason: 'WHITELIST_PROTECTION', details: whitelistCheck.reason };
    }

    const limitsCheck = await this.checkDailyLimits(action.action_type, rules.daily_limits);
    if (!limitsCheck.allowed) {
      return { allowed: false, reason: 'DAILY_LIMIT_EXCEEDED', details: limitsCheck.reason };
    }

    return { allowed: true, reason: 'ALL_CHECKS_PASSED', details: 'Action autorisée' };
  }

  async checkConditions(action, allowedAction, thresholds) {
    const { action_type, metrics } = action;

    if (action_type === 'PAUSE_KEYWORD') {
      const rules = thresholds.keyword_pause;
      if (metrics.clicks < rules.min_clicks) return { valid: false, reason: `Clics insuffisants` };
      if (metrics.impressions < rules.min_impressions) return { valid: false, reason: `Impressions insuffisantes` };
      if (metrics.cost < rules.min_cost) return { valid: false, reason: `Coût insuffisant` };
      if (metrics.ctr > rules.max_ctr) return { valid: false, reason: `CTR trop élevé` };
      if (metrics.cpa < thresholds.target_cpa * rules.min_cpa_ratio) return { valid: false, reason: `CPA acceptable` };
    }

    if (action_type === 'ADD_NEGATIVE') {
      const rules = thresholds.negative_keyword;
      if (metrics.clicks < rules.min_clicks) return { valid: false, reason: `Clics insuffisants` };
      if (metrics.cost < rules.min_cost) return { valid: false, reason: `Coût insuffisant` };
      if (metrics.conversions > rules.max_conversions) return { valid: false, reason: `A généré des conversions` };
    }

    if (action_type === 'ADJUST_BID') {
      const rules = thresholds.bid_adjustment;
      if (metrics.clicks < rules.min_clicks) return { valid: false, reason: `Clics insuffisants` };
      if (action.adjustment_percent < 0 && Math.abs(action.adjustment_percent) > allowedAction.max_decrease_percent) {
        return { valid: false, reason: `Baisse trop importante` };
      }
      if (action.adjustment_percent > 0 && action.adjustment_percent > allowedAction.max_increase_percent) {
        return { valid: false, reason: `Hausse trop importante` };
      }
    }

    return { valid: true };
  }

  async checkWhitelist(action, whitelistRules) {
    if (action.action_type !== 'PAUSE_KEYWORD' && action.action_type !== 'ADJUST_BID') return { allowed: true };
    const dataPath = path.join(__dirname, '../data/raw_ads_data.json');
    try {
      const rawData = await fs.readJson(dataPath);
      const keyword = rawData.keywords?.find(k => k.id === action.keyword_id);
      if (keyword && keyword.conversions_30d >= whitelistRules.min_conversions_30d && keyword.cpa <= whitelistRules.max_cpa) {
        return { allowed: false, reason: `Keyword protégé : ${keyword.conversions_30d} conversions` };
      }
    } catch (error) {
      console.warn('Whitelist check failed:', error.message);
    }
    return { allowed: true };
  }

  async checkDailyLimits(actionType, limits) {
    const limitsPath = path.join(__dirname, '../data/daily_limits.json');
    try {
      const dailyLimits = await fs.readJson(limitsPath);
      const today = new Date().toISOString().split('T')[0];
      if (!dailyLimits[today]) dailyLimits[today] = { keywords_paused: 0, negatives_added: 0, bid_adjustments: 0 };
      const todayStats = dailyLimits[today];
      if (actionType === 'PAUSE_KEYWORD' && todayStats.keywords_paused >= limits.max_keywords_paused) return { allowed: false, reason: 'Limite keywords atteinte' };
      if (actionType === 'ADD_NEGATIVE' && todayStats.negatives_added >= limits.max_negatives_added) return { allowed: false, reason: 'Limite négatifs atteinte' };
      if (actionType === 'ADJUST_BID' && todayStats.bid_adjustments >= limits.max_bid_adjustments) return { allowed: false, reason: 'Limite enchères atteinte' };
    } catch (error) {
      console.warn('Limits check failed:', error.message);
    }
    return { allowed: true };
  }

  async checkBatchActions(actions) {
    const results = [];
    for (const action of actions) {
      const result = await this.checkAction(action);
      results.push({ action, check: result });
    }
    return {
      total: actions.length,
      allowed: results.filter(r => r.check.allowed).length,
      blocked: results.filter(r => !r.check.allowed).length,
      details: results
    };
  }
}

module.exports = new SecurityChecker();
