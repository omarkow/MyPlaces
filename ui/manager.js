/**
 * Gestionnaire de l'interface utilisateur
 * @module ui/manager
 */

import { DOM, toggleElement, createElement, showNotification } from '../utils/dom.js';
import { CONFIG } from '../config.js';
import { authService } from '../services/auth.js';
import { mapService } from '../services/map.js';
import { apiService } from '../services/api-pocketbase.js';

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

    // Écouter les changements d'authentification
    authService.onAuthStateChange(() => this.updateForAuthState());
  }

  /**
   * Met à jour l'UI en fonction de l'état d'authentification
   */
  updateForAuthState() {
    const user = authService.getCurrentUser();
    const loginBtn = DOM.loginBtn();

    // Nettoyer un éventuel élément nom-utilisateur précédent
    const existingName = document.getElementById('user-display-name');
    if (existingName) existingName.remove();

    if (!user) {
      // Utilisateur déconnecté
      if (loginBtn) {
        loginBtn.textContent = 'Connexion';
        loginBtn.onclick = () => this.openLoginModal();
      }
      return;
    }

    // Utilisateur connecté — afficher le nom au DÉBUT de navbar-right
    if (loginBtn) {
      loginBtn.textContent = 'Déconnexion';
      loginBtn.onclick = () => this.handleLogout();

      const displayName = user.name || user.email || 'Utilisateur';
      const nameEl = document.createElement('span');
      nameEl.id = 'user-display-name';
      nameEl.className = 'user-display-name';
      nameEl.textContent = displayName;
      
      // Insérer en PREMIÈRE position dans navbar-right
      const navbarRight = loginBtn.parentNode;
      if (navbarRight) {
        navbarRight.insertBefore(nameEl, navbarRight.firstChild);
      }
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

    // Fermer au clic sur la carte (AVEC DÉLAI pour éviter fermeture immédiate)
    if (mapContainer) {
      mapContainer.addEventListener('click', (e) => {
        // Vérifier que le clic n'est pas sur un marqueur
        if (e.target.closest('.marker') || e.target.closest('.marker-cluster')) {
          return; // Ne pas fermer si clic sur marqueur
        }
        
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
  async openSidePanel(edifice) {
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
      const desc = edifice.description || 'Aucune description disponible';
      const escapeHtml = (text) => text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      description.innerHTML = escapeHtml(desc).replace(/\n/g, '<br>');
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

    // Afficher les contrôles pour les utilisateurs connectés et membres
    if (adminControls) {
      adminControls.innerHTML = '';
      
      const currentUser = authService.getCurrentUser();
      
      if (currentUser) {
        // VÉRIFIER SI L'UTILISATEUR EST MEMBRE DE LA COMMUNAUTÉ
        let isMember = false;
        
        if (edifice.community && edifice.community.id) {
          isMember = await apiService.isUserMemberOfCommunity(edifice.community.id);
        }
        
        // Afficher les boutons UNIQUEMENT si membre
        if (isMember) {
          const editBtn = createElement('button', {
            className: 'btn-admin',
            onclick: () => this.openEditForm(edifice)
          }, '✏️ Modifier');

          adminControls.appendChild(editBtn);
          
          const deleteBtn = createElement('button', {
            className: 'btn-admin btn-danger',
            onclick: () => this.handleDeleteEdifice(edifice.id)
          }, '🗑️ Supprimer');
          
          adminControls.appendChild(deleteBtn);
        } else {
          // Message pour les non-membres
          const infoMessage = createElement('p', {
            style: 'font-size: 0.9em; color: #666; font-style: italic; margin: 10px 0;'
          }, 'Vous devez être membre de cette communauté pour modifier ou supprimer cet édifice.');
          
          adminControls.appendChild(infoMessage);
        }
      }
    }

    // Afficher le panneau
    panel.style.visibility = 'visible';
    panel.classList.remove('panel-hidden');
    panel.classList.add('panel-open');
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
    // Import dynamique pour éviter la dépendance circulaire
    import('./form-manager.js').then(({ formManager }) => {
      formManager.openEditEdificeForm(edifice);
    });
  }

  /**
   * Gère la suppression d'un édifice
   * @param {number} id
   */
  async handleDeleteEdifice(id) {
    if (!confirm('Voulez-vous vraiment supprimer cet édifice ?')) return;
    
    showNotification('Suppression en cours...', 'info');
    
    const result = await apiService.deleteEdifice(id);
    
    if (result.success) {
      showNotification('Édifice supprimé avec succès !', 'success');
      
      // FERMER LE PANNEAU pour revenir à la carte
      this.closeSidePanel();
      
      // Recharger après un délai
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } else {
      showNotification('Erreur lors de la suppression', 'error');
    }
  }
}

// Instance singleton
export const uiManager = new UIManager();
