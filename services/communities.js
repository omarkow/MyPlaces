/**
 * Service de gestion des communautés
 * @module services/communities
 */

import { CONFIG } from '../config.js';
import { apiService } from './api-pocketbase.js';

class CommunityService {
  constructor() {
    this.currentCommunity = null;
    this.allCommunities = [];
    this.listeners = [];
  }

  /**
   * Charger toutes les communautés publiques (non supprimées)
   */
  async loadCommunities() {
    try {
      // Filter: public=true ET (deleted=false OU deleted n'existe pas)
      const filter = encodeURIComponent('public=true && (deleted=false || deleted=null)');
      const data = await apiService.request(`collections/communities/records?filter=${filter}&sort=name`);
      this.allCommunities = data.items;
      console.log(`✅ ${this.allCommunities.length} communautés chargées`);
      return this.allCommunities;
    } catch (error) {
      console.error('Erreur chargement communautés:', error);
      return [];
    }
  }

  /**
   * Définir la communauté active
   */
  setCurrentCommunity(communityId) {
    const community = this.allCommunities.find(c => c.id === communityId);
    if (community) {
      this.currentCommunity = community;
      this._updateURL(community.slug);
      this._notifyListeners();
      console.log('🏘️ Communauté active:', community.name);
    }
  }

  /**
   * Définir la communauté active par slug
   */
  setCurrentCommunityBySlug(slug) {
    const community = this.allCommunities.find(c => c.slug === slug);
    if (community) {
      this.currentCommunity = community;
      this._notifyListeners();
      console.log('🏘️ Communauté active (via slug):', community.name);
      return true;
    }
    return false;
  }

  /**
   * Obtenir le slug depuis l'URL
   */
  getSlugFromURL() {
    const path = window.location.pathname;
    // Enlever le / initial et les / finaux
    const slug = path.replace(/^\/+|\/+$/g, '');
    return slug || null;
  }

  /**
   * Initialiser depuis l'URL
   */
  async initializeFromURL() {
    const slug = this.getSlugFromURL();
    
    if (slug) {
      // Charger les communautés si pas encore fait
      if (this.allCommunities.length === 0) {
        await this.loadCommunities();
      }
      
      // Chercher la communauté par slug
      const found = this.setCurrentCommunityBySlug(slug);
      
      if (!found) {
        console.warn(`⚠️ Communauté "${slug}" non trouvée`);
        // Rediriger vers la page d'accueil
        this._updateURL('');
        return false;
      }
      
      return true;
    }
    
    // Pas de slug = afficher toutes les communautés
    this.currentCommunity = null;
    return true;
  }

  /**
   * Mettre à jour l'URL sans recharger la page
   */
  _updateURL(slug) {
    const newPath = slug ? `/${slug}` : '/';
    if (window.location.pathname !== newPath) {
      window.history.pushState({ slug }, '', newPath);
    }
  }

  /**
   * Obtenir la communauté active
   */
  getCurrentCommunity() {
    return this.currentCommunity;
  }

  /**
   * Obtenir toutes les communautés
   */
  getAllCommunities() {
    return this.allCommunities;
  }

  /**
   * Créer une nouvelle communauté
   */
  async createCommunity(data) {
    try {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('slug', data.slug || this._slugify(data.name));
      formData.append('description', data.description || '');
      formData.append('color', data.color || '#b8860b');
      formData.append('public', 'true');
      formData.append('owner', apiService.currentUser.id);

      const response = await fetch(`${apiService.baseURL}/api/collections/communities/records`, {
        method: 'POST',
        headers: { 'Authorization': apiService.token },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur création communauté');
      }

      const newCommunity = await response.json();
      this.allCommunities.push(newCommunity);
      
      // Ajouter automatiquement le créateur comme propriétaire dans community_members
      const { membersService } = await import('./members.js');
      await membersService.addOwner(newCommunity.id, apiService.currentUser.id);
      
      console.log('✅ Communauté créée:', newCommunity.name);
      return { success: true, data: newCommunity };
    } catch (error) {
      console.error('Erreur création communauté:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mettre à jour une communauté existante
   */
  async updateCommunity(communityId, data) {
    try {
      const formData = new FormData();
      if (data.name !== undefined)        formData.append('name', data.name);
      if (data.description !== undefined) formData.append('description', data.description);
      if (data.color !== undefined)       formData.append('color', data.color);

      const response = await fetch(`${apiService.baseURL}/api/collections/communities/records/${communityId}`, {
        method: 'PATCH',
        headers: { 'Authorization': apiService.token },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur mise à jour communauté');
      }

      const updated = await response.json();

      // Mettre à jour le cache local
      const idx = this.allCommunities.findIndex(c => c.id === communityId);
      if (idx !== -1) this.allCommunities[idx] = updated;
      if (this.currentCommunity?.id === communityId) this.currentCommunity = updated;

      console.log('✅ Communauté mise à jour:', updated.name);
      return { success: true, data: updated };
    } catch (error) {
      console.error('Erreur mise à jour communauté:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Supprimer une communauté (soft delete - owner uniquement)
   * Marque la communauté comme supprimée sans effacer les données
   */
  async deleteCommunity(communityId) {
    try {
      const formData = new FormData();
      formData.append('deleted', 'true');

      const response = await fetch(`${apiService.baseURL}/api/collections/communities/records/${communityId}`, {
        method: 'PATCH',
        headers: { 'Authorization': apiService.token },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Erreur suppression communauté');
      }

      // Retirer du cache local
      this.allCommunities = this.allCommunities.filter(c => c.id !== communityId);
      if (this.currentCommunity?.id === communityId) {
        this.currentCommunity = null;
      }

      console.log('✅ Communauté marquée comme supprimée');
      return { success: true };
    } catch (error) {
      console.error('Erreur suppression communauté:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convertir un nom en slug
   */
  _slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Retirer accents
      .replace(/[^a-z0-9]+/g, '-')     // Remplacer espaces par -
      .replace(/^-+|-+$/g, '');        // Retirer - au début/fin
  }

  /**
   * Écouter les changements de communauté
   */
  onCommunityChange(callback) {
    this.listeners.push(callback);
  }

  /**
   * Notifier les listeners
   */
  _notifyListeners() {
    this.listeners.forEach(cb => cb(this.currentCommunity));
  }

  /**
   * Configurer l'écoute du bouton back/forward du navigateur
   */
  setupHistoryListener() {
    window.addEventListener('popstate', async (event) => {
      console.log('🔙 Navigation navigateur détectée');
      const slug = this.getSlugFromURL();
      
      if (slug) {
        this.setCurrentCommunityBySlug(slug);
      } else {
        this.currentCommunity = null;
        this._notifyListeners();
      }
    });
  }
}

export const communityService = new CommunityService();
