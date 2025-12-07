const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const wf1Routes = require('./routes/wf1.js');
const configRoutes = require('./routes/config.js');
const dataRoutes = require('./routes/data.js');
const securityRoutes = require('./routes/security.js');
const reportsRoutes = require('./routes/reports.js');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/api/config', configRoutes);
app.use('/api', dataRoutes);
app.use('/api', securityRoutes);
app.use('/api', reportsRoutes);
app.use('/api', wf1Routes);   // ← WF1 correctement branché

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Google Ads Auto'
  });
});

// Démarrage serveur
app.listen(PORT, () => {
  console.log(`🚀 Google Ads Auto server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔐 Security mode: ACTIVE`);
});
