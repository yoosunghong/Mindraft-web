import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function createCloudStore(projectId) {
  const app = getApps()[0] || initializeApp({ projectId });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const profileCollection = db.collection('profiles');
  const usageCollection = db.collection('aiUsage');
  let committed = new Map();
  let writeQueue = Promise.resolve();

  return {
    async loadProfiles() {
      const snapshot = await profileCollection.get();
      const profiles = new Map(snapshot.docs.map(doc => [doc.id, doc.data().profile]));
      committed = new Map([...profiles].map(([key, profile]) => [key, JSON.stringify(profile)]));
      return profiles;
    },
    saveProfiles(profiles) {
      const current = new Map([...profiles].map(([key, profile]) => [key, JSON.stringify(profile)]));
      writeQueue = writeQueue.catch(error => {
        console.error('[firestore] prior profile write failed', error);
      }).then(async () => {
        const changes = [...current].filter(([key, value]) => committed.get(key) !== value);
        const removed = [...committed.keys()].filter(key => !current.has(key));
        const operations = [
          ...changes.map(([key, value]) => ({ key, value })),
          ...removed.map(key => ({ key, value: null }))
        ];
        for (let i = 0; i < operations.length; i += 400) {
          const batch = db.batch();
          for (const { key, value } of operations.slice(i, i + 400)) {
            const ref = profileCollection.doc(key);
            if (value === null) batch.delete(ref);
            else batch.set(ref, { profile: JSON.parse(value) });
          }
          await batch.commit();
        }
        committed = current;
      });
      return writeQueue;
    },
    verifyIdToken: token => auth.verifyIdToken(token),
    async aiUsed(uid) {
      const doc = await usageCollection.doc(uid).get();
      return doc.exists ? Math.max(0, Number(doc.data().used) || 0) : 0;
    },
    async reserveAiCall(uid, limit = 10) {
      return db.runTransaction(async transaction => {
        const ref = usageCollection.doc(uid);
        const doc = await transaction.get(ref);
        const used = doc.exists ? Math.max(0, Number(doc.data().used) || 0) : 0;
        if (used >= limit) throw new Error(`AI 생성은 계정당 ${limit}회까지 사용할 수 있어요.`);
        transaction.set(ref, { used: used + 1, updatedAt: Date.now() });
        return used + 1;
      });
    },
    async refundAiCall(uid) {
      return db.runTransaction(async transaction => {
        const ref = usageCollection.doc(uid);
        const doc = await transaction.get(ref);
        const used = doc.exists ? Math.max(0, Number(doc.data().used) || 0) : 0;
        transaction.set(ref, { used: Math.max(0, used - 1), updatedAt: Date.now() });
        return Math.max(0, used - 1);
      });
    },
    flush: () => writeQueue
  };
}
