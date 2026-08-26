/**
 * Mapping centralisé des images Unsplash par catégorie.
 * URLs fixes pour cohérence visuelle entre captures et rechargements.
 */

type ImageCategory = 'formation' | 'produit-patisserie' | 'produit-boulangerie' | 'salle' | 'logement' | 'default';

const UNSPLASH_IMAGES: Record<ImageCategory, string> = {
  formation: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80', // Workshop
  'produit-patisserie': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80', // Pastry
  'produit-boulangerie': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80', // Bread
  salle: 'https://images.unsplash.com/photo-1519671482677-8a6637dd68f1?w=400&q=80', // Conference room
  logement: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&q=80', // Bedroom
  default: 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=400&q=80', // Workspace
};

export function getImageUrl(category: ImageCategory | string): string {
  const cat = category.toLowerCase() as ImageCategory;
  return UNSPLASH_IMAGES[cat] || UNSPLASH_IMAGES.default;
}

export function getProductImage(nom: string): string {
  if (nom.toLowerCase().includes('pain') || nom.toLowerCase().includes('boulangerie')) {
    return getImageUrl('produit-boulangerie');
  }
  if (nom.toLowerCase().includes('gâteau') || nom.toLowerCase().includes('éclair') || nom.toLowerCase().includes('mille')) {
    return getImageUrl('produit-patisserie');
  }
  return getImageUrl('produit-patisserie');
}
