/**
 * Gestionnaire de formulaires d'édifices
 * Gère l'ajout et l'édition des édifices
 * @module ui/form-manager
 */

import { DOM, createElement, showNotification } from '../utils/dom.js';
import { CONFIG } from '../config.js';
import { apiService } from '../services/api.js';
import { authService } from '../services/auth.js';
import { mapService } from '../services/map.js';

/**
 * Classe de gestion des formulaires d'édifices
 */
export class FormManager {
  constructor() {
    this.currentEdificeId = null;
    this.tempExistingImages = [];
    this.deletedImages = [];
    this.editGeocoder = null;
  }

  /**
   * Ouvre le formulaire pour ajouter un nouvel édifice
   * @param {number} lng - Longitude
   * @param {number} lat - Latitude
   * @param {string} placeName - Nom du lieu (depuis geocoder)
   */
  openNewEdificeForm(lng, lat, placeName = '') {
    if (!authService.isAdmin()) {
      showNotification('Accès réservé aux administrateurs', 'error');
      return;
    }

    console.log('📝 Ouverture formulaire nouvel édifice:', { lng, lat, placeName });

    this.currentEdificeId = null;
    this.tempExistingImages = [];
    this.deletedImages = [];

    this._renderForm({
      isEdit: false,
      lng,
      lat,
      placeName
    });
  }

  /**
   * Ouvre le formulaire pour éditer un édifice existant
   * @param {Object} edifice - Données de l'édifice
   */
  openEditEdificeForm(edifice) {
    if (!authService.isAdmin()) {
      showNotification('Accès réservé aux administrateurs', 'error');
      return;
    }

    console.log('✏️ Ouverture formulaire édition:', edifice);

    this.currentEdificeId = edifice.id;
    this.tempExistingImages = Array.isArray(edifice.images) ? [...edifice.images] : [];
    this.deletedImages = [];

    this._renderForm({
      isEdit: true,
      ...edifice
    });
  }

  /**
   * Génère le HTML du formulaire
   * @private
   */
  _renderForm(data) {
    const { isEdit, lng, lat, nom = '', ville = '', description = '', categorie = 'autres', placeName = '' } = data;

    const sidePanel = DOM.sidePanel();
    if (!sidePanel) return;

    // Titre
    const title = DOM.panelTitle();
    if (title) {
      title.innerHTML = `
        <div style="margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 28px; font-weight: 600; color: var(--accent-color);">
            ${isEdit ? "Modifier l'édifice" : "Nouvel édifice"}
          </h2>
          <div style="width: 50px; height: 3px; background: var(--accent-color); margin-top: 8px; border-radius: 2px;"></div>
        </div>
      `;
    }

    // Champs du formulaire
    const city = DOM.panelCity();
    if (city) {
      city.innerHTML = `
        <div style="display: grid; gap: 20px;">
          <div>
            <label class="form-label">Nom de l'édifice</label>
            <input type="text" id="edit-nom" placeholder="Nom" class="form-input" value="${nom}">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">Adresse</label>
              <input type="text" id="edit-adresse" placeholder="Rue et numéro" class="form-input" value="${placeName}">
            </div>
            <div>
              <label class="form-label">Ville</label>
              <input type="text" id="edit-city" placeholder="Ville" class="form-input" value="${ville}">
            </div>
          </div>
          <div>
            <label class="form-label">Catégorie</label>
            <select id="edit-categorie" class="form-input">
              ${Object.entries(CONFIG.categories).map(([key, cat]) => 
                `<option value="${key}" ${categorie === key ? 'selected' : ''}>${cat.label}</option>`
              ).join('')}
            </select>
          </div>
          <input type="hidden" id="edit-lng" value="${lng}">
          <input type="hidden" id="edit-lat" value="${lat}">
        </div>
      `;
    }

    // Description
    const description_el = DOM.panelDescription();
    if (description_el) {
      description_el.innerHTML = `
        <div style="margin-top: 20px;">
          <label class="form-label">Description</label>
          <textarea id="edit-desc" placeholder="Décrivez l'édifice (histoire, caractéristiques, etc.)" 
                    class="form-input" style="min-height: 100px; resize: vertical;">${description}</textarea>
        </div>
      `;
    }

    // Zone photos
    const imageContainer = DOM.panelImageContainer();
    if (imageContainer) {
      imageContainer.innerHTML = `
        <div style="margin-top: 20px;">
          <label class="form-label">Photos</label>
          <label class="custom-file-upload" id="file-label">
            📷 Ajouter des photos
            <input type="file" id="file-upload" multiple accept="image/*" style="display:none;">
          </label>
          <div id="upload-status" style="margin-top: 8px; font-size: 12px; color: var(--accent-color);"></div>
          <div id="preview-thumbnails" class="preview-thumbnails" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;"></div>
        </div>
      `;

      // Afficher les images existantes en mode édition
      if (isEdit && this.tempExistingImages.length > 0) {
        this._renderExistingImages();
      }

      // IMPORTANT : Gérer l'upload APRÈS avoir créé le HTML
      setTimeout(() => {
        this._setupImageUpload();
      }, 50);
    }

    // Geocoder pour édition (corriger l'adresse)
    if (isEdit) {
      this._setupEditGeocoder();
    }

    // Boutons d'action
    const adminControls = DOM.adminControls();
    if (adminControls) {
      if (isEdit) {
        adminControls.innerHTML = `
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(184, 134, 11, 0.1);">
            <button id="btn-update-action" class="btn-admin btn-submit">
              💾 Enregistrer les modifications
            </button>
          </div>
        `;
        document.getElementById('btn-update-action').onclick = () => this._handleUpdate();
      } else {
        adminControls.innerHTML = `
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(184, 134, 11, 0.1);">
            <button id="btn-save-action" class="btn-admin btn-submit">
              ✨ Créer l'édifice
            </button>
          </div>
        `;
        document.getElementById('btn-save-action').onclick = () => this._handleCreate();
      }
    }

    // Afficher le panneau
    sidePanel.classList.remove('panel-hidden');
    sidePanel.style.visibility = 'visible';
  }

  /**
   * Affiche les images existantes avec bouton de suppression
   * @private
   */
  _renderExistingImages() {
    const previewContainer = document.getElementById('preview-thumbnails');
    if (!previewContainer) return;

    // IMPORTANT : Ajouter la classe edit-mode pour afficher les croix
    previewContainer.classList.add('edit-mode');
    previewContainer.innerHTML = '';

    this.tempExistingImages.forEach((url, index) => {
      const wrapper = createElement('div', { className: 'photo-preview-wrapper' });
      
      const img = createElement('img', { 
        src: url,
        style: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '5px' }
      });

      const deleteBtn = createElement('button', {
        className: 'photo-delete-btn',
        innerHTML: '×',
        title: 'Supprimer cette photo',
        onclick: async (e) => {
          e.stopPropagation();
          if (confirm('Supprimer cette photo ?')) {
            this.deletedImages.push(url);
            await apiService.deleteImage(url);
            wrapper.remove();
            showNotification('Photo supprimée', 'success');
          }
        }
      });

      wrapper.appendChild(img);
      wrapper.appendChild(deleteBtn);
      previewContainer.appendChild(wrapper);
    });
  }

  /**
   * Configure l'upload d'images
   * @private
   */
  _setupImageUpload() {
    const fileInput = document.getElementById('file-upload');
    if (!fileInput) {
      console.warn('⚠️ Input file-upload introuvable');
      return;
    }

    // Retirer l'ancien listener s'il existe
    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);

    // Ajouter le nouveau listener
    newFileInput.addEventListener('change', (e) => {
      console.log('📸 Upload déclenché, fichiers:', e.target.files.length);
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const previewContainer = document.getElementById('preview-thumbnails');
      if (!previewContainer) {
        console.error('❌ Preview container introuvable');
        return;
      }

      // Activer le mode édition pour afficher les croix
      previewContainer.classList.add('edit-mode');

      Array.from(files).forEach((file) => {
        console.log('🖼️ Traitement image:', file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
          const wrapper = createElement('div', { className: 'photo-preview-wrapper' });
          
          const img = createElement('img', {
            src: event.target.result,
            style: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '5px', opacity: '1' }
          });

          const deleteBtn = createElement('button', {
            className: 'photo-delete-btn',
            innerHTML: '×',
            title: 'Supprimer cette photo',
            onclick: (e) => {
              e.stopPropagation();
              if (confirm('Supprimer cette photo ?')) {
                wrapper.remove();
                console.log('🗑️ Photo preview supprimée');
              }
            }
          });

          wrapper.appendChild(img);
          wrapper.appendChild(deleteBtn);
          previewContainer.appendChild(wrapper);
          console.log('✅ Photo ajoutée au preview');
        };
        reader.readAsDataURL(file);
      });
    });

    console.log('✅ Upload listener configuré');
  }

  /**
   * Configure le geocoder pour l'édition
   * @private
   */
  _setupEditGeocoder() {
    const adresseInput = document.getElementById('edit-adresse');
    if (!adresseInput || !adresseInput.parentNode) return;

    const geocoderContainer = createElement('div', { 
      id: 'edit-geocoder',
      style: { marginTop: '8px' }
    });
    
    adresseInput.parentNode.appendChild(geocoderContainer);

    this.editGeocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      placeholder: "Corriger l'adresse (GPS auto)",
      marker: false,
      language: 'fr'
    });

    geocoderContainer.appendChild(this.editGeocoder.onAdd(mapService.map));

    this.editGeocoder.on('result', (e) => {
      const coords = e.result.geometry.coordinates;
      document.getElementById('edit-lng').value = coords[0];
      document.getElementById('edit-lat').value = coords[1];
      showNotification('Coordonnées mises à jour', 'success');
    });
  }

  /**
   * Gère la création d'un nouvel édifice
   * @private
   */
  async _handleCreate() {
    const status = document.getElementById('upload-status');
    const fileInput = document.getElementById('file-upload');

    const edificeData = {
      nom: document.getElementById('edit-nom')?.value || '',
      ville: document.getElementById('edit-city')?.value || '',
      description: document.getElementById('edit-desc')?.value || '',
      lng: parseFloat(document.getElementById('edit-lng')?.value),
      lat: parseFloat(document.getElementById('edit-lat')?.value),
      categorie: document.getElementById('edit-categorie')?.value || 'autres'
    };

    // Validation
    if (!edificeData.nom) {
      showNotification('Le nom est obligatoire', 'error');
      return;
    }

    if (status) status.textContent = '⏳ Envoi en cours...';

    try {
      // Upload des images
      const imageUrls = [];
      if (fileInput && fileInput.files.length > 0) {
        for (const file of fileInput.files) {
          const fileName = `${Date.now()}_${file.name}`;
          const url = await apiService.uploadImage(file, fileName);
          if (url) imageUrls.push(url);
        }
      }

      edificeData.images = imageUrls;

      // Créer l'édifice
      const result = await apiService.createEdifice(edificeData);

      if (result.success) {
        if (status) status.textContent = '✅ Édifice créé !';
        
        // Fermer le panneau et recharger
        setTimeout(() => {
          DOM.sidePanel()?.classList.add('panel-hidden');
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error('Erreur création:', error);
      if (status) status.textContent = '❌ Erreur';
    }
  }

  /**
   * Gère la mise à jour d'un édifice existant
   * @private
   */
  async _handleUpdate() {
    if (!this.currentEdificeId) {
      showNotification('Erreur: ID édifice manquant', 'error');
      return;
    }

    const status = document.getElementById('upload-status');
    const fileInput = document.getElementById('file-upload');

    const updates = {
      nom: document.getElementById('edit-nom')?.value || '',
      ville: document.getElementById('edit-city')?.value || '',
      description: document.getElementById('edit-desc')?.value || '',
      lng: parseFloat(document.getElementById('edit-lng')?.value),
      lat: parseFloat(document.getElementById('edit-lat')?.value),
      categorie: document.getElementById('edit-categorie')?.value || 'autres'
    };

    if (status) status.textContent = '⏳ Mise à jour...';

    try {
      // Upload de nouvelles images
      const newImageUrls = [];
      if (fileInput && fileInput.files.length > 0) {
        for (const file of fileInput.files) {
          const fileName = `${Date.now()}_${file.name}`;
          const url = await apiService.uploadImage(file, fileName);
          if (url) newImageUrls.push(url);
        }
      }

      // Combiner images existantes (non supprimées) et nouvelles
      const remainingImages = this.tempExistingImages.filter(
        img => !this.deletedImages.includes(img)
      );
      updates.images = [...remainingImages, ...newImageUrls];

      // Mettre à jour
      const result = await apiService.updateEdifice(this.currentEdificeId, updates);

      if (result.success) {
        if (status) status.textContent = '✅ Modifications enregistrées !';
        
        setTimeout(() => {
          DOM.sidePanel()?.classList.add('panel-hidden');
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      if (status) status.textContent = '❌ Erreur';
    }
  }

  /**
   * Nettoie le geocoder d'édition
   */
  cleanup() {
    if (this.editGeocoder) {
      this.editGeocoder.clear();
      this.editGeocoder = null;
    }
  }
}

// Instance singleton
export const formManager = new FormManager();
