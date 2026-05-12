const fs = require('fs');
const path = require('path');

const filePath = path.resolve('/home/lazaro/Workspace/wala-master-1/src/pages/Tienda/admin/VisualEditorPanel.jsx');
const content = fs.readFileSync(filePath, 'utf-8');

// The renderForm function starts at:
// const renderForm = () => { ...
// We can find where `if (section.type === 'footer_columns') {` starts, up to the end of `renderForm`.

const startIndex = content.indexOf('if (section.type === \'footer_columns\')');
const endIndex = content.indexOf('return <p>Sección desconocida.</p>;');

if (startIndex > -1 && endIndex > -1) {
  const formsContent = content.substring(startIndex, endIndex);

  const wrapper = `import React from 'react';
import { ArrowLeft, Trash2, Plus, GripVertical } from 'lucide-react';
import TypographyControl from './controls/TypographyControl';
import BackgroundStylesControl from './controls/BackgroundStylesControl';
import styles from '../../../../components/admin/VisualEditorPanel.module.css';

const ModuleForms = ({ section, dynamicSectionIndex, storeConfigDraft, updateSectionsDraft, closeEditor, updateField, collections, config }) => {
  const s = section.settings || {};
  
  ${formsContent}
  
  return null;
};

export default ModuleForms;
`;

  const outPath = path.resolve('/home/lazaro/Workspace/wala-master-1/src/pages/Tienda/admin/editor/ModuleForms.jsx');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, wrapper);
  console.log('ModuleForms.jsx extracted successfully!');
} else {
  console.error('Could not find boundaries.');
}
