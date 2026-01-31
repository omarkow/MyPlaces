/**
 * Service de gestion de la carte Mapbox et des marqueurs
 * @module services/map
 */

import { CONFIG } from '../config.js';
import { createElement } from '../utils/dom.js';

/**
 * Classe de gestion de la carte Mapbox
 */
export class MapService {
  constructor() {
    this.map = null;
    this.geocoder = null;
    this.markers = {}; // { id: { element, marker, categorie, edifice } }
    this.currentPopup = null;
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
      placeholder: "Rechercher une adresse pour ajouter un lieu...",
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
      console.log('✅ Geocoder déjà présent sur la carte');
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
        console.log('✅ Geocoder affiché');
      }
    } else {
      if (geocoderControl) {
        geocoderControl.style.display = 'none';
        console.log('🔒 Geocoder caché');
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
      className: 'marker-popup'
    }).setHTML(`<strong>${nom}</strong>`);

    el.addEventListener('mouseenter', () => {
      popup.setLngLat([lng, lat]).addTo(this.map);
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
    Object.values(this.markers).forEach(({ marker }) => marker.remove());
    this.markers = {};
  }

  /**
   * Applique les filtres de catégories
   * @param {Array<string>} activeCategories
   */
  applyFilters(activeCategories) {
    Object.values(this.markers).forEach(({ element, categorie }) => {
      element.style.display = activeCategories.includes(categorie) ? 'block' : 'none';
    });
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

  /**
   * Met à jour tous les badges de superposition
   */
  updateStackBadges() {
    Object.entries(this.markers).forEach(([id, { element, marker }]) => {
      const lngLat = marker.getLngLat();
      if (!lngLat) return;

      const stacked = this.getStackedMarkers(lngLat.lng, lngLat.lat);
      this.addStackBadge(element, stacked.length);
    });
  }
}

// Instance singleton
export const mapService = new MapService();
