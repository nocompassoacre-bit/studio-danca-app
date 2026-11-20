import { createContext, useContext, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginComPerfil = async (email, senha, perfilEsperado) => {
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    const docRef = doc(db, 'users', cred.user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      await signOut(auth);
      throw new Error('Perfil não encontrado no sistema. Contate a coordenação.');
    }

    const dados = docSnap.data();
    if (dados.role !== perfilEsperado) {
      await signOut(auth);
      const nomesPerfis = {
        aluno: 'Alunos',
        bolsista: 'Bolsista',
        prof: 'Professor',
        admin: 'Coordenação',
      };
      throw new Error(`Esta conta não pertence ao acesso de ${nomesPerfis[perfilEsperado]}.`);
    }

    setUserData(dados);
    return dados;
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, userData, loading, loginComPerfil, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
