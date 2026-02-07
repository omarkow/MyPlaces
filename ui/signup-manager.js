/**
 * Gestionnaire d'inscription de nouveaux utilisateurs
 * @module ui/signup-manager
 */

import { createElement, showNotification } from '../utils/dom.js';
import { apiService } from '../services/api-pocketbase.js';

class SignupManager {
  /**
   * Ouvrir la modal d'inscription
   */
  openSignupModal() {
    const modalHtml = `
      <div id="signup-modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; align-items: center; justify-content: center;">
        <div style="background: white; padding: 40px; border-radius: 12px; max-width: 450px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">
          <h2 style="margin: 0 0 10px 0; color: #333; font-size: 28px;">Créer un compte</h2>
          <p style="margin: 0 0 30px 0; color: #666; font-size: 14px;">Rejoignez My Places pour créer ou participer à des communautés</p>
          
          <form id="signup-form">
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">Nom complet *</label>
              <input 
                type="text" 
                id="signup-name" 
                required 
                placeholder="Ex: Julie Martin"
                style="width: 100%; padding: 12px; border: 2px solid #e5e5e5; border-radius: 8px; font-size: 14px; transition: border-color 0.3s;">
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">Email *</label>
              <input 
                type="email" 
                id="signup-email" 
                required 
                placeholder="votre.email@example.com"
                style="width: 100%; padding: 12px; border: 2px solid #e5e5e5; border-radius: 8px; font-size: 14px; transition: border-color 0.3s;">
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">Mot de passe *</label>
              <input 
                type="password" 
                id="signup-password" 
                required 
                placeholder="Minimum 8 caractères"
                minlength="8"
                style="width: 100%; padding: 12px; border: 2px solid #e5e5e5; border-radius: 8px; font-size: 14px; transition: border-color 0.3s;">
              <small style="color: #999; font-size: 12px; margin-top: 4px; display: block;">Minimum 8 caractères</small>
            </div>
            
            <div style="margin-bottom: 25px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">Confirmer le mot de passe *</label>
              <input 
                type="password" 
                id="signup-password-confirm" 
                required 
                placeholder="Retapez votre mot de passe"
                minlength="8"
                style="width: 100%; padding: 12px; border: 2px solid #e5e5e5; border-radius: 8px; font-size: 14px; transition: border-color 0.3s;">
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 30px;">
              <button 
                type="submit" 
                style="flex: 1; padding: 14px; background: #b8860b; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                Créer mon compte
              </button>
              <button 
                type="button" 
                id="cancel-signup" 
                style="flex: 0.4; padding: 14px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                Annuler
              </button>
            </div>
          </form>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              Vous avez déjà un compte ? 
              <a href="#" id="switch-to-login" style="color: #b8860b; font-weight: 600; text-decoration: none;">Se connecter</a>
            </p>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Styles au focus
    const inputs = document.querySelectorAll('#signup-modal input');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        input.style.borderColor = '#b8860b';
      });
      input.addEventListener('blur', () => {
        input.style.borderColor = '#e5e5e5';
      });
    });

    // Hover sur les boutons
    const submitBtn = document.querySelector('#signup-form button[type="submit"]');
    const cancelBtn = document.getElementById('cancel-signup');
    
    submitBtn.addEventListener('mouseenter', () => {
      submitBtn.style.background = '#9a6f09';
      submitBtn.style.transform = 'translateY(-2px)';
    });
    submitBtn.addEventListener('mouseleave', () => {
      submitBtn.style.background = '#b8860b';
      submitBtn.style.transform = 'translateY(0)';
    });

    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = '#e5e5e5';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = '#f5f5f5';
    });

    // Events
    document.getElementById('signup-form').onsubmit = (e) => this._handleSignup(e);
    document.getElementById('cancel-signup').onclick = () => this.closeSignupModal();
    document.getElementById('signup-modal').onclick = (e) => {
      if (e.target.id === 'signup-modal') this.closeSignupModal();
    };
    
    // Lien vers login
    document.getElementById('switch-to-login').onclick = (e) => {
      e.preventDefault();
      this.closeSignupModal();
      // Ouvrir la modal de connexion
      import('./manager.js').then(({ uiManager }) => {
        uiManager.openLoginModal();
      });
    };
  }

  /**
   * Gérer l'inscription
   */
  async _handleSignup(e) {
    e.preventDefault();

    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;

    // Validation
    if (!name || !email || !password) {
      showNotification('Veuillez remplir tous les champs', 'error');
      return;
    }

    if (password.length < 8) {
      showNotification('Le mot de passe doit contenir au moins 8 caractères', 'error');
      return;
    }

    if (password !== passwordConfirm) {
      showNotification('Les mots de passe ne correspondent pas', 'error');
      return;
    }

    try {
      // Créer l'utilisateur dans PocketBase
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);
      formData.append('passwordConfirm', passwordConfirm);
      formData.append('name', name);
      formData.append('role', 'user'); // Rôle par défaut

      const response = await fetch(`${apiService.baseURL}/api/collections/users/records`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de la création du compte');
      }

      const newUser = await response.json();

      showNotification('Compte créé avec succès ! Vous pouvez maintenant vous connecter.', 'success');
      
      // Fermer la modal après 1 seconde
      setTimeout(() => {
        this.closeSignupModal();
        
        // Ouvrir la modal de connexion
        import('./manager.js').then(({ uiManager }) => {
          uiManager.openLoginModal();
          // Pré-remplir l'email
          const emailInput = document.getElementById('email');
          if (emailInput) {
            emailInput.value = email;
          }
        });
      }, 1500);

    } catch (error) {
      console.error('Erreur inscription:', error);
      showNotification(error.message || 'Erreur lors de la création du compte', 'error');
    }
  }

  /**
   * Fermer la modal d'inscription
   */
  closeSignupModal() {
    const modal = document.getElementById('signup-modal');
    if (modal) modal.remove();
  }
}

export const signupManager = new SignupManager();
