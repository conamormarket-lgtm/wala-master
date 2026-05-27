const fs = require('fs');

let c = fs.readFileSync('src/pages/SubscriptionSurveyPage.jsx', 'utf8');

c = c.replace(
  "import styles from './SubscriptionSurveyPage.module.css';",
  "import { showFlyingCoins } from '../utils/animations';\nimport styles from './SubscriptionSurveyPage.module.css';"
);

c = c.replace(
  "coinsEarned = newEventsAdded * 5;",
  "coinsEarned = Math.min(newEventsAdded, 3) * 5;"
);

c = c.replace(
  /await earnMainCoins\(coinsEarned, 'Fechas registradas en encuesta', 90\);\s+window\.dispatchEvent\(new CustomEvent\('coins-animation-start', \{ detail: \{ amount: coinsEarned \} \}\)\);/g,
  "await earnMainCoins(coinsEarned, 'Fechas registradas en encuesta');\n        const startX = window.innerWidth / 2;\n        const startY = window.innerHeight / 2;\n        showFlyingCoins(startX, startY, coinsEarned);"
);

c = c.replace(
  "¡Gana 5 Kapicoins por cada fecha importante que registres!",
  "¡Gana 5 Wala Coins por cada fecha importante que registres (hasta un máximo de 15 monedas)!"
);

fs.writeFileSync('src/pages/SubscriptionSurveyPage.jsx', c);
console.log('Done');
