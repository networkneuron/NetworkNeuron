import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Node, Session, Reward, NetworkStats } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: Partial<User>) => Promise<void>;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      token: null,

      login: async (email: string, password: string) => {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            throw new Error('Login failed');
          }

          const data = await response.json();
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('Login error:', error);
          throw error;
        }
      },

      register: async (userData: Partial<User>) => {
        try {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
          });

          if (!response.ok) {
            throw new Error('Registration failed');
          }

          const data = await response.json();
          set({
            user: data.user,
            token: data.token,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('Registration error:', error);
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      updateProfile: async (userData: Partial<User>) => {
        try {
          const { token } = get();
          const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(userData),
          });

          if (!response.ok) {
            throw new Error('Profile update failed');
          }

          const data = await response.json();
          set({ user: data.user });
        } catch (error) {
          console.error('Profile update error:', error);
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

interface NetworkState {
  stats: NetworkStats | null;
  nodes: Node[];
  sessions: Session[];
  rewards: Reward[];
  isLoading: boolean;
  error: string | null;
  updateStats: (stats: NetworkStats) => void;
  updateNodes: (nodes: Node[]) => void;
  updateSessions: (sessions: Session[]) => void;
  updateRewards: (rewards: Reward[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  stats: null,
  nodes: [],
  sessions: [],
  rewards: [],
  isLoading: false,
  error: null,

  updateStats: (stats) => set({ stats }),
  updateNodes: (nodes) => set({ nodes }),
  updateSessions: (sessions) => set({ sessions }),
  updateRewards: (rewards) => set({ rewards }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

interface NodeState {
  selectedNode: Node | null;
  nodeStats: any;
  setSelectedNode: (node: Node | null) => void;
  updateNodeStats: (stats: any) => void;
}

export const useNodeStore = create<NodeState>((set) => ({
  selectedNode: null,
  nodeStats: null,
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  updateNodeStats: (nodeStats) => set({ nodeStats }),
}));
