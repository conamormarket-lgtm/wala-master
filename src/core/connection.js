// Core centralizado para conexiones y API
export * from '../services/firebase/config';
export { getDocument, setDocument, updateDocument, deleteDocument } from '../services/firebase/firestore';
export { uploadFile, deleteFile, getFileUrl } from '../services/firebase/storage';
