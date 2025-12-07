const fs = require('fs-extra');
const path = require('path');

class AlertSystem {
  constructor() {
    this.settingsPath = path.join(__dirname, '../config/settings.json');
    this.thresholdsPath = path.join(__dirname, '../config/thresholds.json');
  }

  async sendAlert(type, message, data = {}) {
    const alert = { type, message, data, timestamp: new Date().toISOString(), sent: false };
    console.log(`🚨 ALERT [${type}]:`, message);
    const settings = await fs.readJson(this.settingsPath);
    if (settings.notifications.send_alerts) {
      await this.logAlert(alert);
      alert.sent = true;
    }
    return alert;
  }

  async checkEmergencyConditions(rawData) {
    const thresholds = await fs.readJson(this.thresholdsPath);
    const emergency = thresholds.emergency_thresholds;
    const alerts = [];
    if (rawData.campaigns) {
      for (const campaign of rawData.campaigns) {
        const avgDailySpend = campaign.cost_30d / 30;
        const todaySpend = campaign.cost_today || 0;
        if (todaySpend > avgDailySpend * emergency.budget_spent_multiplier) {
          alerts.push(await this.sendAlert('EMERGENCY_BUDGET', `Budget anormal sur ${campaign.name}`, {
            campaign_id: campaign.id, avg_daily: avgDailySpend, today: todaySpend
          }));
        }
        if (campaign.cpa > thresholds.target_cpa * emergency.cpa_multiplier) {
          alerts.push(await this.sendAlert('EMERGENCY_CPA', `CPA anormal sur ${campaign.name}`, {
            campaign_id: campaign.id, cpa: campaign.cpa, target: thresholds.target_cpa
          }));
        }
      }
    }
    if (alerts.length > 0) await this.activateEmergencyMode();
    return alerts;
  }

  async activateEmergencyMode() {
    const settings = await fs.readJson(this.settingsPath);
    settings.emergency_mode = true;
    await fs.writeJson(this.settingsPath, settings, { spaces: 2 });
    await this.sendAlert('EMERGENCY_MODE_ACTIVATED', 'Mode urgence activé', { activated_at: new Date().toISOString() });
    console.log('🚨 MODE URGENCE ACTIVÉ');
  }

  async deactivateEmergencyMode() {
    const settings = await fs.readJson(this.settingsPath);
    settings.emergency_mode = false;
    await fs.writeJson(this.settingsPath, settings, { spaces: 2 });
    await this.sendAlert('EMERGENCY_MODE_DEACTIVATED', 'Mode urgence désactivé', { deactivated_at: new Date().toISOString() });
    console.log('✅ MODE URGENCE DÉSACTIVÉ');
  }

  async logAlert(alert) {
    const alertsLogPath = path.join(__dirname, '../data/alerts_log.json');
    let alerts = [];
    try { alerts = await fs.readJson(alertsLogPath); } catch {}
    alerts.push(alert);
    await fs.writeJson(alertsLogPath, alerts, { spaces: 2 });
  }

  async getRecentAlerts(limit = 10) {
    const alertsLogPath = path.join(__dirname, '../data/alerts_log.json');
    try {
      const alerts = await fs.readJson(alertsLogPath);
      return alerts.slice(-limit).reverse();
    } catch { return []; }
  }
}

module.exports = new AlertSystem();
