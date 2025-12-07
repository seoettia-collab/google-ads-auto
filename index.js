const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const wf1Routes = require('./routes/wf1.js');   // ← AJOUT ICI

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/api/config', require('./routes/config.js'));
app.use('/api', require('./routes/data'));
app.use('/api', require('./routes/security'));
app.use('/api', require('./routes/reports'));
app.use('/api', wf1Routes);   // ← AJOUT ICI

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
