/**
 * Service de gestion de la carte Mapbox et des marqueurs
 * @module services/map
 */

import { CONFIG } from '../config.js';
import { createElement } from '../utils/dom.js';
import { clusteringService } from './clustering.js';
import { uiManager } from '../ui/manager.js';

/**
 * Classe de gestion de la carte Mapbox
 */
export class MapService {
  constructor() {
    this.map = null;
    this.geocoder = null;
    this.markers = {}; // { id: { element, marker, categorie, edifice } } - Pour marqueurs uniques
    this.clusterMarkers = []; // Array pour les marqueurs de clustering
    this.currentPopup = null;
    this.usesClustering = false;
    this.allEdifices = []; // Stocker tous les édifices
    this.activeCategories = ['culte', 'chateaux', 'historique', 'panorama', 'plages', 'autres']; // Toutes par défaut
  }

  /**
   * Initialise la carte Mapbox
   * @param {string} containerId - ID du conteneur
   * @returns {Promise<mapboxgl.Map>}
   */
  async initialize(containerId) {
    return new Promise((resolve, reject) => {
      try {
        mapboxgl.accessToken = CONFIG.mapbox.accessToken;

        this.map = new mapboxgl.Map({
          container: containerId,
          style: CONFIG.mapbox.style,
          center: CONFIG.mapbox.defaultCenter,
          zoom: CONFIG.mapbox.defaultZoom,
          attributionControl: false
        });

        // Ajouter les contrôles de navigation
        this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        this.map.on('load', () => {
          console.log('✅ Carte Mapbox chargée');
          this._setupGeocoder();
          resolve(this.map);
        });

        this.map.on('error', (e) => {
          console.error('❌ Erreur Mapbox:', e);
          reject(e);
        });

      } catch (error) {
        console.error('Erreur lors de l\'initialisation de la carte:', error);
        reject(error);
      }
    });
  }

  /**
   * Configure le geocoder
   * @private
   */
  _setupGeocoder() {
    console.log('🔧 Configuration du geocoder...');
    this.geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      placeholder: "Rechercher un lieu à ajouter...",
      marker: false,
      language: 'fr'
    });
    console.log('✅ Geocoder configuré');
  }

  /**
   * Ajoute le geocoder à la carte (appelé une seule fois)
   */
  addGeocoderToMap() {
    if (!this.geocoder) {
      console.error('❌ Geocoder pas initialisé');
      return;
    }

    // Vérifier s'il n'est pas déjà ajouté
    const existing = document.querySelector('.mapboxgl-ctrl-geocoder');
    if (existing) {
      console.log('✅ Geocoder déjà présent');
      return;
    }

    // Ajouter le contrôle
    this.map.addControl(this.geocoder, 'top-left');
    console.log('✅ Geocoder ajouté à la carte');
  }

  /**
   * Affiche/cache le geocoder
   * @param {boolean} show
   */
  toggleGeocoder(show) {
    if (!this.geocoder) {
      console.warn('⚠️ Geocoder pas encore initialisé');
      return;
    }

    const geocoderControl = document.querySelector('.mapboxgl-ctrl-geocoder');
    
    if (show) {
      // Si pas encore ajouté, l'ajouter
      if (!geocoderControl) {
        this.addGeocoderToMap();
      } else {
        // Sinon juste le montrer
        geocoderControl.style.display = 'block';
        geocoderControl.style.visibility = 'visible';
        console.log('✅ Geocoder affiché');
      }
    } else {
      if (geocoderControl) {
        // Approche agressive : retirer complètement du DOM
        geocoderControl.remove();
        this._geocoderAdded = false;
        console.log('🔒 Geocoder retiré du DOM');
      }
    }
  }

  /**
   * Enregistre un callback pour le geocoder
   * @param {Function} callback
   */
  onGeocoderResult(callback) {
    if (!this.geocoder) return;
    this.geocoder.on('result', callback);
  }

  /**
   * Crée et ajoute un marqueur sur la carte
   * @param {Object} edifice
   * @returns {Object} Marqueur créé
   */
  createMarker(edifice) {
    const { id, lng, lat, nom, categorie = 'autres' } = edifice;

    // Créer l'élément DOM du marqueur
    const el = createElement('div', {
      className: `marker marker--${categorie}`,
      'data-id': id,
      'data-categorie': categorie,
      style: {
        cursor: 'pointer',
        width: '20px',
        height: '20px',
        backgroundColor: CONFIG.categories[categorie]?.color || '#808080',
        border: '2px solid white',
        borderRadius: '50%',
        boxShadow: '0 0 10px rgba(0,0,0,0.3)'
      }
    });

    // Créer le marqueur Mapbox
    const marker = new mapboxgl.Marker(el)
      .setLngLat([parseFloat(lng), parseFloat(lat)])
      .addTo(this.map);

    // Ajouter un popup au survol
    const popup = new mapboxgl.Popup({
      offset: 25,
      closeButton: false,
      className: 'marker-popup',
      maxWidth: '300px'
    }).setHTML(`<strong>${nom}</strong>`);

    el.addEventListener('mouseenter', () => {
      popup.setLngLat([lng, lat]).addTo(this.map);
      
      // FORCER le z-index après ajout
      setTimeout(() => {
        const popupEl = document.querySelector('.marker-popup');
        if (popupEl) {
          popupEl.style.zIndex = '999999';
          const content = popupEl.querySelector('.mapboxgl-popup-content');
          if (content) {
            content.style.zIndex = '1000000';
          }
        }
      }, 10);
    });

    el.addEventListener('mouseleave', () => {
      popup.remove();
    });

    // Stocker le marqueur
    this.markers[id] = {
      element: el,
      marker: marker,
      categorie: categorie,
      edifice: edifice
    };

    return { element: el, marker, popup };
  }

  /**
   * Supprime un marqueur
   * @param {number} id
   */
  removeMarker(id) {
    const markerData = this.markers[id];
    if (markerData) {
      markerData.marker.remove();
      delete this.markers[id];
    }
  }

  /**
   * Supprime tous les marqueurs
   */
  clearMarkers() {
    // Nettoyer les marqueurs classiques
    Object.values(this.markers).forEach(({ marker }) => marker.remove());
    this.markers = {};
    
    // Nettoyer les marqueurs de clustering
    this.clusterMarkers.forEach(marker => marker.remove());
    this.clusterMarkers = [];
  }

  /**
   * Applique les filtres de catégories
   * @param {Array<string>} activeCategories
   */
  applyFilters(activeCategories) {
    // Stocker les catégories actives
    this.activeCategories = activeCategories;
    
    if (this.usesClustering && this.allEdifices.length > 0) {
      // Mode clustering : filtrer et recharger
      const filteredEdifices = this.allEdifices.filter(e => 
        activeCategories.includes(e.categorie || 'autres')
      );
      
      console.log(`🔍 Filtrage: ${filteredEdifices.length}/${this.allEdifices.length} édifices affichés`);
      
      // Recharger les clusters avec les édifices filtrés
      this.addMarkersWithClustering(filteredEdifices);
    } else {
      // Mode classique : cacher/afficher les marqueurs
      Object.values(this.markers).forEach(({ element, categorie }) => {
        element.style.display = activeCategories.includes(categorie) ? 'block' : 'none';
      });
    }
  }

  /**
   * Détecte les marqueurs superposés
   * @param {number} lng
   * @param {number} lat
   * @returns {Array} Liste des marqueurs superposés
   */
  getStackedMarkers(lng, lat) {
    const tolerance = this.map.getZoom() < CONFIG.marker.zoomThreshold 
      ? CONFIG.marker.tolerance.default 
      : CONFIG.marker.tolerance.zoomed;

    const stacked = [];

    Object.entries(this.markers).forEach(([id, { marker, edifice }]) => {
      if (!marker.getLngLat()) return;

      const markerLng = parseFloat(marker.getLngLat().lng.toFixed(6));
      const markerLat = parseFloat(marker.getLngLat().lat.toFixed(6));

      if (Math.abs(markerLng - lng) < tolerance && 
          Math.abs(markerLat - lat) < tolerance) {
        stacked.push({ id, edifice });
      }
    });

    return stacked;
  }

  /**
   * Ajoute un badge de compteur sur un marqueur
   * @param {HTMLElement} markerElement
   * @param {number} count
   */
  addStackBadge(markerElement, count) {
    if (count <= 1) return;

    // Retirer l'ancien badge s'il existe
    const oldBadge = markerElement.querySelector('.stack-badge');
    if (oldBadge) oldBadge.remove();

    markerElement.classList.add('stacked-marker');

    const badge = createElement('div', {
      className: 'stack-badge',
      title: `${count} édifices à cet emplacement`
    }, count.toString());

    markerElement.appendChild(badge);
  }

  /**
   * Ajouter les marqueurs sur la carte avec clustering
   */
  addMarkersWithClustering(edifices) {
    console.log(`🎯 Ajout de ${edifices.length} édifices avec clustering`);
    
    // Stocker tous les édifices (non filtrés) seulement si c'est un chargement complet
    // On détecte un chargement complet si on a plus d'édifices qu'avant
    if (edifices.length >= this.allEdifices.length) {
      this.allEdifices = edifices;
    }
    
    // Nettoyer d'abord
    this.clearMarkers();
    
    // Retirer les anciens event listeners si existants
    if (this.usesClustering) {
      this.map.off('moveend', this._updateClustersHandler);
      this.map.off('zoomend', this._updateClustersHandler);
    }
    
    // Initialiser le clustering
    const initialized = clusteringService.initialize(edifices);
    if (!initialized) {
      console.warn('⚠️ Clustering non disponible, utilisation du mode classique');
      this.addMarkersClassic(edifices);
      return;
    }

    this.usesClustering = true;

    // Créer une fonction handler qu'on peut retirer plus tard
    this._updateClustersHandler = () => this._updateClusters();

    // Écouter les changements de zoom/déplacement
    this.map.on('moveend', this._updateClustersHandler);
    this.map.on('zoomend', this._updateClustersHandler);
    
    // Premier affichage
    this._updateClusters();
  }

  /**
   * Mettre à jour les clusters
   */
  _updateClusters() {
    if (!this.usesClustering) return;

    // Supprimer les anciens marqueurs de cluster
    this.clusterMarkers.forEach(marker => marker.remove());
    this.clusterMarkers = [];
    
    // Obtenir la bbox de la carte
    const bounds = this.map.getBounds();
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ];
    
    // Obtenir le zoom
    const zoom = this.map.getZoom();
    
    // Obtenir les clusters
    const clusters = clusteringService.getClusters(bbox, zoom);
    
    // Créer un marqueur pour chaque cluster
    clusters.forEach(cluster => {
      const [lng, lat] = cluster.geometry.coordinates;
      const properties = cluster.properties;
      
      if (properties.cluster) {
        // C'est un cluster (plusieurs édifices)
        this._createClusterMarker(lng, lat, properties);
      } else {
        // C'est un édifice unique
        this._createSingleMarker(lng, lat, properties.edifice);
      }
    });
  }

  /**
   * Créer un marqueur de cluster
   */
  _createClusterMarker(lng, lat, properties) {
    const count = properties.point_count;
    const clusterId = properties.cluster_id;
    
    // Déterminer la couleur selon le nombre
    let badgeColor = '#3b82f6';  // Bleu
    if (count >= 10) badgeColor = '#ef4444';  // Rouge
    else if (count >= 5) badgeColor = '#f59e0b';  // Orange
    
    // Créer l'élément HTML du marqueur
    const el = document.createElement('div');
    el.className = 'marker-cluster';
    el.innerHTML = `
      <div class="marker-cluster-icon">📍</div>
      <div class="marker-cluster-badge" style="background: ${badgeColor}">${count}</div>
    `;
    
    // Créer le marqueur Mapbox
    const marker = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .addTo(this.map);
    
    // Au clic : zoomer pour séparer
    el.addEventListener('click', () => {
      const expansionZoom = clusteringService.getClusterExpansionZoom(clusterId);
      this.map.easeTo({
        center: [lng, lat],
        zoom: expansionZoom,
        duration: 500
      });
    });
    
    this.clusterMarkers.push(marker);
  }

  /**
   * Créer un marqueur unique
   */
  _createSingleMarker(lng, lat, edifice) {
    const { id, nom, categorie = 'autres' } = edifice;

    // Créer l'élément DOM du marqueur
    const el = createElement('div', {
      className: `marker marker--${categorie}`,
      'data-id': id,
      'data-categorie': categorie
    });

    // Style du marqueur
    Object.assign(el.style, {
      cursor: 'pointer',
      width: '20px',
      height: '20px',
      backgroundColor: CONFIG.categories[categorie]?.color || '#808080',
      border: '2px solid white',
      borderRadius: '50%',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)'
    });

    // Créer le marqueur Mapbox
    const marker = new mapboxgl.Marker(el)
      .setLngLat([lng, lat])
      .addTo(this.map);

    // Popup au survol
    const popup = new mapboxgl.Popup({
      offset: 25,
      closeButton: false,
      className: 'marker-popup',
      maxWidth: '300px'
    }).setHTML(`<strong>${nom}</strong>`);

    el.addEventListener('mouseenter', () => {
      popup.setLngLat([lng, lat]).addTo(this.map);
    });

    el.addEventListener('mouseleave', () => {
      popup.remove();
    });

    // Au clic : afficher les détails
    el.addEventListener('click', (e) => {
      e.stopPropagation(); // ← EMPÊCHER LA PROPAGATION
      
      console.log('🖱️ Clic sur marqueur détecté');
      console.log('📦 Données édifice brutes:', edifice);
      console.log('🖼️ Type de images:', typeof edifice.images, Array.isArray(edifice.images));
      
      // Normaliser les images - peut être un tableau, un objet, ou null
      let normalizedImages = [];
      if (edifice.images) {
        if (Array.isArray(edifice.images)) {
          normalizedImages = edifice.images;
        } else if (typeof edifice.images === 'object') {
          // Si c'est un objet, essayer de le convertir en tableau
          normalizedImages = Object.values(edifice.images);
        }
      }
      
      // Normaliser l'édifice pour s'assurer que toutes les propriétés sont présentes
      const normalizedEdifice = {
        id: edifice.id,
        nom: edifice.nom || 'Sans nom',
        ville: edifice.ville || '',
        description: edifice.description || '',
        categorie: edifice.categorie || 'autres',
        lng: edifice.lng || edifice.longitude,
        lat: edifice.lat || edifice.latitude,
        images: normalizedImages,
        ...edifice // Garder toutes les autres propriétés
      };
      
      // Forcer images à être un tableau
      normalizedEdifice.images = normalizedImages;
      
      console.log('📦 Édifice normalisé:', normalizedEdifice);
      console.log('🖼️ Images normalisées:', normalizedEdifice.images);
      
      try {
        uiManager.openSidePanel(normalizedEdifice);
        console.log('✅ openSidePanel appelé avec succès');
        
        // Vérifier l'état du panneau après appel
        setTimeout(() => {
          const panel = document.getElementById('side-panel');
          console.log('🔍 Classes du panneau après ouverture:', panel.classList.value);
        }, 100);
      } catch (error) {
        console.error('❌ Erreur lors de l\'appel à openSidePanel:', error);
      }
    });
    
    this.clusterMarkers.push(marker);
  }

  /**
   * Ajouter les marqueurs en mode classique (sans clustering)
   */
  addMarkersClassic(edifices) {
    console.log(`📍 Ajout de ${edifices.length} marqueurs (mode classique)`);
    this.usesClustering = false;
    
    edifices.forEach(edifice => {
      this.createMarker(edifice);
    });
  }


  /**
   * Affiche un popup d'avertissement de zoom
   * @param {number} lng
   * @param {number} lat
   * @param {number} count
   */
  showZoomWarning(lng, lat, count) {
    if (this.currentPopup) {
      this.currentPopup.remove();
    }

    this.currentPopup = new mapboxgl.Popup({
      closeButton: false,
      className: 'popup-zoom-warning'
    })
      .setLngLat([lng, lat])
      .setHTML(`⚠️ ${count} édifices ici<br><small>Zoomer pour les séparer</small>`)
      .addTo(this.map);

    setTimeout(() => {
      if (this.currentPopup) {
        this.currentPopup.remove();
        this.currentPopup = null;
      }
    }, 3000);
  }

  /**
   * Centre la carte sur des coordonnées
   * @param {Array<number>} coords - [lng, lat]
   * @param {number} zoom
   */
  flyTo(coords, zoom = 15) {
    this.map.flyTo({
      center: coords,
      zoom: zoom,
      duration: 1500
    });
  }

  /**
   * Zoom in
   */
  zoomIn() {
    this.map.zoomIn();
  }

  /**
   * Zoom out
   */
  zoomOut() {
    this.map.zoomOut();
  }

  /**
   * Obtient le niveau de zoom actuel
   * @returns {number}
   */
  getZoom() {
    return this.map.getZoom();
  }

  /**
   * Ajoute un écouteur d'événement sur la carte
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    this.map.on(event, callback);
  }

  
   // DÉSACTIVÉ TEMPORAIREMENT - à réactiver avec animation pulsante
  updateStackBadges() {    
  }
}

// Instance singleton
export const mapService = new MapService();
