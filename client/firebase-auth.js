import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

let auth = null;
const ready = (async () => {
  const response = await fetch('/api/firebase-config');
  if (!response.ok) return false;
  const config = await response.json();
  if (config.enabled === false) return false;
  auth = getAuth(initializeApp(config));
  await auth.authStateReady();
  return true;
})().catch(error => {
  console.error('[firebase auth]', error);
  return false;
});

window.MindraftAuth = {
  ready,
  currentUser: () => auth?.currentUser || null,
  idToken: async () => auth?.currentUser?.getIdToken() || null,
  signIn: async () => {
    if (!auth) throw new Error('Google 로그인이 아직 설정되지 않았어요.');
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    return credential.user.getIdToken();
  },
  signOut: async () => { if (auth) await signOut(auth); }
};
