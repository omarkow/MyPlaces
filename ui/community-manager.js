/**
 * Gestionnaire UI des communautés
 * @module ui/community-manager
 */

import { createElement, showNotification } from '../utils/dom.js';
import { communityService } from '../services/communities.js';
import { authService } from '../services/auth.js';
import { membersService } from '../services/members.js';

class CommunityUIManager {
  constructor() {
    this.dropdownOpen = false;
    this.pendingCount = 0; // nombre de demandes en attente
  }

  /**
   * Initialiser l'UI des communautés
   */
  async initialize() {
    await this._createCommunityDropdown();
    this._setupEventListeners();
    this._setupLogoNavigation();

    // Après que le dropdown soit créé, on sait quelle communauté est active
    // → on peut créer les boutons communauté (owner ou join) si applicable
    await this._initCommunityButtons();
  }

  // ============================================================
  // DROPDOWN COMMUNAUTÉS (code original, inchangé)
  // ============================================================

  /**
   * Créer le dropdown des communautés dans le header
   */
  async _createCommunityDropdown() {
    const header = document.querySelector('.navbar');
    if (!header) return;

    // Charger les communautés
    await communityService.loadCommunities();
    const communities = communityService.getAllCommunities();

    // NE PAS définir de communauté par défaut
    // La communauté est définie par l'URL uniquement

    // Conteneur du dropdown
    const container = createElement('div', {
      className: 'community-dropdown-container'
    });

    // Bouton principal
    const button = createElement('button', {
      className: 'community-dropdown-btn',
      id: 'community-dropdown-btn'
    });

    this._updateDropdownButton(button);

    // Liste déroulante
    const dropdown = createElement('div', {
      className: 'community-dropdown-list',
      id: 'community-dropdown-list',
      style: 'display: none;'
    });

    this._renderCommunityList(dropdown);

    container.appendChild(button);
    container.appendChild(dropdown);

    // Insérer dans navbar-right, avant le bouton login
    const navbarRight = header.querySelector('.navbar-right');
    const loginBtn = document.querySelector('.btn-login');

    if (navbarRight && loginBtn) {
      navbarRight.insertBefore(container, loginBtn);
    } else {
      header.appendChild(container);
    }
  }

  /**
   * Mettre à jour le texte du bouton
   */
  _updateDropdownButton(button) {
    const current = communityService.getCurrentCommunity();
    if (current) {
      button.innerHTML = `🏘️ ${current.name} <span style="margin-left: 5px;">▼</span>`;
    } else {
      button.innerHTML = `🌍 Choisir une communauté <span style="margin-left: 5px;">▼</span>`;
    }
  }

  /**
   * Rendre la liste des communautés
   */
  _renderCommunityList(dropdown) {
    dropdown.innerHTML = '';
    const communities = communityService.getAllCommunities();

    // Option "Toutes les communautés" (retour à la landing)
    const allItem = createElement('div', {
      className: 'community-dropdown-item',
      onclick: () => this._selectAllCommunities()
    });

    const homeIcon = createElement('span', {
      style: 'margin-right: 8px;'
    }, '🌍');

    const allText = createElement('span', {}, 'Toutes les communautés');

    allItem.appendChild(homeIcon);
    allItem.appendChild(allText);
    dropdown.appendChild(allItem);

    // Séparateur
    const separator1 = createElement('div', {
      style: 'border-top: 1px solid #ddd; margin: 5px 0;'
    });
    dropdown.appendChild(separator1);

    // Liste des communautés
    communities.forEach(community => {
      const item = createElement('div', {
        className: 'community-dropdown-item',
        onclick: async () => await this._selectCommunity(community.id)
      });

      const dot = createElement('span', {
        style: `display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${community.color}; margin-right: 8px;`
      });

      const name = createElement('span', {}, community.name);

      item.appendChild(dot);
      item.appendChild(name);
      dropdown.appendChild(item);
    });

    // Bouton "Créer une communauté" si connecté
    if (authService.isAuthenticated()) {
      const separator2 = createElement('div', {
        style: 'border-top: 1px solid #ddd; margin: 5px 0;'
      });

      const createBtn = createElement('div', {
        className: 'community-dropdown-item community-create-btn',
        onclick: () => this._openCreateModal()
      }, '➕ Créer une communauté');

      dropdown.appendChild(separator2);
      dropdown.appendChild(createBtn);
    }
  }

  /**
   * Sélectionner "Toutes les communautés" (retour à la landing)
   */
  _selectAllCommunities() {
    // Mettre à jour l'URL vers la racine
    window.history.pushState({}, '', '/');
    
    // Réinitialiser la communauté actuelle
    communityService.currentCommunity = null;
    
    // Mettre à jour le bouton
    const button = document.getElementById('community-dropdown-btn');
    if (button) {
      button.innerHTML = `🌍 Choisir une communauté <span style="margin-left: 5px;">▼</span>`;
    }

    // Fermer le dropdown
    this._closeDropdown();

    // Afficher la landing page
    if (window.myPlacesApp) {
      window.myPlacesApp.showLandingPage();
    }
  }

  /**
   * Sélectionner une communauté
   */
  async _selectCommunity(communityId) {
    communityService.setCurrentCommunity(communityId);
    
    // Mettre à jour le bouton
    const button = document.getElementById('community-dropdown-btn');
    if (button) {
      this._updateDropdownButton(button);
    }

    // Fermer le dropdown
    this._closeDropdown();

    // Rafraîchir les boutons communauté pour la nouvelle communauté
    // (ceci appelle aussi toggleGeocoder en interne)
    await this._initCommunityButtons();

    // Recharger les édifices
    if (window.myPlacesApp) {
      window.myPlacesApp.loadEdifices();
    }
  }

  /**
   * Ouvrir la modal de création
   */
  _openCreateModal() {
    this._closeDropdown();
    
    const modalHtml = `
      <div id="create-community-modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;">
        <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%;">
          <h2 style="margin-top: 0;">Créer une communauté</h2>
          <form id="create-community-form">
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nom *</label>
              <input type="text" id="community-name" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Description</label>
              <textarea id="community-description" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
            </div>
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">Couleur</label>
              <input type="color" id="community-color" value="#b8860b" style="width: 60px; height: 40px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="display: flex; gap: 10px;">
              <button type="submit" style="flex: 1; padding: 10px; background: #b8860b; color: white; border: none; border-radius: 4px; cursor: pointer;">Créer</button>
              <button type="button" id="cancel-create-community" style="flex: 1; padding: 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer;">Annuler</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Events
    document.getElementById('create-community-form').onsubmit = (e) => this._handleCreateCommunity(e);
    document.getElementById('cancel-create-community').onclick = () => this._closeCreateModal();
    document.getElementById('create-community-modal').onclick = (e) => {
      if (e.target.id === 'create-community-modal') this._closeCreateModal();
    };
  }

  /**
   * Créer la communauté
   */
  async _handleCreateCommunity(e) {
    e.preventDefault();

    const name = document.getElementById('community-name').value;
    const description = document.getElementById('community-description').value;
    const color = document.getElementById('community-color').value;

    const result = await communityService.createCommunity({ name, description, color });

    if (result.success) {
      showNotification('Communauté créée avec succès !', 'success');
      this._closeCreateModal();
      
      // Recharger le dropdown
      const dropdown = document.getElementById('community-dropdown-list');
      if (dropdown) {
        this._renderCommunityList(dropdown);
      }

      // Sélectionner la nouvelle communauté
      await this._selectCommunity(result.data.id);
    } else {
      showNotification('Erreur : ' + result.error, 'error');
    }
  }

  /**
   * Fermer la modal de création
   */
  _closeCreateModal() {
    const modal = document.getElementById('create-community-modal');
    if (modal) modal.remove();
  }

  /**
   * Toggle dropdown
   */
  _toggleDropdown() {
    const dropdown = document.getElementById('community-dropdown-list');
    if (!dropdown) return;

    this.dropdownOpen = !this.dropdownOpen;
    dropdown.style.display = this.dropdownOpen ? 'block' : 'none';
  }

  /**
   * Fermer le dropdown
   */
  _closeDropdown() {
    const dropdown = document.getElementById('community-dropdown-list');
    if (dropdown) {
      dropdown.style.display = 'none';
      this.dropdownOpen = false;
    }
  }

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Toggle dropdown au clic sur le bouton
    const button = document.getElementById('community-dropdown-btn');
    if (button) {
      button.onclick = (e) => {
        e.stopPropagation(); // Empêcher la propagation
        this._toggleDropdown();
      };
    }

    // Fermer au clic ailleurs
    document.addEventListener('click', (e) => {
      const container = e.target.closest('.community-dropdown-container');
      if (!container && this.dropdownOpen) {
        this._closeDropdown();
      }
    });

    // Écouter les changements de communauté
    communityService.onCommunityChange((community) => {
      console.log('🏘️ Communauté changée:', community?.name);
    });
  }

  // ============================================================
  // BOUTON OWNER + PANEL GESTION MEMBRES
  // ============================================================

  /**
   * Initialise les boutons liés à la communauté dans la navbar :
   * - Si owner → boutons Membres + Paramètres
   * - Si non-membre → bouton Demander à rejoindre
   * - Si editor (non-owner) → rien
   * Met aussi à jour la visibilité du geocoder selon le rôle.
   */
  async _initCommunityButtons() {
    const community = communityService.getCurrentCommunity();

    // Nettoyer les boutons précédents
    const existing = document.getElementById('btn-members-owner');
    if (existing) existing.remove();
    const existingSettings = document.getElementById('btn-settings-owner');
    if (existingSettings) existingSettings.remove();
    const existingJoin = document.getElementById('btn-join-community');
    if (existingJoin) existingJoin.remove();

    // Vérifications préalables
    if (!community || !authService.isAuthenticated()) {
      // Pas connecté ou pas de communauté → cacher le geocoder
      const { mapService } = await import('../services/map.js');
      mapService.toggleGeocoder(false);
      this._repositionFiltersBtn();
      return;
    }

    // OPTIMISATION : Un seul appel API pour récupérer le statut complet
    const status = await membersService.getMembershipStatus(community.id);
    const isOwner = (status === 'approved' && await this._checkIfOwner(community.id));
    const canEdit = (status === 'approved'); // approved = owner ou editor

    console.log('🔍 Geocoder visibility check:', { 
      community: community.name, 
      status, 
      isOwner, 
      canEdit 
    });

    // Mettre à jour la visibilité du geocoder selon le statut
    const { mapService } = await import('../services/map.js');
    
    // Utiliser setTimeout pour s'assurer que le geocoder existe dans le DOM
    setTimeout(() => {
      console.log('🎯 Calling toggleGeocoder with:', canEdit);
      mapService.toggleGeocoder(canEdit);
      if (canEdit) {
        mapService.addGeocoderToMap();
      }
    }, 100);

    if (status === 'approved' && isOwner) {
      // CAS 1 : OWNER → afficher boutons Membres + Paramètres
      await this._createOwnerButtons(community.id);
    } else if (status === null || status === 'pending' || status === 'rejected') {
      // CAS 2 : NON-MEMBRE ou DEMANDE EN COURS → afficher bouton "Demander à rejoindre"
      await this._createJoinButton(community.id, status);
    }
    // CAS 3 : EDITOR (non-owner) → pas de boutons spéciaux

    // Repositionner le bouton filtres
    this._repositionFiltersBtn();
  }

  /**
   * Vérifie si l'utilisateur est owner (appel optimisé avec cache local si possible)
   */
  async _checkIfOwner(communityId) {
    try {
      const user = authService.getCurrentUser();
      if (!user) return false;

      const filter = `user="${user.id}" && community="${communityId}" && role="owner" && status="approved"`;
      const data = await apiService.request(
        `collections/community_members/records?filter=${encodeURIComponent(filter)}`
      );
      return data.items.length > 0;
    } catch (error) {
      console.error('Erreur vérification owner:', error);
      return false;
    }
  }

  /**
   * Crée les boutons owner (Membres + Paramètres)
   */
  async _createOwnerButtons(communityId) {
    // Compter les demandes en attente pour le badge
    const pending = await membersService.getPendingRequests(communityId);
    this.pendingCount = pending.length;

    const navbarRight = document.querySelector('.navbar-right');
    const loginBtn = document.querySelector('.btn-login');

    // Bouton 👥 Membres
    const btnMembers = createElement('button', {
      className: 'btn-members-owner',
      id: 'btn-members-owner',
      onclick: (e) => {
        e.stopPropagation();
        this._openMembersPanel();
      }
    });
    btnMembers.innerHTML = `👥 Membres`;

    if (this.pendingCount > 0) {
      const badge = createElement('span', {
        className: 'btn-members-badge'
      }, String(this.pendingCount));
      btnMembers.appendChild(badge);
    }

    if (navbarRight && loginBtn) {
      navbarRight.insertBefore(btnMembers, loginBtn);
    } else if (navbarRight) {
      navbarRight.appendChild(btnMembers);
    }

    // Bouton ⚙️ Paramètres
    const btnSettings = createElement('button', {
      className: 'btn-members-owner btn-settings-owner',
      id: 'btn-settings-owner',
      onclick: (e) => {
        e.stopPropagation();
        this._openSettingsModal();
      }
    });
    btnSettings.innerHTML = `⚙️`;

    if (navbarRight && loginBtn) {
      navbarRight.insertBefore(btnSettings, loginBtn);
    } else if (navbarRight) {
      navbarRight.appendChild(btnSettings);
    }

    console.log(`👥 Boutons owner affichés (${this.pendingCount} demande(s) en attente)`);
  }

  /**
   * Crée le bouton "Demander à rejoindre"
   * @param {string} communityId
   * @param {string|null} status - 'pending' | 'rejected' | null
   */
  async _createJoinButton(communityId, status) {
    const navbarRight = document.querySelector('.navbar-right');

    const btnJoin = createElement('button', {
      className: 'btn-join-community',
      id: 'btn-join-community',
      onclick: async (e) => {
        e.stopPropagation();
        const result = await membersService.requestJoin(communityId);
        if (result.success) {
          // Rafraîchir les boutons après la demande
          await this._initCommunityButtons();
        }
      }
    });

    if (status === 'pending') {
      btnJoin.innerHTML = `⏳ En attente`;
      btnJoin.disabled = true;
      btnJoin.style.opacity = '0.6';
      btnJoin.style.cursor = 'not-allowed';
    } else if (status === 'rejected') {
      btnJoin.innerHTML = `❌ Rejetée`;
      btnJoin.disabled = true;
      btnJoin.style.opacity = '0.6';
      btnJoin.style.cursor = 'not-allowed';
    } else {
      btnJoin.innerHTML = `✋ Rejoindre`;
    }

    // Insérer en 2ème position (juste après le nom utilisateur qui est en 1ère position)
    if (navbarRight && navbarRight.children.length >= 1) {
      // Il y a déjà au moins 1 enfant (le nom) → insérer après lui
      navbarRight.insertBefore(btnJoin, navbarRight.children[1] || null);
    } else if (navbarRight) {
      // Fallback : ajouter à la fin
      navbarRight.appendChild(btnJoin);
    }
  }

  /**
   * Déplace le bouton filtres juste avant le bouton login/déconnexion.
   * Appelé après chaque changement de navbar pour garantir l'ordre :
   * [dropdown] [owner?] [settings?] [filtres] [login]
   */
  _repositionFiltersBtn() {
    const filtersBtn = document.getElementById('btn-filters-toggle');
    const loginBtn   = document.querySelector('.btn-login');
    const navbarRight = document.querySelector('.navbar-right');
    if (filtersBtn && loginBtn && navbarRight) {
      navbarRight.insertBefore(filtersBtn, loginBtn);
    }
  }

  /**
   * Met à jour le badge sur le bouton owner sans recréer le bouton entier
   */
  _updateOwnerBadge() {
    const btn = document.getElementById('btn-members-owner');
    if (!btn) return;

    // Supprimer l'ancien badge
    const oldBadge = btn.querySelector('.btn-members-badge');
    if (oldBadge) oldBadge.remove();

    // En ajouter un nouveau si nécessaire
    if (this.pendingCount > 0) {
      const badge = createElement('span', {
        className: 'btn-members-badge'
      }, String(this.pendingCount));
      btn.appendChild(badge);
    }
  }

  // ============================================================
  // VISIBILITÉ DU GEOCODER
  // ============================================================

  /**
   * Met à jour la visibilité du geocoder selon le rôle
   * de l'utilisateur dans la communauté active.
   */
  async _updateGeocoderVisibility() {
    try {
      const { mapService } = await import('../services/map.js');
      const { authService } = await import('../services/auth.js');
      const { membersService } = await import('../services/members.js');

      const community = communityService.getCurrentCommunity();
      if (!community || !authService.isAuthenticated()) {
        mapService.toggleGeocoder(false);
        return;
      }

      const canEdit = await membersService.isEditorOrOwnerOf(community.id);
      mapService.toggleGeocoder(canEdit);
      if (canEdit) mapService.addGeocoderToMap();
    } catch (err) {
      console.warn('⚠️ _updateGeocoderVisibility:', err);
    }
  }

  // ============================================================
  // MODAL PARAMÈTRES DE COMMUNAUTÉ
  // ============================================================

  /**
   * Ouvre la modal "Paramètres de communauté" (nom, description, couleur).
   * Accessible uniquement à l'owner.
   */
  async _openSettingsModal() {
    const community = communityService.getCurrentCommunity();
    if (!community) return;

    // Supprimer une modal précédente si elle existe
    const prev = document.getElementById('community-settings-modal');
    if (prev) prev.remove();

    const modalHtml = `
      <div id="community-settings-modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;">
        <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
          <h2 style="margin-top: 0;">⚙️ Paramètres — ${community.name}</h2>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nom</label>
            <input type="text" id="settings-community-name" value="${community.name || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Description</label>
            <textarea id="settings-community-description" rows="4" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; resize: vertical;">${community.description || ''}</textarea>
          </div>
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Couleur</label>
            <input type="color" id="settings-community-color" value="${community.color || '#b8860b'}" style="width: 60px; height: 40px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="display: flex; gap: 10px; margin-bottom: 30px;">
            <button id="btn-settings-save" style="flex: 1; padding: 10px; background: #b8860b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 15px;">💾 Sauvegarder</button>
            <button id="btn-settings-cancel" style="flex: 1; padding: 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 15px;">Annuler</button>
          </div>
          
          <!-- Zone dangereuse -->
          <div style="border-top: 2px solid #fee2e2; padding-top: 20px;">
            <h3 style="margin: 0 0 10px; color: #dc2626; font-size: 16px;">⚠️ Zone dangereuse</h3>
            <p style="margin: 0 0 15px; font-size: 13px; color: #666;">La suppression de la communauté est irréversible. Tous les édifices et membres seront également supprimés.</p>
            <button id="btn-delete-community" style="width: 100%; padding: 10px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">🗑️ Supprimer la communauté</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Events
    document.getElementById('btn-settings-save').onclick   = () => this._handleSettingsSave();
    document.getElementById('btn-settings-cancel').onclick = () => this._closeSettingsModal();
    document.getElementById('btn-delete-community').onclick = () => this._handleDeleteCommunity();
    document.getElementById('community-settings-modal').onclick = (e) => {
      if (e.target.id === 'community-settings-modal') this._closeSettingsModal();
    };
  }

  /**
   * Sauvegarde les paramètres de la communauté
   */
  async _handleSettingsSave() {
    const community = communityService.getCurrentCommunity();
    if (!community) return;

    const name        = document.getElementById('settings-community-name').value.trim();
    const description = document.getElementById('settings-community-description').value;
    const color       = document.getElementById('settings-community-color').value;

    if (!name) {
      showNotification('Le nom ne peut pas être vide', 'error');
      return;
    }

    const result = await communityService.updateCommunity(community.id, { name, description, color });

    if (result.success) {
      showNotification('Paramètres sauvegardés !', 'success');
      this._closeSettingsModal();

      // Rafraîchir le bouton du dropdown avec le nouveau nom
      const button = document.getElementById('community-dropdown-btn');
      if (button) this._updateDropdownButton(button);

      // Rafraîchir la liste du dropdown aussi
      const dropdown = document.getElementById('community-dropdown-list');
      if (dropdown) this._renderCommunityList(dropdown);
    } else {
      showNotification('Erreur : ' + result.error, 'error');
    }
  }

  /**
   * Ferme la modal paramètres
   */
  _closeSettingsModal() {
    const modal = document.getElementById('community-settings-modal');
    if (modal) modal.remove();
  }

  /**
   * Gère la suppression de la communauté avec double confirmation
   */
  async _handleDeleteCommunity() {
    const community = communityService.getCurrentCommunity();
    if (!community) return;

    // Première confirmation
    const firstConfirm = confirm(
      `⚠️ ATTENTION : Voulez-vous vraiment supprimer la communauté "${community.name}" ?\n\n` +
      `Cette action masquera la communauté de l'interface.\n` +
      `Les données seront conservées dans la base de données.\n\n` +
      `Appuyez sur OK pour continuer, ou Annuler pour abandonner.`
    );

    if (!firstConfirm) return;

    // Deuxième confirmation avec saisie du nom
    const confirmName = prompt(
      `Pour confirmer, tapez exactement le nom de la communauté :\n"${community.name}"`
    );

    if (confirmName !== community.name) {
      if (confirmName !== null) {
        showNotification('Nom incorrect, suppression annulée', 'info');
      }
      return;
    }

    // Suppression (soft delete)
    try {
      const result = await communityService.deleteCommunity(community.id);
      
      if (result.success) {
        showNotification('Communauté supprimée', 'success');
        this._closeSettingsModal();
        
        // Recharger la liste des communautés pour mettre à jour l'UI
        await communityService.loadCommunities();
        
        // Rediriger vers la page d'accueil
        window.location.href = '/';
      } else {
        showNotification('Erreur : ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Erreur suppression communauté:', error);
      showNotification('Erreur lors de la suppression', 'error');
    }
  }

  // ============================================================
  // MODAL PANEL GESTION MEMBRES
  // ============================================================

  /**
   * Ouvre la modal de gestion des membres.
   * Charge les données puis rend les deux sections.
   */
  async _openMembersPanel() {
    const community = communityService.getCurrentCommunity();
    if (!community) return;

    // Créer l'overlay + modal (ou réutiliser s'il existe déjà)
    let overlay = document.getElementById('members-modal-overlay');
    if (!overlay) {
      overlay = createElement('div', {
        className: 'members-modal-overlay',
        id: 'members-modal-overlay'
      });

      const modal = createElement('div', { className: 'members-modal' });

      // Header
      const header = createElement('div', { className: 'members-modal-header' });
      const title = createElement('h2', {}, '👥 Gestion des membres');
      const closeBtn = createElement('button', {
        className: 'btn-members-modal-close',
        onclick: () => this._closeMembersPanel()
      }, '✕');
      header.appendChild(title);
      header.appendChild(closeBtn);

      // Body (sera rempli dynamiquement)
      const body = createElement('div', {
        className: 'members-modal-body',
        id: 'members-modal-body'
      });

      modal.appendChild(header);
      modal.appendChild(body);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Fermer au clic sur l'overlay (dehors de la modal)
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this._closeMembersPanel();
      });
    }

    // Charger les données
    const [pending, members] = await Promise.all([
      membersService.getPendingRequests(community.id),
      membersService.getMembers(community.id)
    ]);

    this.pendingCount = pending.length;

    // Remplir le body
    const body = document.getElementById('members-modal-body');
    body.innerHTML = '';

    this._renderPendingSection(body, pending);

    // Séparateur entre les sections (sauf si les deux sont vides)
    if (pending.length > 0 || members.length > 0) {
      body.appendChild(createElement('div', { className: 'members-section-separator' }));
    }

    this._renderMembersSection(body, members);

    // Afficher
    overlay.classList.add('open');
  }

  /**
   * Ferme la modal
   */
  _closeMembersPanel() {
    const overlay = document.getElementById('members-modal-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  // ============================================================
  // RENDU DES SECTIONS
  // ============================================================

  /**
   * Rend la section "Demandes en attente"
   * @param {HTMLElement} container - élément parent où insérer
   * @param {Array} pending - tableau de records community_members (status=pending, expand=user)
   */
  _renderPendingSection(container, pending) {
    // Titre section
    const title = createElement('div', { className: 'members-section-title pending-title' });
    title.innerHTML = `⏳ Demandes en attente <span class="section-count">${pending.length}</span>`;
    container.appendChild(title);

    if (pending.length === 0) {
      container.appendChild(createElement('p', { className: 'members-empty-msg' }, 'Aucune demande en attente.'));
      return;
    }

    pending.forEach(request => {
      const card = this._createMemberCard(request, 'pending');
      container.appendChild(card);
    });
  }

  /**
   * Rend la section "Membres"
   * @param {HTMLElement} container
   * @param {Array} members - tableau de records community_members (status=approved, expand=user)
   */
  _renderMembersSection(container, members) {
    const title = createElement('div', { className: 'members-section-title' });
    title.innerHTML = `✅ Membres <span class="section-count">${members.length}</span>`;
    container.appendChild(title);

    if (members.length === 0) {
      container.appendChild(createElement('p', { className: 'members-empty-msg' }, 'Aucun membre pour le moment.'));
      return;
    }

    members.forEach(member => {
      const card = this._createMemberCard(member, 'member');
      container.appendChild(card);
    });
  }

  // ============================================================
  // CARTE UTILISATEUR
  // ============================================================

  /**
   * Crée une carte utilisateur avec avatar, info, badge rôle et actions.
   * @param {Object} record - record community_members avec expand.user
   * @param {'pending'|'member'} type - détermine quelles actions afficher
   * @returns {HTMLElement}
   */
  _createMemberCard(record, type) {
    // PocketBase retourne les données expand dans record.expand.user
    const user = record.expand?.user || {};
    const userName = user.name || user.email || 'Inconnu';
    const userEmail = user.email || '';
    const initials = userName.charAt(0).toUpperCase();

    // Carte
    const card = createElement('div', { className: 'member-card' });

    // Avatar (initiales)
    const avatar = createElement('div', {
      className: 'member-avatar'
    }, initials);

    // Info
    const info = createElement('div', { className: 'member-info' });
    const nameEl = createElement('div', { className: 'member-name' }, userName);
    const emailEl = createElement('div', { className: 'member-email' }, userEmail);
    info.appendChild(nameEl);
    info.appendChild(emailEl);

    // Badge rôle (seulement pour les membres approuvés)
    let badge = null;
    if (type === 'member') {
      badge = createElement('span', {
        className: `member-role-badge ${record.role}`
      }, record.role === 'owner' ? 'Owner' : 'Editor');
    }

    // Actions
    const actions = createElement('div', { className: 'member-actions' });

    if (type === 'pending') {
      // Approuver
      const approveBtn = createElement('button', {
        className: 'btn-member-action approve',
        onclick: () => this._handleApprove(record.id)
      }, '✅ Approuver');

      // Rejeter
      const rejectBtn = createElement('button', {
        className: 'btn-member-action reject',
        onclick: () => this._handleReject(record.id)
      }, '❌ Rejeter');

      actions.appendChild(approveBtn);
      actions.appendChild(rejectBtn);
    } else if (type === 'member' && record.role !== 'owner') {
      // Promouvoir en propriétaire
      const promoteBtn = createElement('button', {
        className: 'btn-member-action promote',
        onclick: () => this._handlePromote(record.id, userName)
      }, '⬆️ Promouvoir');

      // Retirer (pas pour l'owner lui-même)
      const removeBtn = createElement('button', {
        className: 'btn-member-action remove',
        onclick: () => this._handleRemove(record.id, userName)
      }, '🗑️ Retirer');

      actions.appendChild(promoteBtn);
      actions.appendChild(removeBtn);
    }

    // Assembler
    card.appendChild(avatar);
    card.appendChild(info);
    if (badge) card.appendChild(badge);
    card.appendChild(actions);

    return card;
  }

  // ============================================================
  // ACTIONS OWNER (approuver / rejeter / retirer)
  // ============================================================

  /**
   * Approuve une demande puis rafraîchit le panel
   */
  async _handleApprove(requestId) {
    const result = await membersService.approveRequest(requestId);
    if (result.success) {
      this.pendingCount--;
      this._updateOwnerBadge();
      // Rouvrir le panel pour rafraîchir les listes
      await this._openMembersPanel();
    }
  }

  /**
   * Rejette une demande puis rafraîchit le panel
   */
  async _handleReject(requestId) {
    const result = await membersService.rejectRequest(requestId);
    if (result.success) {
      this.pendingCount--;
      this._updateOwnerBadge();
      await this._openMembersPanel();
    }
  }

  /**
   * Retire un membre après confirmation
   */
  async _handleRemove(membershipId, userName) {
    if (!confirm(`Êtes-vous sûr de vouloir retirer ${userName} ?`)) return;

    const result = await membersService.removeMember(membershipId);
    if (result.success) {
      await this._openMembersPanel();
    }
  }

  /**
   * Promeut un éditeur en propriétaire après confirmation
   */
  async _handlePromote(membershipId, userName) {
    if (!confirm(`Promouvoir ${userName} en propriétaire de cette communauté ?`)) return;

    const result = await membersService.updateRole(membershipId, 'owner');
    if (result.success) {
      await this._openMembersPanel(); // rafraîchir la liste
    }
  }

  /**
   * Setup du logo pour navigation vers landing page
   */
  _setupLogoNavigation() {
    const logo = document.querySelector('.logo-link, .logo-text, .navbar-brand');
    if (logo) {
      logo.style.cursor = 'pointer';
      logo.onclick = (e) => {
        e.preventDefault();
        this._selectAllCommunities();
      };
    }
  }
}

export const communityUIManager = new CommunityUIManager();
