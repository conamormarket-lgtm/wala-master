const fs = require('fs');
const html = fs.readFileSync('C:/Users/danie/Downloads/wala_rescate.html', 'utf8');

// Regex para encontrar cada tarjeta de producto
// Buscar:
// 1. ID: href="/admin/productos/(ID)"
// 2. Nombre: <h3 class="..._cardName...">Nombre</h3>
// 3. Precio y Stock: <p class="..._cardMeta...">[object Object] · S/ 120.00 · Stock: 0</p>
// 4. Imagen: <img src="/_vercel/image?url=..."

const cards = html.split('AdminProductos_card__KcznP');
const products = [];

for (let i = 1; i < cards.length; i++) {
  const card = cards[i];
  
  const idMatch = card.match(/href="\/admin\/productos\/([^"]+)"/);
  const nameMatch = card.match(/<h3[^>]*>([^<]+)<\/h3>/);
  const metaMatch = card.match(/<p[^>]*>.*?S\/\s*([0-9.]+).*?Stock:\s*([0-9]+)/);
  const imgMatch = card.match(/<img src="\/_vercel\/image\?url=([^"&]+)[^"]*"/);

  if (idMatch && nameMatch) {
    let imageUrl = '';
    if (imgMatch) {
      imageUrl = decodeURIComponent(imgMatch[1]);
    } else {
      const directImgMatch = card.match(/<img src="([^"]+)"/);
      if (directImgMatch && !directImgMatch[1].startsWith('/_vercel')) {
        imageUrl = directImgMatch[1];
      }
    }

    products.push({
      id: idMatch[1],
      name: nameMatch[1].trim(),
      price: metaMatch ? parseFloat(metaMatch[1]) : 0,
      inStock: metaMatch ? parseInt(metaMatch[2], 10) : 0,
      imageUrl: imageUrl
    });
  }
}

console.log(`Encontrados ${products.length} productos validos.`);
fs.writeFileSync('C:/Users/danie/OneDrive/Desktop/Trabajo/wala-master/productos_recuperados.json', JSON.stringify(products, null, 2));
console.log('Guardado en productos_recuperados.json');
