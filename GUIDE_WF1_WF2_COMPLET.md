# 🚀 GUIDE COMPLET WF1/WF2 - GOOGLE ADS AUTO

## 📦 FICHIERS CRÉÉS

- `index.js` - Backend principal avec routes WF1
- `package.json` - Dépendances Node.js
- `backend-wf1-routes.js` - Routes détaillées (référence)

---

## 🔧 ÉTAPE 1 : DÉPLOYER LE BACKEND

### Option A : Mettre à jour ton backend Render existant

1. **Remplacer `index.js`** sur ton backend actuel
2. **Vérifier `package.json`** (dépendances identiques)
3. **Redéployer** sur Render
4. **Attendre** que le build soit terminé

### Option B : Tester en local d'abord

```bash
npm install
npm start
```

Backend accessible sur `http://localhost:3000`

---

## 🧪 ÉTAPE 2 : TESTER LES ROUTES BACKEND

### Test 1 : Ping / Health Check

```bash
curl https://google-ads-auto-backend.onrender.com/api/wf1/data-collect
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Backend Google Ads Auto - Opérationnel",
  "timestamp": "2025-12-07T...",
  "version": "1.0.0",
  "endpoints": {
    "ping": "/api/wf1/data-collect",
    "save": "/api/wf1/save-report",
    "last": "/api/wf1/last-report",
    "history": "/api/wf1/reports-history"
  }
}
```

### Test 2 : Sauvegarder un rapport (simulé)

```bash
curl -X POST https://google-ads-auto-backend.onrender.com/api/wf1/save-report \
  -H "Content-Type: application/json" \
  -d '{
    "budget_warnings": ["Budget campagne X trop bas"],
    "add_negative_keywords": [
      {"campaign_id": "123", "keyword": "gratuit"}
    ],
    "adjust_bids": [
      {
        "keyword_id": "456",
        "current_bid": 2.5,
        "suggested_bid": 2.0,
        "reason": "CPA trop élevé"
      }
    ],
    "landing_page_issues": ["Page 404 détectée"],
    "status": "analysis_complete"
  }'
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Rapport IA sauvegardé avec succès",
  "report_id": "report_1733572800000",
  "timestamp": "2025-12-07T...",
  "summary": {
    "budget_warnings": 1,
    "negative_keywords": 1,
    "bid_adjustments": 1,
    "landing_issues": 1
  }
}
```

### Test 3 : Récupérer le dernier rapport

```bash
curl https://google-ads-auto-backend.onrender.com/api/wf1/last-report
```

**Réponse attendue :**
```json
{
  "success": true,
  "message": "Dernier rapport récupéré",
  "report": {
    "id": "report_1733572800000",
    "timestamp": "2025-12-07T...",
    "data": {
      "budget_warnings": [...],
      "add_negative_keywords": [...],
      "adjust_bids": [...],
      "landing_page_issues": [...],
      "status": "analysis_complete"
    }
  }
}
```

---

## 🔄 ÉTAPE 3 : CONFIGURER WF2 DANS N8N

### Structure complète du workflow

```
[Schedule Trigger] 
   ↓
[HTTP Request - GET data-collect] → Test backend
   ↓
[Set - Données de test] → Simuler données Google Ads
   ↓
[Basic LLM Chain] → Analyse GPT
   ↓
[Code - Parse JSON] → Nettoyer réponse GPT
   ↓
[HTTP Request - POST save-report] → Sauvegarder au backend
```

---

### 📝 Configuration de chaque nœud

#### 1️⃣ Schedule Trigger
- **Trigger Interval** : Every Day
- **Hour** : 8
- **Minute** : 0

#### 2️⃣ HTTP Request (GET)
- **Method** : GET
- **URL** : `https://google-ads-auto-backend.onrender.com/api/wf1/data-collect`
- **Authentication** : None
- **Response Format** : JSON

#### 3️⃣ Set (Données de test)
- **Mode** : Manual Mapping
- **Ajouter un champ** :
  - **Name** : `data`
  - **Value** : (mode JSON)
```json
{
  "campaigns": [
    {
      "id": "123456",
      "name": "Campagne Rénovation Cuisine",
      "cost": 250.50,
      "clicks": 150,
      "impressions": 5000,
      "conversions": 3,
      "cpa": 83.50
    },
    {
      "id": "789012",
      "name": "Campagne Salle de Bain",
      "cost": 180.00,
      "clicks": 90,
      "impressions": 3500,
      "conversions": 1,
      "cpa": 180.00
    }
  ],
  "keywords": [
    {
      "id": "kw001",
      "text": "rénovation cuisine prix",
      "campaign_id": "123456",
      "cost": 80.00,
      "clicks": 45,
      "impressions": 1200,
      "ctr": 3.75,
      "conversions": 2,
      "cpa": 40.00
    },
    {
      "id": "kw002",
      "text": "devis cuisine gratuit",
      "campaign_id": "123456",
      "cost": 120.00,
      "clicks": 85,
      "impressions": 2500,
      "ctr": 3.40,
      "conversions": 0,
      "cpa": 0
    }
  ]
}
```

#### 4️⃣ Basic LLM Chain
- **Model** : OpenAI Chat Model (configuré séparément)
- **Prompt** :
```
Tu es un analyseur Google Ads automatisé. Tu dois TOUJOURS répondre avec EXACTEMENT ce format JSON, sans texte avant ni après :

{
  "budget_warnings": [],
  "add_negative_keywords": [],
  "adjust_bids": [],
  "landing_page_issues": [],
  "status": "analysis_complete"
}

RÈGLES STRICTES :
- budget_warnings : array de strings (ex: ["Budget campagne X trop bas"])
- add_negative_keywords : array d'objets {campaign_id, keyword}
- adjust_bids : array d'objets {keyword_id, current_bid, suggested_bid, reason}
- landing_page_issues : array de strings
- status : toujours "analysis_complete"

ANALYSE CES DONNÉES :
{{ JSON.stringify($json.data, null, 2) }}

INSTRUCTIONS D'ANALYSE :
1. Si un mot-clé a cost > 100 et conversions = 0 → ajouter en négatif
2. Si CPA > 150 → suggérer réduction enchère de -20%
3. Si CTR < 2% → ajouter en négatif
4. Si campagne a conversions = 0 sur 30 jours → budget warning

RÉPONDS UNIQUEMENT AVEC LE JSON, RIEN D'AUTRE.
```

#### 5️⃣ OpenAI Chat Model (connecté au LLM Chain)
- **Model** : gpt-4o-mini (ou gpt-4)
- **Temperature** : 0.1 (pour réponses cohérentes)
- **Max Tokens** : 1000

#### 6️⃣ Code (Parse JSON)
- **Language** : JavaScript
- **Code** :
```javascript
// Nettoyer et parser la réponse GPT
let response = items[0].json.output || items[0].json.text || items[0].json;

// Si c'est une string, parser
if (typeof response === 'string') {
  // Enlever les backticks markdown si présents
  response = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    response = JSON.parse(response);
  } catch (e) {
    console.error('Erreur parsing JSON:', e);
    // Retourner structure vide en cas d'erreur
    response = {
      budget_warnings: [],
      add_negative_keywords: [],
      adjust_bids: [],
      landing_page_issues: [],
      status: "error_parsing"
    };
  }
}

// S'assurer que tous les champs existent
const cleanedResponse = {
  budget_warnings: response.budget_warnings || [],
  add_negative_keywords: response.add_negative_keywords || [],
  adjust_bids: response.adjust_bids || [],
  landing_page_issues: response.landing_page_issues || [],
  status: response.status || "analysis_complete"
};

return [{ json: cleanedResponse }];
```

#### 7️⃣ HTTP Request (POST)
- **Method** : POST
- **URL** : `https://google-ads-auto-backend.onrender.com/api/wf1/save-report`
- **Authentication** : None
- **Send Body** : Yes
- **Body Content Type** : JSON
- **Body** : (Expression mode)
```
{{ JSON.stringify($json) }}
```

---

## ✅ ÉTAPE 4 : TESTER LE WORKFLOW

1. **Désactive le Schedule Trigger** (pour tester manuellement)
2. **Clique sur "Execute Workflow"**
3. **Vérifie chaque nœud** :
   - ✅ HTTP GET retourne `success: true`
   - ✅ Set contient les données de test
   - ✅ LLM Chain retourne du JSON
   - ✅ Code parse correctement
   - ✅ HTTP POST retourne `success: true` avec `report_id`

4. **Vérifie dans le backend** :
```bash
curl https://google-ads-auto-backend.onrender.com/api/wf1/last-report
```

---

## 🎯 VALIDATION FINALE

Tu dois voir :
- ✅ Backend répond sur toutes les routes
- ✅ WF2 s'exécute sans erreur
- ✅ GPT retourne toujours le même format JSON
- ✅ Rapport sauvegardé dans le backend
- ✅ `/last-report` retourne le dernier rapport

---

## 🚨 DÉPANNAGE

### Problème 1 : GPT ne retourne pas du JSON pur
**Solution** : Ajouter dans le prompt :
```
IMPORTANT : Ta réponse doit commencer directement par { et finir par }
Pas de texte avant, pas de ```json, pas d'explication.
```

### Problème 2 : Erreur "Format JSON invalide"
**Solution** : Vérifier le nœud Code - il doit nettoyer les backticks

### Problème 3 : Backend retourne 404
**Solution** : Vérifier l'URL exacte, vérifier que le backend est bien déployé

### Problème 4 : OpenAI timeout
**Solution** : Augmenter Max Tokens à 2000, réduire les données de test

---

## 📊 PROCHAINES ÉTAPES

Une fois WF2 validé :

1. **Ajouter Google Ads API** dans WF1 (remplacer le nœud Set)
2. **Créer WF3** (Action Executor)
3. **Créer WF4** (Report Generator avec dashboard HTML)
4. **Ajouter WF5** (Emergency Stop)

---

## 🎉 TU ES PRÊT !

Suis ce guide étape par étape et **teste à chaque étape**.

**Dis-moi quand tu as :**
- ✅ Déployé le nouveau backend
- ✅ Testé les routes
- ✅ Créé WF2 dans n8n
- ✅ Exécuté le workflow avec succès

Je t'aiderai à résoudre tout problème ! 🚀
