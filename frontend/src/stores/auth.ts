import { create } from 'zustand';
interface AuthState {
  token: string | null;
  setToken: (t: string) => void;
  logout: () => void;
}
export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem('gamehub-token'),
  setToken: (t) => {
    localStorage.setItem('gamehub-token', t);
    set({ token: t });
  },
  logout: () => {
    localStorage.removeItem('gamehub-token');
    set({ token: null });
  },
}));
