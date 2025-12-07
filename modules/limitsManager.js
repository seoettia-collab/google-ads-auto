const fs = require('fs-extra');
const path = require('path');
const { format } = require('date-fns');

class LimitsManager {
  constructor() {
    this.limitsPath = path.join(__dirname, '../data/daily_limits.json');
  }

  async initLimits() {
    try {
      await fs.readJson(this.limitsPath);
    } catch {
      await fs.writeJson(this.limitsPath, {}, { spaces: 2 });
    }
  }

  async getDailyLimits(date = null) {
    await this.initLimits();
    const limits = await fs.readJson(this.limitsPath);
    const today = date || format(new Date(), 'yyyy-MM-dd');
    if (!limits[today]) {
      limits[today] = { keywords_paused: 0, negatives_added: 0, bid_adjustments: 0, actions_log: [] };
      await fs.writeJson(this.limitsPath, limits, { spaces: 2 });
    }
    return limits[today];
  }

  async incrementLimit(actionType) {
    await this.initLimits();
    const limits = await fs.readJson(this.limitsPath);
    const today = format(new Date(), 'yyyy-MM-dd');
    if (!limits[today]) limits[today] = { keywords_paused: 0, negatives_added: 0, bid_adjustments: 0, actions_log: [] };
    if (actionType === 'PAUSE_KEYWORD') limits[today].keywords_paused++;
    if (actionType === 'ADD_NEGATIVE') limits[today].negatives_added++;
    if (actionType === 'ADJUST_BID') limits[today].bid_adjustments++;
    await fs.writeJson(this.limitsPath, limits, { spaces: 2 });
    return limits[today];
  }

  async getRemainingLimits() {
    const rulesPath = path.join(__dirname, '../config/security_rules.json');
    const rules = await fs.readJson(rulesPath);
    const current = await this.getDailyLimits();
    return {
      keywords_paused: { used: current.keywords_paused, max: rules.daily_limits.max_keywords_paused, remaining: rules.daily_limits.max_keywords_paused - current.keywords_paused },
      negatives_added: { used: current.negatives_added, max: rules.daily_limits.max_negatives_added, remaining: rules.daily_limits.max_negatives_added - current.negatives_added },
      bid_adjustments: { used: current.bid_adjustments, max: rules.daily_limits.max_bid_adjustments, remaining: rules.daily_limits.max_bid_adjustments - current.bid_adjustments }
    };
  }

  async getHistoricalLimits(days = 7) {
    await this.initLimits();
    const limits = await fs.readJson(this.limitsPath);
    const history = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      if (limits[dateStr]) history.push({ date: dateStr, ...limits[dateStr] });
    }
    return history.reverse();
  }
}

module.exports = new LimitsManager();
