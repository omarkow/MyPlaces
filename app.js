/**
 * Point d'entrée principal de l'application My Places
 * @module app
 */

import { CONFIG } from './config.js';
import { authService } from './services/auth.js';
import { apiService } from './services/api-pocketbase.js';
import { mapService } from './services/map.js';
import { communityService } from './services/communities.js';
import { uiManager } from './ui/manager.js';
import { communityUIManager } from './ui/community-manager.js';
import { formManager } from './ui/form-manager.js';
import { homeManager } from './ui/home-manager.js';
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

      // Initialiser les services de base
      await this._initializeBaseServices();

      // Initialiser depuis l'URL (routing)
      const hasSlug = await communityService.initializeFromURL();
      
      if (!hasSlug || !communityService.getCurrentCommunity()) {
        // Pas de slug ou slug invalide → Landing page
        console.log('📍 Affichage landing page');
        this.showLandingPage();
      } else {
        // Slug valide → Afficher la communauté
        console.log('🏘️ Affichage communauté:', communityService.getCurrentCommunity().name);
        await this.showCommunityPage();
      }

      // Setup navigation historique
      communityService.setupHistoryListener();

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
    console.log('✅ Dépendances vérifiées');
  }

  /**
   * Initialise les services de base (auth, carte, UI)
   * @private
   */
  async _initializeBaseServices() {
    // Initialiser l'authentification
    await authService.initialize();

    // Initialiser la carte
    await mapService.initialize('map-container');

    // Initialiser l'UI
    uiManager.initialize();
    
    // Initialiser l'UI des communautés (dropdown)
    await communityUIManager.initialize();
    
    // Mettre à jour l'UI selon l'état d'auth
    uiManager.updateForAuthState();
    
    console.log('✅ Services de base initialisés');
  }

  /**
   * Affiche la landing page (pas de communauté sélectionnée)
   */
  showLandingPage() {
    // Cacher le dropdown des communautés sur la landing
    const dropdown = document.querySelector('.community-dropdown-container');
    if (dropdown) dropdown.style.display = 'none';

    // Masquer les filtres de catégories
    const filtersBtn = document.querySelector('.btn-filters-toggle, #btn-filters-toggle');
    if (filtersBtn) filtersBtn.style.display = 'none';

    // Masquer les contrôles de zoom
    const zoomControls = document.querySelector('#zoom-controls');
    if (zoomControls) zoomControls.style.display = 'none';

    // Nettoyer la carte
    mapService.clearMarkers();
    
    // Afficher la landing page avec home-manager
    homeManager.showHomePage();
    
    console.log('🏠 Landing page affichée');
  }

  /**
   * Affiche une page de communauté
   */
  async showCommunityPage() {
    // Masquer la landing page si elle est affichée
    homeManager.hideHomePage();

    // Afficher le dropdown des communautés
    const dropdown = document.querySelector('.community-dropdown-container');
    if (dropdown) dropdown.style.display = 'block';

    // Afficher les filtres de catégories
    const filtersBtn = document.querySelector('.btn-filters-toggle, #btn-filters-toggle');
    if (filtersBtn) filtersBtn.style.display = 'block';

    // Afficher les contrôles de zoom
    const zoomControls = document.querySelector('#zoom-controls');
    if (zoomControls) zoomControls.style.display = 'flex';

    // Ajouter le geocoder pour les utilisateurs connectés
    const user = authService.getCurrentUser();
    if (user) {
      setTimeout(() => {
        mapService.addGeocoderToMap();
      }, 500);
    }

    // Charger les édifices de la communauté
    await this.loadEdifices();
    
    // Configurer les événements (une seule fois)
    if (!this._listenersSetup) {
      this._setupEventListeners();
      this._listenersSetup = true;
    }
  }

  /**
   * Charge tous les édifices depuis la base de données
   */
  async loadEdifices() {
    try {
      console.log('📍 Chargement des édifices...');
      
      // Supprimer les anciens marqueurs
      mapService.clearMarkers();

      // Récupérer TOUS les édifices
      const allEdifices = await apiService.getEdifices();
      
      // Filtrer par communauté active
      const currentCommunity = communityService.getCurrentCommunity();
      
      if (currentCommunity) {
        // Filtrer seulement les édifices de cette communauté
        this.edifices = allEdifices.filter(e => 
          e.community?.id === currentCommunity.id || 
          e.expand?.community?.id === currentCommunity.id
        );
        console.log(`✅ ${this.edifices.length} édifices chargés (${currentCommunity.name})`);
      } else {
        // Pas de communauté = pas d'édifices affichés (landing page)
        this.edifices = [];
        console.log(`📍 Landing page - aucun édifice affiché`);
        return;
      }

      // Créer les marqueurs AVEC CLUSTERING
      if (this.edifices.length > 0) {
        mapService.addMarkersWithClustering(this.edifices);
      }

    } catch (error) {
      console.error('❌ Erreur lors du chargement des édifices:', error);
      showNotification('Erreur lors du chargement des lieux', 'error');
    }
  }

  /**
   * Affiche les détails d'un édifice (appelé depuis map.js)
   * @param {Object} edifice
   */
  showEdificeDetails(edifice) {
    uiManager.openSidePanel(edifice);
  }

  /**
   * Configure les écouteurs d'événements globaux
   * @private
   */
  _setupEventListeners() {
    // Gérer le geocoder (ajout d'édifice)
    if (mapService.geocoder) {
      mapService.onGeocoderResult((e) => {
        if (!authService.getCurrentUser()) {
          showNotification(
            'Vous devez être connecté pour ajouter un édifice',
            'error'
          );
          return;
        }

        const coords = e.result.geometry.coordinates;
        const placeName = e.result.place_name || '';
        
        console.log('✨ Nouvelle localisation sélectionnée:', coords, placeName);
        
        // Ouvrir le formulaire de création
        formManager.openNewEdificeForm(coords[0], coords[1], placeName);
      });
    }

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
        case 'UPDATE':
        case 'DELETE':
          // Recharger pour recalculer le clustering
          this.loadEdifices();
          break;
      }
    });
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
  
  // Exposer l'app globalement
  window.myPlacesApp = app;
  
  // Exposer les services globalement pour le debugging
  window.authService = authService;
  window.apiService = apiService;
  window.mapService = mapService;
  window.uiManager = uiManager;
}

export default MyPlacesApp;
