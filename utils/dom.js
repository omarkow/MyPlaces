/**
 * Utilitaires pour la manipulation DOM et helpers
 * @module utils/dom
 */

/**
 * Sélecteurs DOM centralisés
 */
export const DOM = {
  // Navigation
  navbar: () => document.querySelector('.navbar'),
  loginBtn: () => document.querySelector('.btn-login'),
  
  // Carte
  mapContainer: () => document.getElementById('map-container'),
  zoomInBtn: () => document.getElementById('zoom-in-btn'),
  zoomOutBtn: () => document.getElementById('zoom-out-btn'),
  
  // Panneau latéral
  sidePanel: () => document.getElementById('side-panel'),
  closePanel: () => document.getElementById('close-panel'),
  panelTitle: () => document.getElementById('panel-title'),
  panelCity: () => document.getElementById('panel-city'),
  panelImageContainer: () => document.getElementById('panel-image-container'),
  panelDescription: () => document.getElementById('panel-description'),
  panelContent: () => document.getElementById('panel-content'),
  adminControls: () => document.getElementById('admin-controls'),
  
  // Lightbox
  lightbox: () => document.getElementById('lightbox'),
  lightboxImg: () => document.getElementById('lightbox-img'),
  lightboxClose: () => document.getElementById('lightbox-close'),
  prevBtn: () => document.getElementById('prev-btn'),
  nextBtn: () => document.getElementById('next-btn'),
  
  // Modal de connexion
  loginModal: () => document.getElementById('login-modal'),
  closeLogin: () => document.getElementById('close-login'),
  loginForm: () => document.getElementById('login-form'),
  emailInput: () => document.getElementById('email'),
  passwordInput: () => document.getElementById('password'),
  
  // Admin
  adminAddButton: () => document.getElementById('admin-add-button'),
  adminOnlySection: () => document.getElementById('admin-only-section'),
  
  // Filtres
  btnFiltersToggle: () => document.getElementById('btn-filters-toggle'),
  categoryFilters: () => document.getElementById('category-filters'),
  btnCloseFilters: () => document.getElementById('btn-close-filters'),
  btnToggleAll: () => document.getElementById('btn-toggle-all'),
  catFilters: () => document.querySelectorAll('.cat-filter')
};

/**
 * Crée un élément avec des attributs et des enfants
 * @param {string} tag - Tag HTML
 * @param {Object} attrs - Attributs de l'élément
 * @param {Array|string} children - Enfants ou contenu texte
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.substring(2).toLowerCase(), value);
    } else {
      element.setAttribute(key, value);
    }
  });
  
  if (typeof children === 'string') {
    element.textContent = children;
  } else if (Array.isArray(children)) {
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof HTMLElement) {
        element.appendChild(child);
      }
    });
  }
  
  return element;
}

/**
 * Affiche/cache un élément avec animation
 * @param {HTMLElement} element
 * @param {boolean} show
 * @param {number} duration
 */
export function toggleElement(element, show, duration = 300) {
  if (!element) return;
  
  if (show) {
    element.style.display = 'block';
    element.style.visibility = 'visible';
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
    setTimeout(() => {
      element.style.display = 'none';
      element.style.visibility = 'hidden';
    }, duration);
  }
}

/**
 * Debounce une fonction
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle une fonction
 * @param {Function} func
 * @param {number} limit
 * @returns {Function}
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Affiche un message d'erreur
 * @param {string} message
 * @param {string} type - 'error' | 'success' | 'info'
 */
export function showNotification(message, type = 'info') {
  // Créer une notification toast
  const notification = createElement('div', {
    className: `notification notification--${type}`,
    style: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '15px 20px',
      background: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
      color: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: '9999',
      animation: 'slideIn 0.3s ease'
    }
  }, message);
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Valide une URL
 * @param {string} url
 * @returns {boolean}
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formate une date
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDate(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(date));
}

/**
 * Nettoie le HTML pour éviter les XSS
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Extrait le nom de fichier d'une URL
 * @param {string} url
 * @returns {string}
 */
export function getFileNameFromUrl(url) {
  const urlParts = url.split('/');
  return urlParts[urlParts.length - 1];
}
