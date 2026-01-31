/**
 * Service de gestion de l'authentification
 * @module services/auth
 */

import { CONFIG } from '../config.js';
import { apiService } from './api.js';

/**
 * Classe de gestion de l'authentification
 */
export class AuthService {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
  }

  /**
   * Initialise la session utilisateur
   * @returns {Promise<Object|null>}
   */
  async initialize() {
    try {
      const session = await apiService.getCurrentSession();
      
      if (session) {
        this.currentUser = session.user;
        
        // Récupérer le rôle
        const role = await apiService.getUserRole(this.currentUser.id);
        this.currentUser.role = role;
        
        console.log('✅ Utilisateur connecté:', this.currentUser.email, 'Rôle:', role);
      } else {
        this.currentUser = null;
        console.log('ℹ️ Aucun utilisateur connecté');
      }
      
      this._notifyListeners();
      return this.currentUser;
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de l\'auth:', error);
      return null;
    }
  }

  /**
   * Connecte un utilisateur
   * @param {string} email
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  async signIn(email, password) {
    const result = await apiService.signIn(email, password);
    
    if (result.success) {
      await this.initialize();
      return true;
    }
    
    return false;
  }

  /**
   * Déconnecte l'utilisateur
   * @returns {Promise<void>}
   */
  async signOut() {
    await apiService.signOut();
    this.currentUser = null;
    this._notifyListeners();
  }

  /**
   * Vérifie si l'utilisateur est connecté
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * Vérifie si l'utilisateur est admin
   * @returns {boolean}
   */
  isAdmin() {
    return this.currentUser?.role === CONFIG.roles.ADMIN;
  }

  /**
   * Vérifie si l'utilisateur a un rôle spécifique
   * @param {string} role
   * @returns {boolean}
   */
  hasRole(role) {
    return this.currentUser?.role === role;
  }

  /**
   * Obtient l'utilisateur actuel
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Enregistre un écouteur pour les changements d'authentification
   * @param {Function} callback
   */
  onAuthStateChange(callback) {
    this.listeners.push(callback);
  }

  /**
   * Notifie tous les écouteurs
   * @private
   */
  _notifyListeners() {
    this.listeners.forEach(callback => callback(this.currentUser));
  }

  /**
   * Vérifie si un email est autorisé (logique temporaire)
   * @param {string} email
   * @returns {boolean}
   */
  isAuthorizedEmail(email) {
    // Cette logique devrait être côté serveur
    return email === 'admin@test.com';
  }
}

// Instance singleton
export const authService = new AuthService();
