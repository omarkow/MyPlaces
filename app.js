/**
 * Point d'entrée principal de l'application My Places
 * @module app
 */

import { CONFIG } from './config.js';
import { authService } from './services/auth.js';
import { apiService } from './services/api.js';
import { mapService } from './services/map.js';
import { uiManager } from './ui/manager.js';
import { showNotification } from './utils/dom.js';

/**
 * Classe principale de l'application
 */
class MyPlacesApp {
  constructor() {
    this.initialized = false;
    this.edifices = [];
  }

  /**
   * Initialise l'application
   */
  async initialize() {
    try {
      console.log('🚀 Initialisation de My Places...');

      // Vérifier les dépendances
      this._checkDependencies();

      // Initialiser les services
      await this._initializeServices();

      // Charger les données
      await this.loadEdifices();

      // Configurer les événements
      this._setupEventListeners();

      this.initialized = true;
      console.log('✅ Application initialisée avec succès');

    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation:', error);
      showNotification('Erreur lors du chargement de l\'application', 'error');
    }
  }

  /**
   * Vérifie que les dépendances sont chargées
   * @private
   */
  _checkDependencies() {
    if (typeof mapboxgl === 'undefined') {
      throw new Error('Mapbox GL JS n\'est pas chargé');
    }
    if (typeof supabase === 'undefined') {
      throw new Error('Supabase client n\'est pas chargé');
    }
    console.log('✅ Dépendances vérifiées');
  }

  /**
   * Initialise tous les services
   * @private
   */
  async _initializeServices() {
    // Initialiser l'authentification
    await authService.initialize();

    // Initialiser la carte
    await mapService.initialize('map-container');

    // Initialiser l'UI
    uiManager.initialize();
    uiManager.updateForAuthState();

    console.log('✅ Services initialisés');
  }

  /**
   * Charge tous les édifices depuis la base de données
   */
  async loadEdifices() {
    try {
      console.log('📍 Chargement des édifices...');
      
      // Supprimer les anciens marqueurs
      mapService.clearMarkers();

      // Récupérer les édifices
      this.edifices = await apiService.getEdifices();
      
      console.log(`✅ ${this.edifices.length} édifices chargés`);

      // Créer les marqueurs
      this.edifices.forEach(edifice => {
        this._createEdificeMarker(edifice);
      });

      // Mettre à jour les badges de superposition
      mapService.updateStackBadges();

    } catch (error) {
      console.error('❌ Erreur lors du chargement des édifices:', error);
      showNotification('Erreur lors du chargement des lieux', 'error');
    }
  }

  /**
   * Crée un marqueur pour un édifice
   * @private
   * @param {Object} edifice
   */
  _createEdificeMarker(edifice) {
    if (!edifice.lng || !edifice.lat) {
      console.warn('Édifice sans coordonnées:', edifice);
      return;
    }

    // Normaliser les données
    const normalizedEdifice = {
      ...edifice,
      images: Array.isArray(edifice.images) ? edifice.images : [],
      categorie: edifice.categorie || 'autres'
    };

    // Créer le marqueur
    const { element } = mapService.createMarker(normalizedEdifice);

    // Gérer le clic sur le marqueur
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      this._handleMarkerClick(normalizedEdifice);
    });
  }

  /**
   * Gère le clic sur un marqueur
   * @private
   * @param {Object} edifice
   */
  _handleMarkerClick(edifice) {
    const lng = parseFloat(edifice.lng);
    const lat = parseFloat(edifice.lat);

    // Vérifier s'il y a des marqueurs superposés
    const stackedMarkers = mapService.getStackedMarkers(lng, lat);

    if (stackedMarkers.length > 1) {
      // Si plusieurs marqueurs au même endroit
      if (mapService.getZoom() < CONFIG.marker.zoomThreshold) {
        // Zoom insuffisant : afficher un avertissement
        mapService.showZoomWarning(lng, lat, stackedMarkers.length);
        mapService.flyTo([lng, lat], CONFIG.marker.zoomThreshold + 1);
      } else {
        // Zoom suffisant : afficher une liste
        this._showStackedEdificesPanel(stackedMarkers);
      }
    } else {
      // Un seul marqueur : afficher les détails
      uiManager.openSidePanel(edifice);
    }
  }

  /**
   * Affiche un panneau avec la liste des édifices superposés
   * @private
   * @param {Array} stackedMarkers
   */
  _showStackedEdificesPanel(stackedMarkers) {
    // Créer un édifice "virtuel" avec la liste
    const virtualEdifice = {
      nom: `${stackedMarkers.length} édifices à cet emplacement`,
      description: stackedMarkers.map((m, i) => 
        `${i + 1}. ${m.edifice.nom}`
      ).join('\n'),
      images: [],
      ville: stackedMarkers[0].edifice.ville || ''
    };

    uiManager.openSidePanel(virtualEdifice);

    // TODO: Améliorer l'UI pour afficher une vraie liste cliquable
  }

  /**
   * Configure les écouteurs d'événements globaux
   * @private
   */
  _setupEventListeners() {
    // Gérer le geocoder (ajout d'édifice)
    mapService.onGeocoderResult((e) => {
      if (!authService.isAdmin()) {
        showNotification(
          'Vous devez être administrateur pour ajouter un édifice',
          'error'
        );
        return;
      }

      const coords = e.result.geometry.coordinates;
      const placeName = e.result.place_name || '';
      
      console.log('Nouvelle localisation sélectionnée:', coords, placeName);
      
      // TODO: Ouvrir le formulaire de création d'édifice
      showNotification('Formulaire de création à implémenter', 'info');
    });

    // Écouter les changements en temps réel (optionnel)
    this._setupRealTimeUpdates();
  }

  /**
   * Configure les mises à jour en temps réel
   * @private
   */
  _setupRealTimeUpdates() {
    apiService.subscribeToEdifices((payload) => {
      console.log('📡 Changement détecté:', payload);
      
      switch (payload.eventType) {
        case 'INSERT':
          this._handleEdificeAdded(payload.new);
          break;
        case 'UPDATE':
          this._handleEdificeUpdated(payload.new);
          break;
        case 'DELETE':
          this._handleEdificeDeleted(payload.old.id);
          break;
      }
    });
  }

  /**
   * Gère l'ajout d'un nouvel édifice
   * @private
   * @param {Object} edifice
   */
  _handleEdificeAdded(edifice) {
    console.log('➕ Nouvel édifice ajouté:', edifice);
    this.edifices.push(edifice);
    this._createEdificeMarker(edifice);
    mapService.updateStackBadges();
  }

  /**
   * Gère la mise à jour d'un édifice
   * @private
   * @param {Object} edifice
   */
  _handleEdificeUpdated(edifice) {
    console.log('✏️ Édifice mis à jour:', edifice);
    
    // Mettre à jour dans la liste
    const index = this.edifices.findIndex(e => e.id === edifice.id);
    if (index !== -1) {
      this.edifices[index] = edifice;
    }

    // Recréer le marqueur
    mapService.removeMarker(edifice.id);
    this._createEdificeMarker(edifice);
    mapService.updateStackBadges();
  }

  /**
   * Gère la suppression d'un édifice
   * @private
   * @param {number} id
   */
  _handleEdificeDeleted(id) {
    console.log('🗑️ Édifice supprimé:', id);
    
    // Retirer de la liste
    this.edifices = this.edifices.filter(e => e.id !== id);
    
    // Supprimer le marqueur
    mapService.removeMarker(id);
    mapService.updateStackBadges();
  }

  /**
   * Rafraîchit l'application
   */
  async refresh() {
    await this.loadEdifices();
    uiManager.updateForAuthState();
  }
}

// Créer et initialiser l'application au chargement du DOM
let app = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

async function initApp() {
  app = new MyPlacesApp();
  await app.initialize();
  
  // Exposer l'app globalement pour le debugging
  window.myPlacesApp = app;
}

// Exposer les services globalement pour le debugging (optionnel)
if (process.env.NODE_ENV === 'development') {
  window.authService = authService;
  window.apiService = apiService;
  window.mapService = mapService;
  window.uiManager = uiManager;
}

export default MyPlacesApp;
