# My Places - Application de Cartographie Interactive

## 📋 Description

My Places est une application web moderne de cartographie interactive permettant de découvrir et gérer des lieux d'intérêt (édifices, monuments, sites naturels, etc.) sur une carte Mapbox.

## 🎯 Fonctionnalités

### Pour tous les utilisateurs
- 🗺️ **Carte interactive** : Navigation fluide sur une carte Mapbox
- 🔍 **Filtres par catégorie** : Filtrer les lieux par type (culte, châteaux, plages, etc.)
- 📸 **Galerie photos** : Visualisation des photos de chaque lieu
- 🖼️ **Lightbox** : Visionneuse d'images en plein écran
- 📱 **Responsive** : Interface adaptée mobile et desktop
- ⌨️ **Accessibilité** : Navigation au clavier, ARIA labels

### Pour les administrateurs
- ➕ **Ajout de lieux** : Ajouter de nouveaux édifices via le geocoder
- ✏️ **Édition** : Modifier les informations des lieux existants
- 🗑️ **Suppression** : Supprimer des lieux
- 📤 **Upload d'images** : Télécharger des photos avec compression automatique

## 🏗️ Architecture

### Structure modulaire
```
my-places/
├── index.html              # Page HTML principale
├── style.css               # Styles CSS refactorisés
├── app.js                  # Point d'entrée de l'application
├── config.js               # Configuration centralisée
├── services/
│   ├── api.js              # Service Supabase
│   ├── auth.js             # Gestion authentification
│   └── map.js              # Service Mapbox
├── ui/
│   └── manager.js          # Gestionnaire UI
└── utils/
    └── dom.js              # Utilitaires DOM
```

### Technologies utilisées

- **Frontend**
  - HTML5 sémantique avec ARIA
  - CSS3 avec variables CSS et Grid/Flexbox
  - JavaScript ES6+ (modules)
  
- **Cartographie**
  - Mapbox GL JS v2.15.0
  - Mapbox Geocoder v5.0.0
  
- **Backend**
  - Supabase (BaaS)
  - PostgreSQL (via Supabase)
  - Storage Supabase pour les images

- **Utilitaires**
  - browser-image-compression (compression d'images)

## 🚀 Installation et Démarrage

### Prérequis
- Navigateur moderne supportant ES6 modules
- Compte Supabase
- Clé API Mapbox

### Configuration

1. **Cloner le projet**
```bash
git clone [URL_DU_REPO]
cd my-places
```

2. **Configurer les clés API**

Éditer `config.js` avec vos propres clés :

```javascript
export const CONFIG = {
  supabase: {
    url: "VOTRE_SUPABASE_URL",
    key: "VOTRE_SUPABASE_KEY"
  },
  mapbox: {
    accessToken: "VOTRE_MAPBOX_TOKEN"
  }
};
```

3. **Configuration Supabase**

Créer les tables suivantes :

```sql
-- Table des édifices
CREATE TABLE edifices (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  ville TEXT,
  description TEXT,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  categorie TEXT DEFAULT 'autres',
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des rôles utilisateurs
CREATE TABLE user_roles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX idx_edifices_coords ON edifices(lng, lat);
CREATE INDEX idx_edifices_categorie ON edifices(categorie);
```

4. **Configurer le Storage Supabase**

Créer un bucket nommé `images-edifices` avec les politiques :
- Public read
- Authenticated write

5. **Démarrer l'application**

Pour le développement local, utiliser un serveur HTTP :

```bash
# Option 1 : Python
python -m http.server 8000

# Option 2 : Node.js
npx serve

# Option 3 : PHP
php -S localhost:8000
```

Accéder à : `http://localhost:8000`

## 📖 Guide d'utilisation

### Navigation

- **Zoomer/Dézoomer** : Utiliser les boutons `+` et `-` ou molette de souris
- **Déplacer la carte** : Cliquer-glisser
- **Voir les détails** : Cliquer sur un marqueur

### Filtres

1. Cliquer sur l'icône filtres 🗺️ dans la navbar
2. Cocher/décocher les catégories souhaitées
3. Utiliser "Tout voir/masquer" pour tout sélectionner/désélectionner

### Visionneuse d'images

- Cliquer sur une image dans le panneau latéral
- Naviguer avec les flèches ← →
- Fermer avec `Échap` ou le bouton ×

### Raccourcis clavier

- `Échap` : Fermer les panneaux et lightbox
- `→` : Image suivante (dans lightbox)
- `←` : Image précédente (dans lightbox)

## 🔐 Authentification

### Connexion
1. Cliquer sur "Connexion" dans la navbar
2. Entrer email et mot de passe
3. Se connecter

### Rôles
- **User** : Consultation uniquement
- **Admin** : Consultation + ajout/édition/suppression

## 🎨 Personnalisation

### Variables CSS

Toutes les couleurs, espacements et styles sont définis dans `:root` dans `style.css` :

```css
:root {
  --color-primary: #B8860B;
  --color-bg: #FDFBF7;
  --spacing-md: 16px;
  /* ... */
}
```

### Catégories

Ajouter/modifier les catégories dans `config.js` :

```javascript
categories: {
  nouvelle_categorie: {
    label: "Ma nouvelle catégorie",
    color: "#FF5733"
  }
}
```

## 🧪 Tests et Debug

### Mode développement

Les services sont exposés globalement en mode dev :

```javascript
console.log(window.myPlacesApp);
console.log(window.authService);
console.log(window.mapService);
```

### Logs

- ✅ : Succès
- ❌ : Erreur
- ℹ️ : Information
- 🔍 : Debug

## 📱 Compatibilité

### Navigateurs supportés
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

### Appareils
- Desktop : ✅
- Tablette : ✅
- Mobile : ✅

## 🔒 Sécurité

### Bonnes pratiques implémentées
- ✅ Sanitization des inputs HTML
- ✅ Validation côté client
- ✅ Utilisation de Row Level Security (Supabase)
- ✅ Pas de secrets dans le code client
- ✅ HTTPS requis pour production

### À améliorer
- ⚠️ Déplacer les clés API vers des variables d'environnement
- ⚠️ Implémenter la validation côté serveur
- ⚠️ Ajouter un rate limiting

## 🚀 Performance

### Optimisations implémentées
- ✅ Compression d'images automatique
- ✅ Lazy loading des ressources
- ✅ Debouncing des événements
- ✅ Cache du navigateur
- ✅ CSS minifié en production

### Métriques cibles
- First Contentful Paint : < 1.5s
- Time to Interactive : < 3s
- Lighthouse Score : > 90

## 🐛 Problèmes connus

### Limitations actuelles
- Les marqueurs très proches peuvent se superposer à faible zoom
- Le formulaire d'édition n'est pas encore implémenté
- Pas de système de recherche textuelle

## 🗺️ Roadmap

### Version 2.0
- [ ] Formulaire complet de création/édition
- [ ] Recherche textuelle dans les lieux
- [ ] Export PDF des lieux
- [ ] Mode hors ligne (PWA)
- [ ] Clustering intelligent des marqueurs
- [ ] Système de favoris
- [ ] Commentaires et notes utilisateurs

### Version 3.0
- [ ] Application mobile native
- [ ] Partage social
- [ ] Itinéraires entre lieux
- [ ] Réalité augmentée

## 📄 Licence

Ce projet est sous licence MIT.

## 👥 Contributeurs

- Développeur principal : [Votre nom]
- Refactoring : Claude (Anthropic)

## 📧 Contact

Pour toute question ou suggestion :
- Email : [votre@email.com]
- Issues GitHub : [URL]

---

**Note** : Ce README fait partie du refactoring complet de l'application My Places pour améliorer la maintenabilité, la performance et l'évolutivité du code.
