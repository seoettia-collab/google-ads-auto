const API_URL = window.location.origin;
let currentMode = 'analyse';
let emergencyMode = false;

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadStats();
  setupEventListeners();
  setInterval(loadStats, 30000);
});

function setupEventListeners() {
  document.getElementById('modeSelect').addEventListener('change', changeMode);
  document.getElementById('refreshBtn').addEventListener('click', loadStats);
  document.getElementById('emergencyBtn').addEventListener('click', toggleEmergency);
  document.getElementById('reportBtn').addEventListener('click', generateReport);
}

async function loadConfig() {
  try {
    const response = await fetch(`${API_URL}/api/config`);
    const data = await response.json();
    if (data.success) {
      currentMode = data.data.settings.mode;
      emergencyMode = data.data.settings.emergency_mode;
      document.getElementById('modeSelect').value = currentMode;
      updateEmergencyStatus();
    }
  } catch (error) {
    console.error('Erreur chargement config:', error);
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${API_URL}/api/stats/overview`);
    const data = await response.json();
    if (data.success) {
      updateMetrics(data.data.current_limits);
      document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('fr-FR');
    }
  } catch (error) {
    console.error('Erreur chargement stats:', error);
  }
  loadRecentActions();
}

function updateMetrics(limits) {
  document.getElementById('keywordsPaused').textContent = limits.keywords_paused.used;
  document.getElementById('maxKeywords').textContent = limits.keywords_paused.max;
  document.getElementById('negativesAdded').textContent = limits.negatives_added.used;
  document.getElementById('maxNegatives').textContent = limits.negatives_added.max;
  document.getElementById('bidAdjustments').textContent = limits.bid_adjustments.used;
  document.getElementById('maxBids').textContent = limits.bid_adjustments.max;
}

async function loadRecentActions() {
  try {
    const response = await fetch(`${API_URL}/api/daily-summary`);
    const data = await response.json();
    if (data.success && data.report.actions_detail.length > 0) {
      const actionsHtml = data.report.actions_detail.slice(-5).reverse().map(action => `
        <div class="action-item">
          <strong>${action.action_type}</strong> - ${action.status}
          <br><small>${new Date(action.timestamp).toLocaleTimeString('fr-FR')}</small>
        </div>
      `).join('');
      document.getElementById('actionsLog').innerHTML = actionsHtml;
      document.getElementById('recommendations').textContent = data.report.summary.total_recommendations;
    }
  } catch (error) {
    console.error('Erreur chargement actions:', error);
  }
}

async function changeMode(event) {
  const newMode = event.target.value;
  try {
    const response = await fetch(`${API_URL}/api/config/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode })
    });
    const data = await response.json();
    if (data.success) {
      currentMode = newMode;
      alert(`Mode changé: ${newMode}`);
    }
  } catch (error) {
    console.error('Erreur changement mode:', error);
    alert('Erreur lors du changement de mode');
  }
}

async function toggleEmergency() {
  const newState = !emergencyMode;
  if (confirm(`Confirmer ${newState ? 'activation' : 'désactivation'} du mode urgence ?`)) {
    try {
      const settings = await fetch(`${API_URL}/api/config`).then(r => r.json());
      settings.data.settings.emergency_mode = newState;
      await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settings.data.settings })
      });
      emergencyMode = newState;
      updateEmergencyStatus();
      loadConfig();
    } catch (error) {
      console.error('Erreur toggle urgence:', error);
    }
  }
}

function updateEmergencyStatus() {
  const statusElement = document.getElementById('emergencyStatus');
  const btnElement = document.getElementById('emergencyBtn');
  if (emergencyMode) {
    statusElement.textContent = '🚨 ACTIF';
    statusElement.style.color = '#ea4335';
    btnElement.textContent = '✅ Désactiver urgence';
  } else {
    statusElement.textContent = 'Inactif';
    statusElement.style.color = '#34a853';
    btnElement.textContent = '🚨 Mode urgence';
  }
}

async function generateReport() {
  try {
    const response = await fetch(`${API_URL}/api/daily-summary`);
    const data = await response.json();
    if (data.success) {
      const reportWindow = window.open('', '_blank');
      reportWindow.document.write(`
        <html><head><title>Rapport Google Ads Auto</title>
        <style>body{font-family:Arial;padding:20px;}h1{color:#1a73e8;}.metric{margin:10px 0;}</style>
        </head><body>
        <h1>📊 Rapport du ${data.report.date}</h1>
        <div class="metric">Recommandations: ${data.report.summary.total_recommendations}</div>
        <div class="metric">Actions exécutées: ${data.report.summary.actions_executed}</div>
        <div class="metric">Économies estimées: ${data.report.estimated_savings.estimated_monthly_savings} EUR</div>
        <pre>${JSON.stringify(data.report, null, 2)}</pre>
        </body></html>
      `);
    }
  } catch (error) {
    console.error('Erreur génération rapport:', error);
    alert('Erreur lors de la génération du rapport');
  }
}
