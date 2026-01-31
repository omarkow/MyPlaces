/**
 * Gestionnaire de l'interface utilisateur
 * @module ui/manager
 */

import { DOM, toggleElement, createElement, showNotification } from '../utils/dom.js';
import { CONFIG } from '../config.js';
import { authService } from '../services/auth.js';
import { mapService } from '../services/map.js';

/**
 * Classe de gestion de l'interface utilisateur
 */
export class UIManager {
  constructor() {
    this.lightboxImages = [];
    this.currentLightboxIndex = 0;
  }

  /**
   * Initialise tous les événements UI
   */
  initialize() {
    this._setupLoginModal();
    this._setupSidePanel();
    this._setupLightbox();
    this._setupFilters();
    this._setupZoomControls();
    this._setupKeyboardShortcuts();
    this._setupAdminButton();

    // Écouter les changements d'authentification
    authService.onAuthStateChange(() => this.updateForAuthState());
  }

  /**
   * Configure le bouton admin d'ajout
   * @private
   */
  _setupAdminButton() {
    const adminBtn = DOM.adminAddButton();
    if (adminBtn) {
      adminBtn.onclick = () => {
        if (!authService.isAdmin()) {
          showNotification('Accès réservé aux administrateurs', 'error');
          return;
        }
        
        // Focus sur le geocoder pour encourager son utilisation
        const geocoderInput = document.querySelector('.mapboxgl-ctrl-geocoder input');
        if (geocoderInput) {
          geocoderInput.focus();
          showNotification('Recherchez une adresse pour ajouter un lieu', 'info');
        } else {
          showNotification('Le geocoder n\'est pas encore chargé', 'warning');
        }
      };
    }
  }

  /**
   * Met à jour l'UI en fonction de l'état d'authentification
   */
  updateForAuthState() {
    const user = authService.getCurrentUser();
    const loginBtn = DOM.loginBtn();
    const adminBtn = DOM.adminAddButton();

    if (!user) {
      // Utilisateur déconnecté
      if (loginBtn) {
        loginBtn.textContent = 'Connexion';
        loginBtn.onclick = () => this.openLoginModal();
      }
      
      if (adminBtn) adminBtn.classList.add('hidden');
      mapService.toggleGeocoder(false);
      
      return;
    }

    // Utilisateur connecté
    if (loginBtn) {
      loginBtn.textContent = 'Déconnexion';
      loginBtn.onclick = () => this.handleLogout();
    }

    if (authService.isAdmin()) {
      if (adminBtn) adminBtn.classList.remove('hidden');
      
      // Afficher le geocoder pour les admins
      // Important: le faire après un délai pour s'assurer que la carte est chargée
      setTimeout(() => {
        mapService.toggleGeocoder(true);
        console.log('✅ Geocoder activé pour admin');
      }, 100);
    } else {
      if (adminBtn) adminBtn.classList.add('hidden');
      mapService.toggleGeocoder(false);
    }
  }

  /**
   * Configure la modal de connexion
   * @private
   */
  _setupLoginModal() {
    const modal = DOM.loginModal();
    const closeBtn = DOM.closeLogin();
    const form = DOM.loginForm();

    if (closeBtn) {
      closeBtn.onclick = () => this.closeLoginModal();
    }

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleLogin();
      };
    }

    // Fermer au clic en dehors
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) {
          this.closeLoginModal();
        }
      };
    }
  }

  /**
   * Ouvre la modal de connexion
   */
  openLoginModal() {
    const modal = DOM.loginModal();
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  /**
   * Ferme la modal de connexion
   */
  closeLoginModal() {
    const modal = DOM.loginModal();
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Gère la connexion
   */
  async handleLogin() {
    const email = DOM.emailInput()?.value;
    const password = DOM.passwordInput()?.value;

    if (!email || !password) {
      showNotification('Veuillez remplir tous les champs', 'error');
      return;
    }

    const success = await authService.signIn(email, password);
    
    if (success) {
      this.closeLoginModal();
      setTimeout(() => location.reload(), 500);
    }
  }

  /**
   * Gère la déconnexion
   */
  async handleLogout() {
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
      await authService.signOut();
      setTimeout(() => location.reload(), 500);
    }
  }

  /**
   * Configure le panneau latéral
   * @private
   */
  _setupSidePanel() {
    const closeBtn = DOM.closePanel();
    const panel = DOM.sidePanel();
    const mapContainer = DOM.mapContainer();

    if (closeBtn) {
      closeBtn.onclick = () => this.closeSidePanel();
    }

    // Fermer au clic sur la carte
    if (mapContainer) {
      mapContainer.addEventListener('click', (e) => {
        if (panel && !panel.classList.contains('panel-hidden')) {
          this.closeSidePanel();
        }
      });
    }

    // Empêcher la fermeture au clic dans le panneau
    if (panel) {
      panel.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  /**
   * Ouvre le panneau latéral avec les détails d'un édifice
   * @param {Object} edifice
   */
  openSidePanel(edifice) {
    const panel = DOM.sidePanel();
    const title = DOM.panelTitle();
    const city = DOM.panelCity();
    const description = DOM.panelDescription();
    const imageContainer = DOM.panelImageContainer();
    const adminControls = DOM.adminControls();

    if (!panel) return;

    // Remplir le contenu
    if (title) title.textContent = edifice.nom || 'Sans nom';
    if (city) city.textContent = edifice.ville || '';
    if (description) {
      description.textContent = edifice.description || 'Aucune description disponible';
    }

    // Afficher les images
    if (imageContainer) {
      imageContainer.innerHTML = '';
      const images = edifice.images || [];
      
      if (images.length > 0) {
        this.lightboxImages = images;
        
        images.forEach((imgUrl, index) => {
          const img = createElement('img', {
            src: imgUrl,
            alt: `${edifice.nom} - Photo ${index + 1}`,
            className: 'panel-img',
            onclick: () => this.openLightbox(index)
          });
          imageContainer.appendChild(img);
        });
      }
    }

    // Afficher les contrôles admin si nécessaire
    if (adminControls) {
      adminControls.innerHTML = '';
      
      if (authService.isAdmin()) {
        const editBtn = createElement('button', {
          className: 'btn-admin',
          onclick: () => this.openEditForm(edifice)
        }, '✏️ Modifier');

        const deleteBtn = createElement('button', {
          className: 'btn-admin btn-danger',
          onclick: () => this.handleDeleteEdifice(edifice.id)
        }, '🗑️ Supprimer');

        adminControls.appendChild(editBtn);
        adminControls.appendChild(deleteBtn);
      }
    }

    // Afficher le panneau
    panel.style.visibility = 'visible';
    panel.classList.remove('panel-hidden');
  }

  /**
   * Ferme le panneau latéral
   */
  closeSidePanel() {
    const panel = DOM.sidePanel();
    if (!panel) return;

    panel.classList.add('panel-hidden');
    setTimeout(() => {
      panel.style.visibility = 'hidden';
    }, CONFIG.ui.panelTransitionDuration);
  }

  /**
   * Configure la lightbox
   * @private
   */
  _setupLightbox() {
    const lightbox = DOM.lightbox();
    const closeBtn = DOM.lightboxClose();
    const prevBtn = DOM.prevBtn();
    const nextBtn = DOM.nextBtn();

    if (closeBtn) {
      closeBtn.onclick = () => this.closeLightbox();
    }

    if (prevBtn) {
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        this.previousImage();
      };
    }

    if (nextBtn) {
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        this.nextImage();
      };
    }

    // Fermer au clic en dehors
    if (lightbox) {
      lightbox.onclick = (e) => {
        if (e.target === lightbox) {
          this.closeLightbox();
        }
      };
    }
  }

  /**
   * Ouvre la lightbox
   * @param {number} index
   */
  openLightbox(index) {
    if (this.lightboxImages.length === 0) return;

    this.currentLightboxIndex = index;
    const lightbox = DOM.lightbox();
    const img = DOM.lightboxImg();

    if (img) {
      img.src = this.lightboxImages[this.currentLightboxIndex];
    }

    if (lightbox) {
      lightbox.style.display = 'flex';
    }
  }

  /**
   * Ferme la lightbox
   */
  closeLightbox() {
    const lightbox = DOM.lightbox();
    if (lightbox) {
      lightbox.style.display = 'none';
    }
  }

  /**
   * Image suivante dans la lightbox
   */
  nextImage() {
    this.currentLightboxIndex = (this.currentLightboxIndex + 1) % this.lightboxImages.length;
    const img = DOM.lightboxImg();
    if (img) {
      img.src = this.lightboxImages[this.currentLightboxIndex];
    }
  }

  /**
   * Image précédente dans la lightbox
   */
  previousImage() {
    this.currentLightboxIndex = 
      (this.currentLightboxIndex - 1 + this.lightboxImages.length) % this.lightboxImages.length;
    const img = DOM.lightboxImg();
    if (img) {
      img.src = this.lightboxImages[this.currentLightboxIndex];
    }
  }

  /**
   * Configure les filtres de catégories
   * @private
   */
  _setupFilters() {
    const btnToggle = DOM.btnFiltersToggle();
    const btnClose = DOM.btnCloseFilters();
    const btnToggleAll = DOM.btnToggleAll();
    const filterPanel = DOM.categoryFilters();
    const filters = DOM.catFilters();

    // Ouvrir/fermer le panneau
    if (btnToggle) {
      btnToggle.onclick = () => {
        if (filterPanel) {
          filterPanel.style.display = 
            filterPanel.style.display === 'block' ? 'none' : 'block';
        }
      };
    }

    if (btnClose) {
      btnClose.onclick = () => {
        if (filterPanel) {
          filterPanel.style.display = 'none';
        }
      };
    }

    // Gérer les changements de filtres
    filters.forEach(filter => {
      filter.addEventListener('change', () => this.applyFilters());
    });

    // Tout voir / Tout masquer
    if (btnToggleAll) {
      btnToggleAll.onclick = () => {
        const showAll = btnToggleAll.textContent === 'Tout voir';
        filters.forEach(cb => cb.checked = showAll);
        btnToggleAll.textContent = showAll ? 'Tout masquer' : 'Tout voir';
        this.applyFilters();
      };
    }

    // Fermer au chargement
    if (filterPanel) {
      filterPanel.style.display = 'none';
    }
  }

  /**
   * Applique les filtres de catégories
   */
  applyFilters() {
    const filters = DOM.catFilters();
    const activeCategories = Array.from(filters)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    mapService.applyFilters(activeCategories);
  }

  /**
   * Configure les contrôles de zoom
   * @private
   */
  _setupZoomControls() {
    const zoomIn = DOM.zoomInBtn();
    const zoomOut = DOM.zoomOutBtn();

    if (zoomIn) {
      zoomIn.onclick = () => mapService.zoomIn();
    }

    if (zoomOut) {
      zoomOut.onclick = () => mapService.zoomOut();
    }
  }

  /**
   * Configure les raccourcis clavier
   * @private
   */
  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Échap : fermer lightbox et panneau
      if (e.key === 'Escape') {
        this.closeLightbox();
        this.closeSidePanel();
      }

      // Flèches dans la lightbox
      const lightbox = DOM.lightbox();
      if (lightbox && lightbox.style.display === 'flex') {
        if (e.key === 'ArrowRight') this.nextImage();
        if (e.key === 'ArrowLeft') this.previousImage();
      }
    });
  }

  /**
   * Ouvre le formulaire d'édition (placeholder)
   * @param {Object} edifice
   */
  openEditForm(edifice) {
    showNotification('Fonctionnalité d\'édition à implémenter', 'info');
    console.log('Éditer:', edifice);
  }

  /**
   * Gère la suppression d'un édifice (placeholder)
   * @param {number} id
   */
  async handleDeleteEdifice(id) {
    if (!confirm('Voulez-vous vraiment supprimer cet édifice ?')) return;
    
    showNotification('Fonctionnalité de suppression à implémenter', 'info');
    console.log('Supprimer ID:', id);
  }
}

// Instance singleton
export const uiManager = new UIManager();
