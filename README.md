# 🚀 Google Ads Auto - Pilote Automatique

Système automatisé de gestion Google Ads avec sécurité renforcée.

## 📦 Installation Replit

1. Créer un nouveau Repl
2. Importer ce ZIP
3. Cliquer sur "Run"
4. Ouvrir le dashboard dans Webview

## ⚙️ Configuration

Éditer `/config/settings.json` :
- Ajouter vos identifiants Google Ads
- Configurer votre clé OpenAI
- Définir votre email pour les rapports

## 🔒 Sécurité

Toutes les actions passent par le moteur de règles. Consultez `/protocol/GOOGLE_ADS_AUTO_PROTOCOL.md` pour les détails.

## 📊 Dashboard

Accédez au dashboard pour :
- Voir les métriques en temps réel
- Changer le mode (Analyse/Semi-auto/Auto)
- Activer le mode urgence
- Générer des rapports

## 🛠️ API Endpoints

- `GET /api/config` - Configuration
- `POST /api/store-raw-data` - Stocker données
- `GET /api/security-check` - Vérifier actions
- `GET /api/daily-summary` - Rapport quotidien

## 📝 Modes

1. **Analyse** : Recommandations sans exécution
2. **Semi-auto** : Validation manuelle requise
3. **Auto** : Exécution automatique sécurisée

## 🚨 Support

Consultez le protocole officiel dans `/protocol/` pour toute question.
