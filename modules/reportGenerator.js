const fs = require('fs-extra');
const path = require('path');
const { format } = require('date-fns');

class ReportGenerator {
  constructor() {
    this.dataPath = path.join(__dirname, '../data');
  }

  async generateDailyReport(date = null) {
    const reportDate = date || format(new Date(), 'yyyy-MM-dd');
    const actionsLog = await this.loadActionsLog();
    const recommendations = await this.loadRecommendations();
    const dailyLimits = await this.loadDailyLimits(reportDate);
    const todayActions = actionsLog.filter(a => a.timestamp?.startsWith(reportDate));
    
    return {
      date: reportDate,
      generated_at: new Date().toISOString(),
      summary: {
        total_recommendations: recommendations.length,
        actions_executed: todayActions.length,
        actions_blocked: todayActions.filter(a => a.status === 'blocked').length,
        actions_successful: todayActions.filter(a => a.status === 'success').length,
        actions_failed: todayActions.filter(a => a.status === 'failed').length
      },
      limits: dailyLimits,
      actions_by_type: this.groupActionsByType(todayActions),
      actions_detail: todayActions,
      estimated_savings: this.calculateEstimatedSavings(todayActions)
    };
  }

  groupActionsByType(actions) {
    const grouped = { PAUSE_KEYWORD: [], ADD_NEGATIVE: [], ADJUST_BID: [] };
    actions.forEach(action => { if (grouped[action.action_type]) grouped[action.action_type].push(action); });
    return {
      PAUSE_KEYWORD: { count: grouped.PAUSE_KEYWORD.length, successful: grouped.PAUSE_KEYWORD.filter(a => a.status === 'success').length },
      ADD_NEGATIVE: { count: grouped.ADD_NEGATIVE.length, successful: grouped.ADD_NEGATIVE.filter(a => a.status === 'success').length },
      ADJUST_BID: { count: grouped.ADJUST_BID.length, successful: grouped.ADJUST_BID.filter(a => a.status === 'success').length }
    };
  }

  calculateEstimatedSavings(actions) {
    let totalSavings = 0;
    actions.forEach(action => {
      if (action.status === 'success') {
        if (action.action_type === 'PAUSE_KEYWORD' && action.metrics) totalSavings += (action.metrics.cost / 30) * 30;
        if (action.action_type === 'ADJUST_BID' && action.adjustment_percent < 0) {
          const reduction = Math.abs(action.adjustment_percent) / 100;
          totalSavings += (action.metrics?.cost || 0) * reduction * 0.3;
        }
      }
    });
    return { estimated_monthly_savings: Math.round(totalSavings * 100) / 100, currency: 'EUR' };
  }

  async loadActionsLog() {
    try { return await fs.readJson(path.join(this.dataPath, 'actions_log.json')); }
    catch { return []; }
  }

  async loadRecommendations() {
    try { return await fs.readJson(path.join(this.dataPath, 'recommendations.json')); }
    catch { return []; }
  }

  async loadDailyLimits(date) {
    try {
      const limits = await fs.readJson(path.join(this.dataPath, 'daily_limits.json'));
      return limits[date] || {};
    } catch { return {}; }
  }
}

module.exports = new ReportGenerator();
