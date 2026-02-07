/**
 * Service de clustering pour les marqueurs
 * @module services/clustering
 */

class ClusteringService {
  constructor() {
    this.supercluster = null;
    this.clusters = [];
  }

  /**
   * Initialiser le clustering avec les édifices
   */
  initialize(edifices) {
    // Vérifier que Supercluster est chargé
    if (typeof Supercluster === 'undefined') {
      console.error('❌ Supercluster n\'est pas chargé');
      return false;
    }

    // Convertir les édifices en format GeoJSON pour Supercluster
    const points = edifices.map(edifice => ({
      type: 'Feature',
      properties: {
        id: edifice.id,
        edifice: edifice
      },
      geometry: {
        type: 'Point',
        coordinates: [
          parseFloat(edifice.lng || edifice.longitude),
          parseFloat(edifice.lat || edifice.latitude)
        ]
      }
    }));

    // Créer l'instance Supercluster
    this.supercluster = new Supercluster({
      radius: 30,        // Rayon de clustering (pixels)
      maxZoom: 16,       // Zoom max pour le clustering
      minPoints: 2       // Minimum 2 points pour créer un cluster
    });

    // Charger les points
    this.supercluster.load(points);
    console.log(`✅ Clustering initialisé avec ${edifices.length} édifices`);
    return true;
  }

  /**
   * Obtenir les clusters pour le niveau de zoom et la bbox actuels
   */
  getClusters(bbox, zoom) {
    if (!this.supercluster) {
      console.warn('⚠️ Supercluster pas initialisé');
      return [];
    }
    
    // bbox = [ouest, sud, est, nord]
    return this.supercluster.getClusters(bbox, Math.floor(zoom));
  }

  /**
   * Obtenir les édifices d'un cluster
   */
  getClusterEdifices(clusterId) {
    if (!this.supercluster) return [];
    
    const leaves = this.supercluster.getLeaves(clusterId, Infinity);
    return leaves.map(leaf => leaf.properties.edifice);
  }

  /**
   * Obtenir le zoom pour séparer un cluster
   */
  getClusterExpansionZoom(clusterId) {
    if (!this.supercluster) return 16;
    
    return this.supercluster.getClusterExpansionZoom(clusterId);
  }
}

export const clusteringService = new ClusteringService();
