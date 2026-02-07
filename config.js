/**
 * Configuration centralisée de l'application
 * @module config
 */

export const CONFIG = {
  pocketbase: {
    url: "http://127.0.0.1:8090" // En dev
    // url: "https://myplaces.fly.dev" // En production
  },

  // Configuration Mapbox
  mapbox: {
    accessToken: "pk.eyJ1Ijoib21hcmtvdyIsImEiOiJjbWwzdXloNTQwMGFjM2ZzaGh4M3lwa3c4In0.abmP78fOiIliy279feN90g",
    style: "mapbox://styles/mapbox/light-v11",
    defaultCenter: [2.3522, 48.8566],
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
export const AUTHORIZED_USERS = ["admin@test.com"];
