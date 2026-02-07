/**
 * Gestionnaire de la page d'accueil (landing page)
 * @module ui/home-manager
 */

import { createElement, showNotification } from '../utils/dom.js';
import { communityService } from '../services/communities.js';
import { authService } from '../services/auth.js';
import { signupManager } from './signup-manager.js';

class HomeManager {
  constructor() {
    this.homeOverlay = null;
  }

  /**
   * Afficher la page d'accueil
   */
  async showHomePage() {
    // Charger les communautés
    await communityService.loadCommunities();
    const communities = communityService.getAllCommunities();

    // Créer l'overlay
    this.homeOverlay = createElement('div', {
      id: 'home-overlay',
      className: 'home-overlay'
    });

    // Conteneur principal
    const container = createElement('div', {
      className: 'home-container'
    });

    // En-tête
    const header = createElement('div', {
      className: 'home-header'
    });

    const logo = createElement('div', {
      className: 'home-logo'
    }, '🗺️');

    const title = createElement('h1', {
      className: 'home-title'
    }, 'My Places');

    const subtitle = createElement('p', {
      className: 'home-subtitle'
    }, 'Partagez et découvrez des lieux');

    header.appendChild(logo);
    header.appendChild(title);
    header.appendChild(subtitle);

    // Section communautés
    const communitiesSection = createElement('div', {
      className: 'home-communities-section'
    });

    const communitiesTitle = createElement('h2', {
      className: 'home-section-title'
    }, 'Choisissez une communauté');

    communitiesSection.appendChild(communitiesTitle);

    // Grille des communautés
    const grid = createElement('div', {
      className: 'home-communities-grid'
    });

    if (communities.length === 0) {
      const emptyMessage = createElement('p', {
        className: 'home-empty-message'
      }, 'Aucune communauté publique pour le moment. Connectez-vous pour en créer une !');
      grid.appendChild(emptyMessage);
    } else {
      communities.forEach(community => {
        const card = this._createCommunityCard(community);
        grid.appendChild(card);
      });
    }

    communitiesSection.appendChild(grid);

    // Section actions
    const actionsSection = createElement('div', {
      className: 'home-actions-section'
    });

    if (authService.isAuthenticated()) {
      // Bouton créer communauté (si connecté)
      const createBtn = createElement('button', {
        className: 'btn-create-community-home',
        onclick: () => this._openCreateModal()
      }, '➕ Créer ma communauté');
      actionsSection.appendChild(createBtn);
    } else {
      // Section inscription (si non connecté)
      const signupBox = createElement('div', {
        className: 'home-signup-box'
      });

      const signupTitle = createElement('h3', {
        style: 'margin: 0 0 10px 0; color: #333; font-size: 20px;'
      }, 'Rejoignez My Places');

      const signupText = createElement('p', {
        style: 'margin: 0 0 20px 0; color: #666; font-size: 14px;'
      }, 'Créez votre compte pour participer aux communautés ou créer la vôtre');

      const signupBtn = createElement('button', {
        className: 'btn-signup-home',
        onclick: () => signupManager.openSignupModal()
      }, 'Créer un compte gratuit');

      signupBox.appendChild(signupTitle);
      signupBox.appendChild(signupText);
      signupBox.appendChild(signupBtn);
      actionsSection.appendChild(signupBox);
    }

    communitiesSection.appendChild(actionsSection);

    // Footer
    const footer = createElement('div', {
      className: 'home-footer'
    });

    const footerText = createElement('p', {}, 
      'My Places - Cartographie collaborative du patrimoine'
    );

    footer.appendChild(footerText);

    // Assembler
    container.appendChild(header);
    container.appendChild(communitiesSection);
    container.appendChild(footer);
    this.homeOverlay.appendChild(container);

    // Ajouter au DOM
    document.body.appendChild(this.homeOverlay);

    // Animation d'entrée
    setTimeout(() => {
      this.homeOverlay.classList.add('visible');
    }, 50);
  }

  /**
   * Créer une carte de communauté
   */
  _createCommunityCard(community) {
    const card = createElement('div', {
      className: 'community-card',
      onclick: () => this._selectCommunity(community)
    });

    // Couleur de la communauté
    const colorBar = createElement('div', {
      className: 'community-card-color',
      style: `background: ${community.color}`
    });

    // Contenu
    const content = createElement('div', {
      className: 'community-card-content'
    });

    const name = createElement('h3', {
      className: 'community-card-name'
    }, community.name);

    const description = createElement('p', {
      className: 'community-card-description'
    }, community.description || 'Découvrez les lieux de cette communauté');

    // Icône
    const icon = createElement('div', {
      className: 'community-card-icon'
    }, '🏘️');

    content.appendChild(name);
    content.appendChild(description);

    card.appendChild(colorBar);
    card.appendChild(icon);
    card.appendChild(content);

    // Animation hover
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-5px)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
    });

    return card;
  }

  /**
   * Sélectionner une communauté
   */
  _selectCommunity(community) {
    // Naviguer vers l'URL de la communauté
    window.location.href = `/${community.slug}`;
  }

  /**
   * Ouvrir la modal de création
   */
  _openCreateModal() {
    // Importer dynamiquement le community-manager
    import('./community-manager.js').then(({ communityUIManager }) => {
      // Fermer la page d'accueil temporairement
      this.hideHomePage();
      
      // Ouvrir la modal de création
      communityUIManager._openCreateModal();
    });
  }

  /**
   * Masquer la page d'accueil
   */
  hideHomePage() {
    if (this.homeOverlay) {
      this.homeOverlay.classList.remove('visible');
      setTimeout(() => {
        this.homeOverlay.remove();
        this.homeOverlay = null;
      }, 300);
    }
  }

  /**
   * Vérifier si on est sur la page d'accueil
   */
  isHomePage() {
    const path = window.location.pathname;
    return path === '/' || path === '';
  }
}

export const homeManager = new HomeManager();
