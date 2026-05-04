/**
 * Script para migrar imagesByColor de Google Drive a Cloudinary.
 * 
 * Las imágenes YA están subidas a Cloudinary. Solo necesitamos actualizar
 * las URLs en Firestore para que apunten a Cloudinary en vez de Google Drive.
 * 
 * Uso: node scripts/migrateImagesToCloudinary.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Buscar el archivo de credenciales de Firebase
const possiblePaths = [
  path.join(__dirname, '..', 'serviceAccountKey.json'),
  path.join(__dirname, '..', 'firebase-service-account.json'),
  path.join(__dirname, '..', 'service-account.json'),
  path.join(__dirname, '..', 'credentials.json'),
];

let serviceAccount = null;
for (const p of possiblePaths) {
  try {
    serviceAccount = require(p);
    console.log(`✅ Credenciales encontradas en: ${p}`);
    break;
  } catch (e) {
    // No existe, intentar siguiente
  }
}

if (!serviceAccount) {
  console.error('❌ No se encontraron credenciales de Firebase.');
  console.error('Coloca tu archivo serviceAccountKey.json en la raíz del proyecto.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Mapeo: nombre de color → URL Cloudinary (encontradas en el editor)
const CLOUDINARY_IMAGES = {
  'ROSADO': 'https://res.cloudinary.com/dtixoxgsf/image/upload/v1773435032/Polera_Rosado_umvnho.png',
  'CELESTE': 'https://res.cloudinary.com/dtixoxgsf/image/upload/v1773435032/Polera_Celeste_bmsk1e.png',
  'NEGRO': 'https://res.cloudinary.com/dtixoxgsf/image/upload/v1773435032/Polera_Negro_swcplj.png',
  'MELANGE': 'https://res.cloudinary.com/dtixoxgsf/image/upload/v1773435032/Polera_Melange_caeume.png',
  'BLANCO': 'https://res.cloudinary.com/dtixoxgsf/image/upload/v1773435032/Polera_Blanco_beobz8.png',
  'GUINDA': 'https://res.cloudinary.com/dtixoxgsf/image/upload/v1773435032/Polera_Guinda_myjsi2.png',
  'ACERO': 'https://res.cloudinary.com/dtixoxgsf/image/upload/v1773435070/Polera_Acero_bwpqrt.png',
};

async function migrateProduct(productId) {
  console.log(`\n🔄 Migrando producto: ${productId}`);
  
  const docRef = db.collection('products').doc(productId);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    console.error(`❌ Producto ${productId} no encontrado`);
    return;
  }

  const data = doc.data();
  let changed = false;

  // 1. Migrar customizationViews[].imagesByColor
  if (data.customizationViews && Array.isArray(data.customizationViews)) {
    data.customizationViews.forEach((view, viewIdx) => {
      if (view.imagesByColor && typeof view.imagesByColor === 'object') {
        const newImagesByColor = {};
        for (const [key, value] of Object.entries(view.imagesByColor)) {
          // Si la clave es una URL de Google Drive, eliminarla
          if (key.includes('drive.google.com')) {
            console.log(`  🗑️  Eliminando clave URL: ${key.substring(0, 60)}...`);
            changed = true;
            continue;
          }
          // Si el valor es de Google Drive, reemplazar con Cloudinary
          if (typeof value === 'string' && (value.includes('drive.google.com') || value.includes('lh3.google'))) {
            const upperKey = key.toUpperCase().trim();
            if (CLOUDINARY_IMAGES[upperKey]) {
              newImagesByColor[key] = CLOUDINARY_IMAGES[upperKey];
              console.log(`  ✅ view[${viewIdx}].imagesByColor["${key}"]: Google Drive → Cloudinary`);
              changed = true;
            } else {
              console.warn(`  ⚠️  No hay URL Cloudinary para color "${key}". Manteniendo Google Drive.`);
              newImagesByColor[key] = value;
            }
          } else {
            newImagesByColor[key] = value;
          }
        }
        // Agregar colores que faltan en imagesByColor pero existen en Cloudinary
        for (const [color, cloudinaryUrl] of Object.entries(CLOUDINARY_IMAGES)) {
          if (!newImagesByColor[color]) {
            newImagesByColor[color] = cloudinaryUrl;
            console.log(`  ➕ view[${viewIdx}].imagesByColor["${color}"]: Agregado desde Cloudinary`);
            changed = true;
          }
        }
        view.imagesByColor = newImagesByColor;
      }
    });
  }

  // 2. Migrar variants[].imageUrl
  if (data.variants && Array.isArray(data.variants)) {
    data.variants.forEach((variant, idx) => {
      if (variant.imageUrl && typeof variant.imageUrl === 'string' && 
          (variant.imageUrl.includes('drive.google.com') || variant.imageUrl.includes('lh3.google'))) {
        const upperName = (variant.name || '').toUpperCase().trim();
        if (CLOUDINARY_IMAGES[upperName]) {
          console.log(`  ✅ variants[${idx}].imageUrl ("${variant.name}"): Google Drive → Cloudinary`);
          variant.imageUrl = CLOUDINARY_IMAGES[upperName];
          changed = true;
        }
      }
    });
  }

  // 3. Migrar mainImage
  if (data.mainImage && typeof data.mainImage === 'string' && 
      (data.mainImage.includes('drive.google.com') || data.mainImage.includes('lh3.google'))) {
    // Usar la primera imagen cloudinary disponible
    const firstCloudinary = Object.values(CLOUDINARY_IMAGES)[0];
    console.log(`  ✅ mainImage: Google Drive → Cloudinary`);
    data.mainImage = firstCloudinary;
    changed = true;
  }

  // 4. Migrar images[]
  if (data.images && Array.isArray(data.images)) {
    data.images = data.images.map((img, idx) => {
      if (typeof img === 'string' && (img.includes('drive.google.com') || img.includes('lh3.google'))) {
        console.log(`  ✅ images[${idx}]: Google Drive → Cloudinary`);
        changed = true;
        return CLOUDINARY_IMAGES['ROSADO']; // Default
      }
      return img;
    });
  }

  if (changed) {
    await docRef.update({
      customizationViews: data.customizationViews,
      variants: data.variants,
      ...(data.mainImage ? { mainImage: data.mainImage } : {}),
      ...(data.images ? { images: data.images } : {}),
    });
    console.log(`✅ Producto ${productId} actualizado exitosamente`);
  } else {
    console.log(`ℹ️  Producto ${productId} no tenía URLs de Google Drive`);
  }
}

async function main() {
  try {
    // Sub-producto del combo
    await migrateProduct('6ssDONSVR44bMMukpLvN');
    
    // También migrar el combo padre si tiene URLs de Drive
    await migrateProduct('JpntLVN4ok6yYNjrh3xA');
    
    console.log('\n🎉 Migración completada!');
    console.log('Las imágenes ahora cargan desde Cloudinary.');
    console.log('Recarga la página con Shift+F5 para ver los cambios.');
  } catch (err) {
    console.error('❌ Error durante la migración:', err);
  }
  process.exit(0);
}

main();
