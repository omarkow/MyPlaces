/**
 * Configuration centralisée de l'application - EXEMPLE
 * 
 * ⚠️ IMPORTANT : 
 * - Copier ce fichier vers config.js
 * - Remplacer les valeurs par vos vraies clés API
 * - Ne JAMAIS committer config.js dans Git
 * 
 * @module config.example
 */

export const CONFIG = {
  // Configuration Supabase
  supabase: {
    url: "https://VOTRE-PROJET.supabase.co",
    key: "VOTRE_CLE_PUBLIQUE_SUPABASE",
    storage: {
      bucket: "images-edifices"
    }
  },

  // Configuration Mapbox
  mapbox: {
    accessToken: "pk.VOTRE_TOKEN_MAPBOX",
    style: "mapbox://styles/mapbox/light-v11",
    defaultCenter: [2.3522, 48.8566], // Paris, France
    defaultZoom: 4.5
  },

  // Rôles utilisateur
  roles: {
    ADMIN: "admin",
    USER: "user"
  },

  // Catégories d'édifices
  categories: {
    culte: {
      label: "Lieu de culte",
      color: "#fac505"
    },
    chateaux: {
      label: "Châteaux, palais et monuments",
      color: "hsl(25, 95%, 48%)"
    },
    historique: {
      label: "Sites archéologiques ou historiques",
      color: "#1E90FF"
    },
    panorama: {
      label: "Panorama et paysages",
      color: "#228B22"
    },
    plages: {
      label: "Plages",
      color: "#87CEEB"
    },
    autres: {
      label: "Autres",
      color: "#808080"
    }
  },

  // Configuration des marqueurs
  marker: {
    tolerance: {
      zoomed: 0.0001,
      default: 0.0005
    },
    zoomThreshold: 14
  },

  // Configuration UI
  ui: {
    panelTransitionDuration: 400,
    debounceDelay: 300
  }
};

// Utilisateurs autorisés (à terme, devrait être géré côté serveur)
export const AUTHORIZED_USERS = ["admin@example.com"];

// Instructions de configuration
console.log(`
╔══════════════════════════════════════════════════════════════╗
║  My Places - Configuration                                   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  1. Obtenez vos clés API :                                  ║
║     - Supabase : https://supabase.com                       ║
║     - Mapbox : https://account.mapbox.com                   ║
║                                                              ║
║  2. Remplacez les valeurs dans config.js                    ║
║                                                              ║
║  3. Configuration Supabase :                                ║
║     - Créez les tables (voir README.md)                     ║
║     - Configurez le storage bucket                          ║
║     - Activez l'authentification email                      ║
║                                                              ║
║  4. Testez l'application en local                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
