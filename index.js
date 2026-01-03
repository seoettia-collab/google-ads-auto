// ======================================
// GOOGLE ADS AUTO - BACKEND PRINCIPAL
// ======================================
// Version: 2.1.0
// Backend avec PostgreSQL (Supabase)
// + Routes WF2 Analyzer complètes

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg');

// Initialisation Express
const app = express();
const PORT = process.env.PORT || 3000;

// ======================================
// DATABASE CONNECTION (SUPABASE)
// ======================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Database connected:', res.rows[0].now);
  }
});

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Servir les fichiers statiques du dossier /public
app.use(express.static(path.join(__dirname, 'public')));

// ======================================
// ROUTES WF1 - DATA COLLECTOR (PostgreSQL)
// ======================================

// ROUTE: Save WF1 Report
app.post('/api/wf1/save-report', async (req, res) => {
  try {
    const data = req.body;
    const reportId = `wf1_${Date.now()}`;
    
    // Handle array format
    const reportData = Array.isArray(data) ? data[0] : data;
    
    // Extract metadata
    const entities = reportData.entities || {};
    const keywords = entities.keywords || reportData.keywords || [];
    const adGroups = entities.ad_groups || [];
    const campaigns = entities.campaigns || [];
    
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCostMicros = 0;
    let totalConversions = 0;
    
    keywords.forEach(kw => {
      const metrics = kw.metrics?.days_7 || kw.metrics?.days_1 || kw.metrics?.days_30 || {};
      totalImpressions += metrics.impressions || 0;
      totalClicks += metrics.clicks || 0;
      totalCostMicros += metrics.cost_micros || 0;
      totalConversions += metrics.conversions || 0;
    });
    
    const query = `
      INSERT INTO wf1_reports (
        report_id, customer_id, campaign_name, data,
        keywords_count, ad_groups_count,
        total_impressions, total_clicks, total_cost_micros, total_conversions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, report_id, created_at
    `;
    
    const values = [
      reportId,
      reportData.customer_id || '',
      campaigns[0]?.campaign_name || reportData.campaign_name || '',
      JSON.stringify(reportData),
      keywords.length,
      adGroups.length,
      Math.round(totalImpressions),
      totalClicks,
      totalCostMicros,
      totalConversions
    ];
    
    const result = await pool.query(query, values);
    
    console.log(`✅ WF1 Report saved: ${reportId}`);
    
    res.json({
      success: true,
      message: 'WF1 Report saved to database',
      report_id: reportId,
      keywords_count: keywords.length,
      ad_groups_count: adGroups.length,
      created_at: result.rows[0].created_at
    });
    
  } catch (error) {
    console.error('❌ WF1 save error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: Get latest WF1 Report (FORMAT WF2 ANALYZER)
app.get('/api/wf1/latest', async (req, res) => {
  try {
    const query = `
      SELECT * FROM wf1_reports 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No WF1 report found' });
    }
    
    const row = result.rows[0];
    
    // Parse data JSON if stored as string
    let parsedData = row.data;
    if (typeof parsedData === 'string') {
      try {
        parsedData = JSON.parse(parsedData);
      } catch (e) {
        console.error('Error parsing WF1 data:', e);
        parsedData = {};
      }
    }
    
    // Format pour WF2 Analyzer
    const report = {
      report_id: row.report_id,
      customer_id: row.customer_id,
      campaign_id: parsedData?.campaign_id || '',
      campaign_name: row.campaign_name || parsedData?.campaign_name || '',
      totals: parsedData?.totals || {
        today: { impressions: 0, clicks: 0, cost_euros: 0, ctr: 0 },
        last_30_days: { impressions: 0, clicks: 0, cost_euros: 0, ctr: 0 }
      },
      counts: parsedData?.counts || {
        keywords: row.keywords_count,
        ad_groups: row.ad_groups_count
      },
      entities: parsedData?.entities || {
        keywords: [],
        search_terms: [],
        ad_groups: []
      },
      collection_status: parsedData?.collection_status || {},
      created_at: row.created_at
    };
    
    res.json(report);
    
  } catch (error) {
    console.error('❌ WF1 latest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ROUTE: Get last WF1 Report (legacy format)
app.get('/api/wf1/last-report', async (req, res) => {
  try {
    const query = `
      SELECT * FROM wf1_reports 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Aucun rapport disponible',
        report: null
      });
    }
    
    const row = result.rows[0];
    res.json({
      success: true,
      report: {
        id: row.report_id,
        timestamp: row.created_at,
        data: row.data,
        customer_id: row.customer_id,
        campaign_name: row.campaign_name,
        summary: {
          total_keywords: row.keywords_count,
          total_ad_groups: row.ad_groups_count,
          total_impressions: row.total_impressions,
          total_clicks: row.total_clicks,
          total_cost: (row.total_cost_micros / 1000000).toFixed(2) + ' €',
          total_conversions: parseFloat(row.total_conversions)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ WF1 get error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: WF1 History
app.get('/api/wf1/reports-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const query = `
      SELECT report_id, customer_id, campaign_name, 
             keywords_count, ad_groups_count,
             total_impressions, total_clicks, created_at
      FROM wf1_reports 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    
    res.json({
      success: true,
      count: result.rows.length,
      reports: result.rows
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: WF1 Ping/Status
app.get('/api/wf1/data-collect', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Backend Google Ads Auto - PostgreSQL',
      timestamp: new Date().toISOString(),
      database: 'connected',
      db_time: dbCheck.rows[0].now,
      version: '2.1.0'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      database: 'error'
    });
  }
});

// ======================================
// ROUTES WF2 - ANALYZER & RECOMMENDATIONS
// ======================================

// ROUTE: Save WF2 Recommendations (FORMAT WF2 ANALYZER)
app.post('/api/wf2/save-recommendations', async (req, res) => {
  try {
    const payload = req.body;
    
    // Support both old and new format
    const reportId = payload.report_id || `wf2_${Date.now()}`;
    const recommendations = payload.recommendations || payload.recommendations_final || [];
    
    // Count by action type
    const negativesCount = recommendations.filter(r => 
      r.action === 'ADD_NEGATIVE_KEYWORD' || r.action === 'ADD_NEGATIVE'
    ).length;
    
    const bidAdjustmentsCount = recommendations.filter(r => 
      r.action === 'LOWER_BID' || r.action === 'RAISE_BID' || 
      r.action === 'ADJUST_BID' || r.action === 'REVIEW_BID'
    ).length;
    
    const pauseCount = recommendations.filter(r => 
      r.action === 'PAUSE_KEYWORD'
    ).length;
    
    const protectCount = recommendations.filter(r => 
      r.action === 'PROTECT'
    ).length;
    
    const query = `
      INSERT INTO wf2_recommendations (
        recommendation_id, wf1_report_id, data,
        total_recommendations, negatives_count, 
        bid_adjustments_count, pause_keywords_count,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, recommendation_id, created_at
    `;
    
    const values = [
      reportId,
      payload.source_wf1_id || payload.wf1_report_id || null,
      JSON.stringify(payload),
      recommendations.length,
      negativesCount,
      bidAdjustmentsCount,
      pauseCount,
      'PENDING'
    ];
    
    const result = await pool.query(query, values);
    
    console.log(`✅ WF2 Recommendations saved: ${reportId}`);
    console.log(`   - Total: ${recommendations.length}`);
    console.log(`   - Pause: ${pauseCount}, Bid: ${bidAdjustmentsCount}, Negative: ${negativesCount}, Protect: ${protectCount}`);
    
    res.json({
      success: true,
      message: 'WF2 Recommendations saved',
      report_id: reportId,
      recommendation_id: reportId,
      total_recommendations: recommendations.length,
      summary: {
        pause_keywords: pauseCount,
        bid_adjustments: bidAdjustmentsCount,
        negatives: negativesCount,
        protect: protectCount
      },
      created_at: result.rows[0].created_at
    });
    
  } catch (error) {
    console.error('❌ WF2 save error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: Get latest WF2 Recommendations
app.get('/api/wf2/latest', async (req, res) => {
  try {
    const query = `
      SELECT * FROM wf2_recommendations 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No WF2 recommendations found' });
    }
    
    const row = result.rows[0];
    
    // Parse data if string
    let parsedData = row.data;
    if (typeof parsedData === 'string') {
      try {
        parsedData = JSON.parse(parsedData);
      } catch (e) {
        parsedData = {};
      }
    }
    
    res.json({
      report_id: row.recommendation_id,
      source_wf1_id: row.wf1_report_id,
      status: row.status || 'PENDING',
      created_at: row.created_at,
      data: parsedData,
      summary: {
        total: row.total_recommendations,
        negatives: row.negatives_count,
        bid_adjustments: row.bid_adjustments_count,
        pause_keywords: row.pause_keywords_count
      }
    });
    
  } catch (error) {
    console.error('❌ WF2 latest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ROUTE: Get last WF2 Recommendations (legacy format)
app.get('/api/wf2/last-recommendations', async (req, res) => {
  try {
    const query = `
      SELECT * FROM wf2_recommendations 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Aucune recommandation disponible',
        recommendations: null
      });
    }
    
    const row = result.rows[0];
    res.json({
      success: true,
      recommendations: {
        id: row.recommendation_id,
        timestamp: row.created_at,
        data: row.data,
        status: row.status || 'PENDING',
        summary: {
          total: row.total_recommendations,
          negatives: row.negatives_count,
          bid_adjustments: row.bid_adjustments_count,
          pause_keywords: row.pause_keywords_count
        }
      }
    });
    
  } catch (error) {
    console.error('❌ WF2 get error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: Get pending WF2 Recommendations (for WF3)
app.get('/api/wf2/pending', async (req, res) => {
  try {
    const query = `
      SELECT * FROM wf2_recommendations 
      WHERE status = 'PENDING' OR status IS NULL
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    
    res.json({
      success: true,
      count: result.rows.length,
      recommendations: result.rows.map(row => {
        let parsedData = row.data;
        if (typeof parsedData === 'string') {
          try { parsedData = JSON.parse(parsedData); } catch (e) { parsedData = {}; }
        }
        return {
          report_id: row.recommendation_id,
          source_wf1_id: row.wf1_report_id,
          status: row.status || 'PENDING',
          created_at: row.created_at,
          data: parsedData,
          summary: {
            total: row.total_recommendations,
            pause_keywords: row.pause_keywords_count,
            bid_adjustments: row.bid_adjustments_count,
            negatives: row.negatives_count
          }
        };
      })
    });
    
  } catch (error) {
    console.error('❌ WF2 pending error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: Update WF2 Recommendation Status
app.patch('/api/wf2/:report_id/status', async (req, res) => {
  try {
    const { report_id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['PENDING', 'APPROVED', 'EXECUTED', 'REJECTED', 'PARTIAL'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        valid_statuses: validStatuses 
      });
    }
    
    const query = `
      UPDATE wf2_recommendations 
      SET status = $1, updated_at = NOW()
      WHERE recommendation_id = $2
      RETURNING recommendation_id, status, updated_at
    `;
    
    const result = await pool.query(query, [status, report_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    
    console.log(`✅ WF2 status updated: ${report_id} → ${status}`);
    
    res.json({
      success: true,
      report_id: result.rows[0].recommendation_id,
      status: result.rows[0].status,
      updated_at: result.rows[0].updated_at
    });
    
  } catch (error) {
    console.error('❌ WF2 status update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: WF2 History
app.get('/api/wf2/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const query = `
      SELECT recommendation_id, wf1_report_id, status,
             total_recommendations, negatives_count, 
             bid_adjustments_count, pause_keywords_count,
             created_at
      FROM wf2_recommendations 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    
    res.json({
      success: true,
      count: result.rows.length,
      recommendations: result.rows.map(row => ({
        report_id: row.recommendation_id,
        source_wf1_id: row.wf1_report_id,
        status: row.status || 'PENDING',
        created_at: row.created_at,
        summary: {
          total: row.total_recommendations,
          pause_keywords: row.pause_keywords_count,
          bid_adjustments: row.bid_adjustments_count,
          negatives: row.negatives_count
        }
      }))
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: WF2 Status
app.get('/api/wf2/status', async (req, res) => {
  try {
    const countQuery = `SELECT COUNT(*) as count FROM wf2_recommendations`;
    const pendingQuery = `SELECT COUNT(*) as pending FROM wf2_recommendations WHERE status = 'PENDING' OR status IS NULL`;
    
    const [countResult, pendingResult] = await Promise.all([
      pool.query(countQuery),
      pool.query(pendingQuery)
    ]);
    
    res.json({
      success: true,
      status: 'active',
      total_recommendations_saved: parseInt(countResult.rows[0].count),
      pending_recommendations: parseInt(pendingResult.rows[0].pending)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ======================================
// ROUTES WF3 - ACTION EXECUTOR (PostgreSQL)
// ======================================

// ROUTE: Save WF3 Execution
app.post('/api/wf3/save-execution', async (req, res) => {
  try {
    const data = req.body;
    const execId = data.execution_id || `wf3_${Date.now()}`;
    
    const query = `
      INSERT INTO wf3_executions (
        execution_id, wf2_recommendation_id, mode, data,
        total_recommendations, security_allowed, security_blocked,
        actions_executed, errors_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, execution_id, created_at
    `;
    
    const values = [
      execId,
      data.wf2_recommendation_id || null,
      data.mode || 'DRY_RUN',
      JSON.stringify(data),
      data.summary?.total_recommendations || 0,
      data.summary?.security_allowed || 0,
      data.summary?.security_blocked || 0,
      data.summary?.executed || 0,
      data.summary?.errors || 0
    ];
    
    const result = await pool.query(query, values);
    
    console.log(`✅ WF3 Execution saved: ${execId}`);
    
    res.json({
      success: true,
      message: 'WF3 Execution saved',
      execution_id: execId,
      created_at: result.rows[0].created_at
    });
    
  } catch (error) {
    console.error('❌ WF3 save error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: Get last WF3 Execution
app.get('/api/wf3/last-execution', async (req, res) => {
  try {
    const query = `
      SELECT * FROM wf3_executions 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Aucune exécution disponible',
        execution: null
      });
    }
    
    const row = result.rows[0];
    res.json({
      success: true,
      execution: {
        id: row.execution_id,
        timestamp: row.created_at,
        mode: row.mode,
        data: row.data,
        summary: {
          total_recommendations: row.total_recommendations,
          security_allowed: row.security_allowed,
          security_blocked: row.security_blocked,
          executed: row.actions_executed,
          errors: row.errors_count
        }
      }
    });
    
  } catch (error) {
    console.error('❌ WF3 get error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: WF3 Executions History
app.get('/api/wf3/executions-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const query = `
      SELECT * FROM wf3_executions 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    
    res.json({
      success: true,
      count: result.rows.length,
      executions: result.rows.map(row => ({
        id: row.execution_id,
        timestamp: row.created_at,
        mode: row.mode,
        summary: {
          total_recommendations: row.total_recommendations,
          security_allowed: row.security_allowed,
          security_blocked: row.security_blocked,
          executed: row.actions_executed,
          errors: row.errors_count
        }
      }))
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: WF3 Executions (alias pour Dashboard)
app.get('/api/wf3/executions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const query = `
      SELECT * FROM wf3_executions 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Aucune exécution disponible',
        execution: null,
        executions: []
      });
    }
    
    const row = result.rows[0];
    res.json({
      success: true,
      execution: {
        id: row.execution_id,
        timestamp: row.created_at,
        mode: row.mode,
        data: row.data,
        summary: {
          total_recommendations: row.total_recommendations,
          security_allowed: row.security_allowed,
          security_blocked: row.security_blocked,
          executed: row.actions_executed,
          errors: row.errors_count
        }
      },
      executions: result.rows.map(r => ({
        id: r.execution_id,
        timestamp: r.created_at,
        mode: r.mode,
        summary: {
          total_recommendations: r.total_recommendations,
          security_allowed: r.security_allowed,
          security_blocked: r.security_blocked,
          executed: r.actions_executed,
          errors: r.errors_count
        }
      }))
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: Get WF3 Daily Limits
app.get('/api/wf3/get-limits', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const query = `
      SELECT * FROM daily_limits 
      WHERE date = $1
    `;
    const result = await pool.query(query, [today]);
    
    const limits = result.rows.length > 0 ? result.rows[0] : {
      date: today,
      keywords_paused: 0,
      negatives_added: 0,
      bids_adjusted: 0
    };
    
    res.json({
      success: true,
      limits: limits,
      max_limits: {
        keywords_paused: 10,
        negatives_added: 20,
        bids_adjusted: 15
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: Update WF3 Daily Limits
app.post('/api/wf3/update-limits', async (req, res) => {
  try {
    const { keywords_paused, negatives_added, bids_adjusted } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const query = `
      INSERT INTO daily_limits (date, keywords_paused, negatives_added, bids_adjusted)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (date) DO UPDATE SET
        keywords_paused = daily_limits.keywords_paused + EXCLUDED.keywords_paused,
        negatives_added = daily_limits.negatives_added + EXCLUDED.negatives_added,
        bids_adjusted = daily_limits.bids_adjusted + EXCLUDED.bids_adjusted,
        updated_at = NOW()
      RETURNING *
    `;
    
    const values = [today, keywords_paused || 0, negatives_added || 0, bids_adjusted || 0];
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      limits: result.rows[0]
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: WF3 Status
app.get('/api/wf3/status', async (req, res) => {
  try {
    const query = `SELECT COUNT(*) as count FROM wf3_executions`;
    const result = await pool.query(query);
    res.json({
      success: true,
      status: 'active',
      mode: 'DRY_RUN',
      total_executions: parseInt(result.rows[0].count)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ======================================
// ROUTES SYSTÈME
// ======================================

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      database: 'connected',
      db_time: dbCheck.rows[0].now,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.1.0'
    });
  } catch (error) {
    res.json({
      status: 'ok',
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'Google Ads Auto Backend',
    version: '2.1.0',
    database: 'PostgreSQL (Supabase)',
    status: 'running',
    endpoints: {
      health: '/health',
      // WF1
      wf1_save: '/api/wf1/save-report',
      wf1_latest: '/api/wf1/latest',
      wf1_last: '/api/wf1/last-report',
      wf1_history: '/api/wf1/reports-history',
      wf1_ping: '/api/wf1/data-collect',
      // WF2
      wf2_save: '/api/wf2/save-recommendations',
      wf2_latest: '/api/wf2/latest',
      wf2_last: '/api/wf2/last-recommendations',
      wf2_pending: '/api/wf2/pending',
      wf2_status: '/api/wf2/status',
      wf2_history: '/api/wf2/history',
      wf2_update_status: '/api/wf2/:report_id/status',
      // WF3
      wf3_save: '/api/wf3/save-execution',
      wf3_last: '/api/wf3/last-execution',
      wf3_history: '/api/wf3/executions-history',
      wf3_limits: '/api/wf3/get-limits',
      wf3_update_limits: '/api/wf3/update-limits',
      wf3_status: '/api/wf3/status'
    }
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// ======================================
// DÉMARRAGE SERVEUR
// ======================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================');
  console.log('🚀 Google Ads Auto - Backend v2.1.0');
  console.log('===========================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🗄️  Database: PostgreSQL (Supabase)`);
  console.log(`✅ Routes WF1 activées`);
  console.log(`✅ Routes WF2 activées (+ Analyzer)`);
  console.log(`✅ Routes WF3 activées`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('===========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM - Arrêt propre...');
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT - Arrêt propre...');
  pool.end();
  process.exit(0);
});
