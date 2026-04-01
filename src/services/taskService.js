import { db } from '../firebase';
import { collection, getDocs, addDoc, query, where, updateDoc, doc } from 'firebase/firestore';

const templateRef = collection(db, 'templates');

// 1. Fetches the base schedule for the whole week
export const getWeeklyTemplate = async () => {
  try {
    const snap = await getDocs(templateRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("Template Fetch Error:", e);
    return [];
  }
};

// 2. Setup initial Nursing/Dev blocks (The "Egerton" Schedule)
export const setupInitialBlocks = async () => {
  try {
    const blocks = [
      { day: 'Tuesday', title: 'Med-Surg Revision', startTime: '08:00', endTime: '10:00', category: 'Nursing' },
      { day: 'Tuesday', title: 'React Firebase Project', startTime: '14:00', endTime: '16:00', category: 'Dev' },
      { day: 'Wednesday', title: 'Community Health', startTime: '10:00', endTime: '12:00', category: 'Nursing' }
    ];
    
    const existing = await getDocs(templateRef);
    if (existing.empty) {
      for (const b of blocks) {
        await addDoc(templateRef, b);
      }
    }
  } catch (e) {
    console.error("Setup Error:", e);
  }
};

// 3. Update execution status for the Battery Mode
export const updateTaskExecution = async (id, updates) => {
  try {
    const docRef = doc(db, 'tasks', id);
    await updateDoc(docRef, updates);
  } catch (e) {
    console.error("Update Error:", e);
  }
};
