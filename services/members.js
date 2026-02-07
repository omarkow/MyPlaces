/**
 * Service de gestion des membres de communautés
 * @module services/members
 */

import { apiService } from './api-pocketbase.js';
import { showNotification } from '../utils/dom.js';

class MembersService {
  constructor() {
    this.currentUserMemberships = [];
  }

  /**
   * Charger les adhésions de l'utilisateur actuel
   */
  async loadUserMemberships() {
    if (!apiService.currentUser) return [];

    try {
      const filter = `user="${apiService.currentUser.id}" && status="approved"`;
      const data = await apiService.request(
        `collections/community_members/records?filter=${encodeURIComponent(filter)}&expand=community`
      );
      
      this.currentUserMemberships = data.items;
      console.log(`✅ ${this.currentUserMemberships.length} adhésions chargées`);
      return this.currentUserMemberships;
    } catch (error) {
      console.error('Erreur chargement adhésions:', error);
      return [];
    }
  }

  /**
   * Vérifier si l'utilisateur est membre d'une communauté
   */
  async isMemberOf(communityId) {
    if (!apiService.currentUser) return false;

    try {
      const filter = `user="${apiService.currentUser.id}" && community="${communityId}" && status="approved"`;
      const data = await apiService.request(
        `collections/community_members/records?filter=${encodeURIComponent(filter)}`
      );
      
      return data.items.length > 0;
    } catch (error) {
      console.error('Erreur vérification membre:', error);
      return false;
    }
  }

  /**
   * Vérifier si l'utilisateur est propriétaire d'une communauté
   */
  async isOwnerOf(communityId) {
    if (!apiService.currentUser) return false;

    try {
      const filter = `user="${apiService.currentUser.id}" && community="${communityId}" && role="owner"`;
      const data = await apiService.request(
        `collections/community_members/records?filter=${encodeURIComponent(filter)}`
      );
      
      return data.items.length > 0;
    } catch (error) {
      console.error('Erreur vérification propriétaire:', error);
      return false;
    }
  }

  /**
   * Vérifier si l'utilisateur est éditeur (ou owner) d'une communauté
   */
  async isEditorOrOwnerOf(communityId) {
    if (!apiService.currentUser) return false;

    try {
      const filter = `user="${apiService.currentUser.id}" && community="${communityId}" && status="approved" && (role="editor" || role="owner")`;
      const data = await apiService.request(
        `collections/community_members/records?filter=${encodeURIComponent(filter)}`
      );
      
      return data.items.length > 0;
    } catch (error) {
      console.error('Erreur vérification éditeur:', error);
      return false;
    }
  }

  /**
   * Demander à rejoindre une communauté
   */
  async requestJoin(communityId) {
    if (!apiService.currentUser) {
      showNotification('Vous devez être connecté', 'error');
      return { success: false };
    }

    try {
      // Vérifier si une demande existe déjà
      const filter = `user="${apiService.currentUser.id}" && community="${communityId}"`;
      const existing = await apiService.request(
        `collections/community_members/records?filter=${encodeURIComponent(filter)}`
      );

      if (existing.items.length > 0) {
        const status = existing.items[0].status;
        if (status === 'pending') {
          showNotification('Votre demande est en attente', 'info');
        } else if (status === 'approved') {
          showNotification('Vous êtes déjà membre', 'info');
        } else {
          showNotification('Votre demande a été rejetée', 'error');
        }
        return { success: false };
      }

      // Créer la demande
      const formData = new FormData();
      formData.append('user', apiService.currentUser.id);
      formData.append('community', communityId);
      formData.append('status', 'pending');
      formData.append('role', 'editor');

      const response = await fetch(
        `${apiService.baseURL}/api/collections/community_members/records`,
        {
          method: 'POST',
          headers: { 'Authorization': apiService.token },
          body: formData
        }
      );

      if (!response.ok) throw new Error('Erreur lors de la demande');

      showNotification('Demande envoyée au propriétaire !', 'success');
      return { success: true };
    } catch (error) {
      console.error('Erreur demande adhésion:', error);
      showNotification('Erreur lors de la demande', 'error');
      return { success: false };
    }
  }

  /**
   * Obtenir les demandes en attente pour une communauté (propriétaire)
   */
  async getPendingRequests(communityId) {
    try {
      const filter = `community="${communityId}" && status="pending"`;
      const data = await apiService.request(
        `collections/community_members/records?filter=${encodeURIComponent(filter)}&expand=user&sort=-requested_at`
      );
      
      return data.items;
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
      return [];
    }
  }

  /**
   * Obtenir les membres d'une communauté
   */
  async getMembers(communityId) {
    try {
      const filter = `community="${communityId}" && status="approved"`;
      const data = await apiService.request(
        `collections/community_members/records?filter=${encodeURIComponent(filter)}&expand=user&sort=role,created`
      );
      
      return data.items;
    } catch (error) {
      console.error('Erreur chargement membres:', error);
      return [];
    }
  }

  /**
   * Approuver une demande (propriétaire)
   */
  async approveRequest(requestId) {
    try {
      const formData = new FormData();
      formData.append('status', 'approved');

      const response = await fetch(
        `${apiService.baseURL}/api/collections/community_members/records/${requestId}`,
        {
          method: 'PATCH',
          headers: { 'Authorization': apiService.token },
          body: formData
        }
      );

      if (!response.ok) throw new Error('Erreur approbation');

      showNotification('Membre approuvé !', 'success');
      return { success: true };
    } catch (error) {
      console.error('Erreur approbation:', error);
      showNotification('Erreur lors de l\'approbation', 'error');
      return { success: false };
    }
  }

  /**
   * Rejeter une demande (propriétaire)
   */
  async rejectRequest(requestId) {
    try {
      const formData = new FormData();
      formData.append('status', 'rejected');

      const response = await fetch(
        `${apiService.baseURL}/api/collections/community_members/records/${requestId}`,
        {
          method: 'PATCH',
          headers: { 'Authorization': apiService.token },
          body: formData
        }
      );

      if (!response.ok) throw new Error('Erreur rejet');

      showNotification('Demande rejetée', 'info');
      return { success: true };
    } catch (error) {
      console.error('Erreur rejet:', error);
      showNotification('Erreur lors du rejet', 'error');
      return { success: false };
    }
  }

  /**
   * Retirer un membre (propriétaire)
   */
  async removeMember(membershipId) {
    try {
      const response = await fetch(
        `${apiService.baseURL}/api/collections/community_members/records/${membershipId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': apiService.token }
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        console.error('removeMember HTTP', response.status, errBody);
        throw new Error(errBody.message || 'Erreur suppression');
      }

      showNotification('Membre retiré', 'success');
      return { success: true };
    } catch (error) {
      console.error('Erreur retrait membre:', error);
      showNotification('Erreur lors du retrait', 'error');
      return { success: false };
    }
  }

  /**
   * Retourne le statut de l'utilisateur actuel dans une communauté.
   * @param {string} communityId
   * @returns {Promise<'pending'|'approved'|'rejected'|null>}
   *   null = aucun record (jamais membre, ni en attente)
   */
  async getMembershipStatus(communityId) {
    if (!apiService.currentUser) return null;

    try {
      const filter = `user="${apiService.currentUser.id}" && community="${communityId}"`;
      const data = await apiService.request(
        `collections/community_members/records?filter=${encodeURIComponent(filter)}`
      );
      return data.items.length > 0 ? data.items[0].status : null;
    } catch (error) {
      console.error('Erreur getMembershipStatus:', error);
      return null;
    }
  }

  /**
   * Changer le rôle d'un membre (ex: editor → owner).
   * @param {string} membershipId - ID du record community_members
   * @param {string} newRole      - 'owner' | 'editor'
   * @returns {Promise<{success: boolean}>}
   */
  async updateRole(membershipId, newRole) {
    try {
      const formData = new FormData();
      formData.append('role', newRole);

      const response = await fetch(
        `${apiService.baseURL}/api/collections/community_members/records/${membershipId}`,
        {
          method: 'PATCH',
          headers: { 'Authorization': apiService.token },
          body: formData
        }
      );

      if (!response.ok) throw new Error('Erreur mise à jour rôle');

      showNotification(
        newRole === 'owner' ? 'Membre promu propriétaire ✓' : 'Rôle mis à jour ✓',
        'success'
      );
      return { success: true };
    } catch (error) {
      console.error('Erreur updateRole:', error);
      showNotification('Erreur lors de la mise à jour du rôle', 'error');
      return { success: false };
    }
  }

  /**
   * Ajouter automatiquement le créateur comme propriétaire
   */
  async addOwner(communityId, userId) {
    try {
      const formData = new FormData();
      formData.append('user', userId);
      formData.append('community', communityId);
      formData.append('status', 'approved');
      formData.append('role', 'owner');

      const response = await fetch(
        `${apiService.baseURL}/api/collections/community_members/records`,
        {
          method: 'POST',
          headers: { 'Authorization': apiService.token },
          body: formData
        }
      );

      if (!response.ok) throw new Error('Erreur ajout propriétaire');

      console.log('✅ Propriétaire ajouté');
      return { success: true };
    } catch (error) {
      console.error('Erreur ajout propriétaire:', error);
      return { success: false };
    }
  }
}

export const membersService = new MembersService();
