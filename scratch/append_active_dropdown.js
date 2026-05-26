const fs = require('fs');
const cssPath = 'c:\\\\Users\\\\danie\\\\OneDrive\\\\Desktop\\\\Trabajo\\\\wala-master\\\\src\\\\components\\\\common\\\\Header\\\\Header.module.css';

const appendCSS = `
/* CSS to strictly control dropdown visibility via React state */
.accountDropdownContainer.activeDropdown .accountPopup {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
}
.accountDropdownContainer.activeDropdown .mobileCenteredPopup {
  visibility: visible;
  opacity: 1;
  transform: translateY(0);
}
`;

fs.appendFileSync(cssPath, appendCSS, 'utf8');
console.log('Appended activeDropdown CSS to Header.module.css');
