/**
 * Configuration centralisée de l'application
 * @module config
 */

export const CONFIG = {
  // Configuration Supabase
  supabase: {
    url: "https://ihqktukhfgkdorlkksaj.supabase.co",
    key: "sb_publishable_K_gW-qcTXs3xq1l8jbQJgg_VgihdQ7l",
    storage: {
      bucket: "images-edifices"
    }
  },

  // Configuration Mapbox
  mapbox: {
    accessToken: "pk.eyJ1Ijoib21hcmtvdyIsImEiOiJjbWpuaDd5ejUxYmE4M2VzZDRiNjU0dWIzIn0.1MkpX6vH8AytjKHfBAwvWQ",
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
