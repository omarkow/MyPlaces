/**
 * Service de gestion des appels API Supabase
 * @module services/api
 */

import { CONFIG } from '../config.js';
import { showNotification, getFileNameFromUrl } from '../utils/dom.js';

/**
 * Classe de gestion de l'API Supabase
 */
export class SupabaseService {
  constructor() {
    this.client = supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.key);
  }

  /**
   * Récupère la session utilisateur actuelle
   * @returns {Promise<Object|null>}
   */
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await this.client.auth.getSession();
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Erreur lors de la récupération de la session:', error);
      return null;
    }
  }

  /**
   * Récupère le rôle d'un utilisateur
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async getUserRole(userId) {
    try {
      const { data, error } = await this.client
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data?.role || CONFIG.roles.USER;
    } catch (error) {
      console.error('Erreur lors de la récupération du rôle:', error);
      return CONFIG.roles.USER;
    }
  }

  /**
   * Connexion utilisateur
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async signIn(email, password) {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      showNotification('Connexion réussie !', 'success');
      return { success: true, data };
    } catch (error) {
      console.error('Erreur de connexion:', error);
      showNotification(error.message, 'error');
      return { success: false, error };
    }
  }

  /**
   * Déconnexion utilisateur
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
      showNotification('Déconnexion réussie', 'success');
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
      showNotification('Erreur lors de la déconnexion', 'error');
    }
  }

  /**
   * Récupère tous les édifices
   * @returns {Promise<Array>}
   */
  async getEdifices() {
    try {
      const { data, error } = await this.client
        .from('edifices')
        .select('*')
        .order('nom', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erreur lors du chargement des édifices:', error);
      showNotification('Erreur lors du chargement des données', 'error');
      return [];
    }
  }

  /**
   * Récupère un édifice par son ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async getEdificeById(id) {
    try {
      const { data, error } = await this.client
        .from('edifices')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur lors du chargement de l\'édifice:', error);
      return null;
    }
  }

  /**
   * Crée un nouvel édifice
   * @param {Object} edificeData
   * @returns {Promise<Object>}
   */
  async createEdifice(edificeData) {
    try {
      const { data, error } = await this.client
        .from('edifices')
        .insert([edificeData])
        .select()
        .single();

      if (error) throw error;
      
      showNotification('Édifice créé avec succès !', 'success');
      return { success: true, data };
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      showNotification('Erreur lors de la création de l\'édifice', 'error');
      return { success: false, error };
    }
  }

  /**
   * Met à jour un édifice
   * @param {number} id
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateEdifice(id, updates) {
    try {
      const { data, error } = await this.client
        .from('edifices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      showNotification('Édifice mis à jour !', 'success');
      return { success: true, data };
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      showNotification('Erreur lors de la mise à jour', 'error');
      return { success: false, error };
    }
  }

  /**
   * Supprime un édifice
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async deleteEdifice(id) {
    try {
      const { error } = await this.client
        .from('edifices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      showNotification('Édifice supprimé', 'success');
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showNotification('Erreur lors de la suppression', 'error');
      return { success: false, error };
    }
  }

  /**
   * Upload une image dans le storage
   * @param {File} file
   * @param {string} fileName
   * @returns {Promise<string|null>}
   */
  async uploadImage(file, fileName) {
    try {
      // Compression de l'image si nécessaire
      const compressedFile = await this._compressImage(file);
      
      const { data, error } = await this.client.storage
        .from(CONFIG.supabase.storage.bucket)
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Récupérer l'URL publique
      const { data: { publicUrl } } = this.client.storage
        .from(CONFIG.supabase.storage.bucket)
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      showNotification('Erreur lors de l\'upload de l\'image', 'error');
      return null;
    }
  }

  /**
   * Supprime une image du storage
   * @param {string} imageUrl
   * @returns {Promise<boolean>}
   */
  async deleteImage(imageUrl) {
    try {
      const fileName = getFileNameFromUrl(imageUrl);
      
      const { error } = await this.client.storage
        .from(CONFIG.supabase.storage.bucket)
        .remove([fileName]);

      if (error) throw error;
      
      console.log(`✅ Image supprimée: ${fileName}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur suppression storage:', error);
      return false;
    }
  }

  /**
   * Compresse une image avant upload
   * @private
   * @param {File} file
   * @returns {Promise<File>}
   */
  async _compressImage(file) {
    // Vérifier si browser-image-compression est disponible
    if (typeof imageCompression === 'undefined') {
      console.warn('Image compression non disponible');
      return file;
    }

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      };
      
      return await imageCompression(file, options);
    } catch (error) {
      console.error('Erreur lors de la compression:', error);
      return file;
    }
  }

  /**
   * Écoute les changements en temps réel sur la table edifices
   * @param {Function} callback
   * @returns {Object} Subscription
   */
  subscribeToEdifices(callback) {
    return this.client
      .channel('edifices-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'edifices' },
        callback
      )
      .subscribe();
  }
}

// Instance singleton
export const apiService = new SupabaseService();
