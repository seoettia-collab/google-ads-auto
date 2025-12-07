# ⚙️ GOOGLE ADS AUTO -- PROTOCOLE OFFICIEL

### **Version : 1.0 -- Projet Ricardo / Mistral Pro Reno**

### **Emplacement prévu :** `/protocol/GOOGLE_ADS_AUTO_PROTOCOL.md`

## 🎯 OBJECTIF GLOBAL

Construire un système **pilote automatique Google Ads** (Option C)
capable de : - Analyser les campagnes quotidiennement\
- Générer des recommandations (GPT)\
- Effectuer certaines actions automatiquement\
- Vérifier chaque action via un moteur de sécurité\
- Documenter toutes les actions dans des logs\
- Fournir un rapport quotidien\
- Fournir un dashboard Replit (cockpit)\
- **Sans jamais toucher aux budgets Google Ads**

## 🔒 RÈGLES IMMUTABLES

### ❌ Actions strictement interdites

-   Modifier un budget
-   Pauser une campagne entière
-   Supprimer des campagnes ou groupes d'annonces
-   Créer / dupliquer des campagnes
-   Modifier un objectif de campagne

### ✅ Actions autorisées

-   Pauser des mots-clés
-   Ajuster des enchères de mots-clés (max --20% / +15%)
-   Ajouter des mots-clés négatifs
-   Générer des alertes / emails / logs

### 📌 Rappel : tout doit passer par le **moteur de règles**.

## 🧠 MODULES PRINCIPAUX

1.  **n8n Workflows** : WF1, WF2, WF3, WF4, WF5
2.  **OpenAI (GPT)** : Analyse + recommandations JSON strict
3.  **Google Ads API** : Données + actions
4.  **Replit Dashboard** : Interface + configuration + logs
5.  **Data Storage** : JSON/DB pour logs/règles/limites

## 🧩 WORKFLOWS N8N (Résumé)

### 🔹 WF1 -- DATA_COLLECTOR

Collecte quotidienne des métriques Google Ads + stockage.

### 🔹 WF2 -- ANALYZER_GPT

Chargement data → prompt → analyse JSON → stockage reco.

### 🔹 WF3 -- ACTION_EXECUTOR

Application sécurisée des actions autorisées + logs.

### 🔹 WF4 -- REPORT_GENERATOR

Synthèse journalière + email.

### 🔹 WF5 -- EMERGENCY_STOP

Surveillance anomalies + blocage auto.

## 🛡️ MOTEUR DE RÈGLES (SÉCURITÉ)

### Vérifications obligatoires

-   Volume minimum (clics/impressions/coût)
-   CPA au-dessus d'un seuil
-   CTR en dessous d'un seuil
-   Aucune conversion 30 jours
-   Action autorisée
-   Limite journalière non dépassée

### Limites quotidiennes (défaut)

    max_keywords_paused: 10
    max_negatives_added: 20
    max_bid_adjustments: 15

### Liste blanche

Mots-clés ayant généré une conversion sur 30 jours.

## 🔧 STRUCTURE REPLIT OFFICIELLE

    /index.js
    /routes/
        config.js
        data.js
        security.js
        reports.js
    /modules/
        securityChecker.js
        limitsManager.js
        reportGenerator.js
        alertSystem.js
    /config/
        security_rules.json
        thresholds.json
        settings.json
    /data/
        raw_ads_data.json
        recommendations.json
        actions_log.json
        daily_limits.json
    /public/
        dashboard.html
        logs.html
        history.html
        settings.html
        style.css
        app.js
    /templates/
        email_report.html
    /protocol/
        GOOGLE_ADS_AUTO_PROTOCOL.md

## 🧪 QUALITÉ ATTENDUE

-   Code propre et modulaire
-   JSON strict pour GPT
-   Aucune action sans log
-   Aucun workflow ne contourne le moteur de règles
-   Interdiction absolue : budget

## 🎮 MODES DE FONCTIONNEMENT

### 1. Analyse seule

WF1 + WF2 + WF4

### 2. Semi-auto

WF1 + WF2 + validation Dashboard → WF3 + WF4

### 3. Auto complet

WF1 + WF2 + moteur règles → WF3 + WF4

# ✔️ FIN DU PROTOCOLE

À respecter dans chaque étape, chaque workflow, chaque fichier.
