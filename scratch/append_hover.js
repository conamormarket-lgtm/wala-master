const fs = require('fs');
const cssPath = 'c:\\\\Users\\\\danie\\\\OneDrive\\\\Desktop\\\\Trabajo\\\\wala-master\\\\src\\\\components\\\\common\\\\Header\\\\Header.module.css';

const appendCSS = `
/* CSS to forcefully hide dropdowns after click */
.forceHideHover .megaMenu,
.forceHideHover .accountPopup,
.forceHideHover .premiumMobileDropdown {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
`;

fs.appendFileSync(cssPath, appendCSS, 'utf8');
console.log('Appended CSS to Header.module.css');
