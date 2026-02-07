import { CONFIG } from '../config.js';

class PocketBaseAPIService {
  constructor() {
    this.baseURL = CONFIG.pocketbase?.url || 'http://127.0.0.1:8090';
    this.token = null;
    this.currentUser = null;
    this.loadAuth(); // ← AJOUTER CETTE LIGNE
  }

  /**
   * Load auth from localStorage
   */
  loadAuth() {
    const token = localStorage.getItem('pb_token');
    const user = localStorage.getItem('pb_user');
    
    if (token && user) {
      this.token = token;
      this.currentUser = JSON.parse(user);
      return true;
    }
    return false;
  }

  /**
   * Save auth to localStorage
   */
  saveAuth() {
    if (this.token && this.currentUser) {
      localStorage.setItem('pb_token', this.token);
      localStorage.setItem('pb_user', JSON.stringify(this.currentUser));
    }
  }

  setAuth(token, user) {
    this.token = token;
    this.currentUser = user;
    this.saveAuth(); // ← AJOUTER CETTE LIGNE
  }

  clearAuth() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('pb_token'); // ← AJOUTER
    localStorage.removeItem('pb_user');  // ← AJOUTER
  }

  /**
   * Sign in with email/password
   */
  async signIn(email, password) {
    try {
      const data = await fetch(this.baseURL + '/api/collections/users/auth-with-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password: password })
      });

      if (!data.ok) {
        const error = await data.json();
        throw new Error(error.message || 'Authentification échouée');
      }

      const result = await data.json();
      
      // Stocker le token et l'user
      this.setAuth(result.token, result.record);
      
      return {
        user: result.record,
        session: { access_token: result.token }
      };
    } catch (error) {
      return { error: { message: error.message } };
    }
  }

  /**
   * Sign out
   */
  async signOut() {
    this.clearAuth();
    return { error: null };
  }

  /**
   * Get user role
   */
  async getUserRole(userId) {
    // Dans PocketBase, le role est directement dans user.role
    if (this.currentUser && this.currentUser.role) {
      return { data: { role: this.currentUser.role }, error: null };
    }
    return { data: null, error: null };
  }
  

  async getCurrentSession() {
    if (this.token && this.currentUser) {
      return { user: this.currentUser };
    }
    return null;
  }

  async request(endpoint, options = {}) {
    const headers = { ...options.headers };
    if (this.token) {
      headers['Authorization'] = this.token;
    }
    const url = this.baseURL + '/api/' + endpoint;
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'HTTP ' + response.status);
    }
    return await response.json();
  }

  async getEdifices() {
    const data = await this.request('collections/edifices/records?perPage=500&expand=community');
    return data.items.map(item => ({
      id: item.id,
      nom: item.nom,
      ville: item.ville,
      adresse: item.adresse,
      description: item.description,
      lng: item.lng,
      lat: item.lat,
      categorie: item.categorie,
      images: item.images ? item.images.map(img => 
        this.baseURL + '/api/files/' + item.collectionId + '/' + item.id + '/' + img
      ) : [],
      community: item.expand?.community,
      created: item.created
    }));
  }

  async createEdifice(edificeData) {
    const formData = new FormData();
    Object.entries(edificeData).forEach(([key, value]) => {
      if (key !== 'images' && value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });
    if (edificeData.images && edificeData.images.length > 0) {
      edificeData.images.forEach(file => {
        formData.append('images', file);
      });
    }
    const response = await fetch(this.baseURL + '/api/collections/edifices/records', {
      method: 'POST',
      headers: { 'Authorization': this.token },
      body: formData
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create');
    }
    return { success: true, data: await response.json() };
  }

  async updateEdifice(id, edificeData) {
    const formData = new FormData();
    Object.entries(edificeData).forEach(([key, value]) => {
      if (key !== 'images' && key !== 'newImages' && value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });
    if (edificeData.newImages && edificeData.newImages.length > 0) {
      edificeData.newImages.forEach(file => {
        formData.append('images', file);
      });
    }
    const response = await fetch(this.baseURL + '/api/collections/edifices/records/' + id, {
      method: 'PATCH',
      headers: { 'Authorization': this.token },
      body: formData
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update');
    }
    return { success: true, data: await response.json() };
  }

  async deleteEdifice(id) {
    await this.request('collections/edifices/records/' + id, { method: 'DELETE' });
    return { success: true };
  }

  /**
   * Vérifie si l'utilisateur actuel est membre (propriétaire ou éditeur) d'une communauté
   * @param {string} communityId - ID de la communauté
   * @returns {Promise<boolean>}
   */
  async isUserMemberOfCommunity(communityId) {
    if (!this.currentUser || !communityId) {
      return false;
    }

    try {
      // Requête pour vérifier si l'utilisateur est dans la table community_members
      // avec le rôle 'owner' ou 'editor'
      const filter = `community="${communityId}" && user="${this.currentUser.id}" && (role="owner" || role="editor")`;
      const data = await this.request(`collections/community_members/records?filter=${encodeURIComponent(filter)}`);
      
      return data.items && data.items.length > 0;
    } catch (error) {
      console.error('Erreur lors de la vérification du membership:', error);
      return false;
    }
  }

  subscribeToEdifices(callback) {
    console.log('Info: Realtime non disponible');
    return function() {};
  }
}

export const apiService = new PocketBaseAPIService();