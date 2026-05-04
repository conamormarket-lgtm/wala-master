import { getCollection, createDocument } from './firebase/firestore';

const COLLECTION = 'vendors';

export const getVendors = async () => {
  const result = await getCollection(COLLECTION, [], { field: 'name', direction: 'asc' });
  return result;
};

export const createVendor = async (data) => {
  const payload = {
    name: data.name,
    createdAt: new Date().toISOString()
  };
  const result = await createDocument(COLLECTION, payload);
  if (result.error) throw new Error(result.error);
  return result;
};
