import { create } from "zustand";
import { User } from "firebase/auth";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot,
  Unsubscribe
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

export interface Profile {
  uid: string;
  gamertag: string;
  displayName: string;
  registeredGames: string[];
  preferredRoles: string[];
  skillLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  riotId?: string;
  stats: {
    wins: number;
    losses: number;
    points: number;
  };
  createdAt: number;
}

export interface Team {
  id: string;
  name: string;
  captainId: string;
  members: string[];
  pendingInvites: string[];
  createdAt: number;
}

interface AppState {
  user: User | null;
  profile: Profile | null;
  team: Team | null;
  teamLoading: boolean;
  loading: boolean;
  initialized: boolean;
  isOffline: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setTeam: (team: Team | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setIsOffline: (isOffline: boolean) => void;
  logout: () => Promise<void>;
}

// Active listeners references so we can unsubscribe on logout
let profileListener: Unsubscribe | null = null;
let teamListener: Unsubscribe | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  profile: null,
  team: null,
  teamLoading: false,
  loading: true,
  initialized: false,
  isOffline: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setTeam: (team) => set({ team }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  setIsOffline: (isOffline) => set({ isOffline }),
  
  logout: async () => {
    stopUserListeners();
    await auth.signOut();
    set({ user: null, profile: null, team: null, loading: false });
  }
}));

// Helper to start real-time listeners for the authenticated user
export const startUserListeners = (uid: string) => {
  // Unsubscribe from existing listeners first
  if (profileListener) profileListener();
  if (teamListener) teamListener();

  const store = useAppStore.getState();
  store.setLoading(true);

  // 1. Real-time Profile Listener
  profileListener = onSnapshot(doc(db, "profiles", uid), (docSnap) => {
    if (docSnap.exists()) {
      const profileData = { uid, ...docSnap.data() } as Profile;
      useAppStore.setState({ profile: profileData, loading: false });

      // 2. Real-time Team Listener (querying teams where user is a member)
      const teamsRef = collection(db, "teams");
      const q = query(teamsRef, where("members", "array-contains", uid));
      
      // Cleanup previous team listener if it exists to prevent memory leaks!
      if (teamListener) {
        teamListener();
      }

      useAppStore.setState({ teamLoading: true });
      teamListener = onSnapshot(q, (querySnap) => {
        if (!querySnap.empty) {
          // User is a member of a team (take the first one they belong to)
          const teamDoc = querySnap.docs[0];
          useAppStore.setState({ 
            team: { id: teamDoc.id, ...teamDoc.data() } as Team,
            teamLoading: false 
          });
        } else {
          // User is not in any team
          useAppStore.setState({ team: null, teamLoading: false });
        }
      }, (error) => {
        console.error("Team listener error:", error);
        useAppStore.setState({ teamLoading: false });
      });

    } else {
      // Profile doc doesn't exist yet (needs setup)
      useAppStore.setState({ profile: null, team: null, loading: false });
    }
  }, (error) => {
    console.error("Profile listener error:", error);
    useAppStore.setState({ loading: false });
  });
};

export const stopUserListeners = () => {
  if (profileListener) {
    profileListener();
    profileListener = null;
  }
  if (teamListener) {
    teamListener();
    teamListener = null;
  }
};
