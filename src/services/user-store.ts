import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type UserProfile = Record<string, unknown> | null;

type UserState = {
  authenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile;
  setAuthSession: (payload: {
    accessToken: string;
    refreshToken?: string | null;
    user?: UserProfile;
  }) => void;
  setUser: (user: UserProfile) => void;
  updateUser: (payload: Record<string, unknown>) => void;
  clearSession: () => void;
};

function syncLegacyStorage(state: Pick<UserState, "accessToken" | "refreshToken" | "user">) {
  if (state.accessToken) {
    localStorage.setItem("fms-access-token", state.accessToken);
  } else {
    localStorage.removeItem("fms-access-token");
  }

  if (state.refreshToken) {
    localStorage.setItem("fms-refresh-token", state.refreshToken);
  } else {
    localStorage.removeItem("fms-refresh-token");
  }

  if (state.user) {
    localStorage.setItem("fms-current-profile", JSON.stringify(state.user));
  } else {
    localStorage.removeItem("fms-current-profile");
  }
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      authenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuthSession: ({ accessToken, refreshToken = null, user = null }) => {
        const nextState = {
          authenticated: true,
          accessToken,
          refreshToken,
          user,
        };
        syncLegacyStorage(nextState);
        set(nextState);
      },
      setUser: (user) => {
        syncLegacyStorage({
          accessToken: useUserStore.getState().accessToken,
          refreshToken: useUserStore.getState().refreshToken,
          user,
        });
        set((state) => ({ ...state, user }));
      },
      updateUser: (payload) => {
        set((state) => {
          const nextUser =
            state.user && typeof state.user === "object"
              ? { ...state.user, ...payload }
              : payload;
          syncLegacyStorage({
            accessToken: state.accessToken,
            refreshToken: state.refreshToken,
            user: nextUser,
          });
          return { ...state, user: nextUser };
        });
      },
      clearSession: () => {
        syncLegacyStorage({
          accessToken: null,
          refreshToken: null,
          user: null,
        });
        set({
          authenticated: false,
          accessToken: null,
          refreshToken: null,
          user: null,
        });
      },
    }),
    {
      name: "fms-user-store",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        syncLegacyStorage({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          user: state.user,
        });
      },
    },
  ),
);
