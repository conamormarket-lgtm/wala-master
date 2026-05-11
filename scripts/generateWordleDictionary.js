const fs = require('fs');
const path = require('path');

// Ejecuta: npm install an-array-of-spanish-words
// Luego: node scripts/generateWordleDictionary.js

const generateDictionary = () => {
  try {
    const allWords = require('an-array-of-spanish-words');
    
    // Función para quitar tildes
    const removeAccents = (str) => {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    };

    const validWordsSet = new Set();

    allWords.forEach(word => {
      // Filtrar solo palabras de 5 letras (sin contar espacios ni guiones)
      if (word.length === 5 && /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+$/.test(word)) {
        validWordsSet.add(removeAccents(word));
      }
    });

    const validGuesses = Array.from(validWordsSet);
    console.log(`Total de palabras válidas de 5 letras encontradas: ${validGuesses.length}`);

    // Barajar aleatoriamente para sacar las 2000 de uso diario
    const shuffled = [...validGuesses].sort(() => 0.5 - Math.random());
    const dailyWords = shuffled.slice(0, 2000);

    const fileContent = `// Archivo autogenerado con las palabras para el Wordle
// Total Intentos Válidos: ${validGuesses.length}
// Palabras Diarias: ${dailyWords.length}

export const DAILY_WORDS = ${JSON.stringify(dailyWords)};

export const VALID_GUESSES = new Set(${JSON.stringify(validGuesses)});
`;

    const outputPath = path.join(__dirname, '..', 'src', 'data', 'wordleDictionary.js');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, fileContent);
    
    console.log(`¡Éxito! Diccionario generado en: ${outputPath}`);
  } catch (error) {
    console.error("Error: Asegúrate de haber instalado el paquete ejecutando: npm install an-array-of-spanish-words");
    console.error(error);
  }
};

generateDictionary();
