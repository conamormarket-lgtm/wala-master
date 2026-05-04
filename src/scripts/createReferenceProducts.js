/**
 * Script para crear productos de referencia
 * 
 * Este script crea 5 productos de referencia con sus categorías, descripciones,
 * imágenes placeholder, variantes y configuración de personalización.
 * 
 * Uso:
 * 1. Desde la consola del navegador en el admin panel:
 *    import('./scripts/createReferenceProducts.js').then(m => m.createReferenceProducts())
 * 
 * 2. O desde un componente React:
 *    import { createReferenceProducts } from './createReferenceProducts';
 */

import { getCategories, createCategory } from '../services/categories';
import { createProduct } from '../services/products';

/**
 * Datos de los productos de referencia
 */
const referenceProducts = [
  {
    name: 'Poleras',
    price: 45.00,
    description: 'Polera de algodón 100% premium, perfecta para personalizar con tus diseños únicos. Material suave y duradero, ideal para estampados de alta calidad.',
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=500&h=500&fit=crop'
    ],
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Negro', 'Blanco', 'Gris', 'Azul Marino']
    },
    inStock: 50,
    customizable: true,
    featured: false
  },
  {
    name: 'Polos',
    price: 35.00,
    description: 'Polo clásico de alta calidad, ideal para estampados y personalización. Corte moderno y cómodo, perfecto para uso diario.',
    images: [
      'https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1618354691372-d3a39833d8a2?w=500&h=500&fit=crop'
    ],
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Blanco', 'Negro', 'Azul', 'Rojo']
    },
    inStock: 50,
    customizable: true,
    featured: false
  },
  {
    name: 'Joggers',
    price: 55.00,
    description: 'Pantalón jogger cómodo y moderno, perfecto para personalizar. Diseño casual y versátil, ideal para cualquier ocasión.',
    images: [
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1506629905607-ccf4c1e0a0e0?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=500&h=500&fit=crop'
    ],
    variants: {
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Negro', 'Gris', 'Azul Marino']
    },
    inStock: 50,
    customizable: true,
    featured: false
  },
  {
    name: 'Gorros',
    price: 25.00,
    description: 'Gorro ajustable de alta calidad, ideal para bordados y personalización. Diseño clásico y versátil, perfecto para todas las estaciones.',
    images: [
      'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&h=500&fit=crop'
    ],
    variants: {
      sizes: ['Única'],
      colors: ['Negro', 'Blanco', 'Gris', 'Beige']
    },
    inStock: 50,
    customizable: true,
    featured: false
  },
  {
    name: 'Joyas',
    price: 30.00,
    description: 'Accesorios de joyería personalizables, perfectos para regalos únicos. Diseño elegante y versátil, ideal para cualquier ocasión especial.',
    images: [
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=500&h=500&fit=crop'
    ],
    variants: {
      sizes: ['Única'],
      colors: ['Plata', 'Oro', 'Negro']
    },
    inStock: 50,
    customizable: true,
    featured: false
  }
];

/**
 * Obtener o crear la categoría "Ropa"
 * @returns {Promise<string>} ID de la categoría
 */
async function getOrCreateCategory() {
  try {
    // Obtener todas las categorías existentes
    const { data: categories, error } = await getCategories();
    
    if (error) {
      console.error('Error al obtener categorías:', error);
      throw error;
    }

    // Buscar categoría "Ropa"
    const ropaCategory = categories?.find(cat => 
      cat.name?.toLowerCase() === 'ropa' || 
      cat.name?.toLowerCase() === 'vestimenta' ||
      cat.name?.toLowerCase() === 'prendas'
    );

    if (ropaCategory) {
      console.log('✅ Categoría encontrada:', ropaCategory.name, '(ID:', ropaCategory.id + ')');
      return ropaCategory.id;
    }

    // Si no existe, crear categoría "Ropa"
    console.log('📝 Creando categoría "Ropa"...');
    const { id, error: createError } = await createCategory({
      name: 'Ropa',
      order: categories?.length || 0
    });

    if (createError) {
      console.error('Error al crear categoría:', createError);
      throw createError;
    }

    console.log('✅ Categoría "Ropa" creada (ID:', id + ')');
    return id;
  } catch (error) {
    console.error('Error en getOrCreateCategory:', error);
    throw error;
  }
}

/**
 * Crear todos los productos de referencia
 */
export async function createReferenceProducts() {
  console.log('🚀 Iniciando creación de productos de referencia...\n');

  try {
    // Obtener o crear categoría
    const categoryId = await getOrCreateCategory();
    console.log('');

    // Crear cada producto
    const results = [];
    for (let i = 0; i < referenceProducts.length; i++) {
      const productData = referenceProducts[i];
      
      console.log(`📦 Creando producto ${i + 1}/${referenceProducts.length}: ${productData.name}...`);
      
      const productPayload = {
        ...productData,
        category: categoryId
      };

      const { id, error } = await createProduct(productPayload);

      if (error) {
        console.error(`❌ Error al crear ${productData.name}:`, error);
        results.push({ name: productData.name, success: false, error });
      } else {
        console.log(`✅ ${productData.name} creado exitosamente (ID: ${id})`);
        results.push({ name: productData.name, success: true, id });
      }
      
      // Pequeña pausa entre productos para evitar rate limiting
      if (i < referenceProducts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Resumen
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DE CREACIÓN');
    console.log('='.repeat(50));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Productos creados exitosamente: ${successful.length}/${referenceProducts.length}`);
    successful.forEach(r => {
      console.log(`   - ${r.name} (ID: ${r.id})`);
    });

    if (failed.length > 0) {
      console.log(`\n❌ Productos con errores: ${failed.length}`);
      failed.forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
    }

    console.log('\n✨ Proceso completado!');
    
    return {
      success: failed.length === 0,
      results,
      total: referenceProducts.length,
      successful: successful.length,
      failed: failed.length
    };
  } catch (error) {
    console.error('❌ Error fatal al crear productos:', error);
    throw error;
  }
}

// Si se ejecuta directamente desde el navegador
if (typeof window !== 'undefined') {
  window.createReferenceProducts = createReferenceProducts;
}

export default createReferenceProducts;
