import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isAuthModalOpen: false,
  authRedirectPath: null,
  authMode: "login", // "login" | "signup" — see openAuthModal
  authSource: null, // which entry point opened it; tagged onto the customer at signup
  pincode: "",
  collectionContext: null, // Track current browsing context, e.g. the collection a PDP was opened from
  referralLink: "",
  referralLoading: false,
  referralError: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    login: (state, action) => {
      const { user, accessToken } = action.payload.user ? action.payload : { user: action.payload, accessToken: state.accessToken };
      
      state.user = user;
      state.accessToken = accessToken || null;
      state.isAuthenticated = !!accessToken; // Only authenticated if we have a token
      state.isAuthModalOpen = false;
    },
    setPincode: (state, action) => {
      state.pincode = String(action.payload || "")
        .replace(/\D/g, "")
        .slice(0, 6);
    },
    setCollectionContext: (state, action) => {
      state.collectionContext = action.payload;
    },
    logout: (state) => {
      console.log("[userSlice] Logging out user and clearing session.");
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
    },
    setAvatar: (state, action) => {
      if (state.user) {
        state.user.avatar = action.payload;
      }
    },
    updateUser: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        // Ensure name is updated if firstName/lastName changed
        if (action.payload.firstName || action.payload.lastName) {
          state.user.name = `${action.payload.firstName || state.user.firstName || ""} ${action.payload.lastName || state.user.lastName || ""}`.trim();
        }
      }
    },
    // Payload is either a redirect path (what every existing openLogin call passes) or
    // { redirectPath, mode }. `mode` picks which face the dialog wears, because the two audiences
    // want opposite things: someone signing IN wants the fewest possible pixels between them and
    // their orders, and being sold a discount wheel is friction. Someone signing UP has no reason to
    // yet, so the wheel is the reason. Same flow underneath -- only the left panel and the copy differ.
    openAuthModal: (state, action) => {
      const payload = action.payload;
      const isObject = payload !== null && typeof payload === "object";

      state.isAuthModalOpen = true;
      state.authRedirectPath = (isObject ? payload.redirectPath : payload) || null;
      state.authMode = (isObject && payload.mode) || "login";
      state.authSource = (isObject && payload.source) || null;
    },
    closeAuthModal: (state) => {
      state.isAuthModalOpen = false;
      state.authRedirectPath = null;
      state.authMode = "login";
      state.authSource = null;
    },
    toggleAuthModal: (state) => {
      state.isAuthModalOpen = !state.isAuthModalOpen;
      if (!state.isAuthModalOpen) {
        state.authRedirectPath = null;
        state.authMode = "login";
      state.authSource = null;
      }
    },
    setReferralLoading: (state, action) => {
      state.referralLoading = action.payload;
    },
    setReferralLink: (state, action) => {
      state.referralLink = action.payload;
      state.referralError = null;
    },
    setReferralError: (state, action) => {
      state.referralError = action.payload;
    },
  },
});

export const { 
  login, 
  setPincode, 
  setCollectionContext,
  logout, 
  setAvatar,
  updateUser, 
  openAuthModal, 
  closeAuthModal, 
  toggleAuthModal,
  setReferralLoading, 
  setReferralLink, 
  setReferralError 
} = userSlice.actions;
export default userSlice.reducer;

export const selectUser = (state) => state.user.user;
export const selectIsAuthenticated = (state) => state.user.isAuthenticated;
export const selectIsAuthModalOpen = (state) => state.user.isAuthModalOpen;
export const selectAuthMode = (state) => state.user.authMode;
export const selectAuthSource = (state) => state.user.authSource;
export const selectPincode = (state) => state.user.pincode;
