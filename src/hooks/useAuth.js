"use client";

import { useDispatch, useSelector } from "react-redux";

import { pushLogout } from "@/lib/gtm";
import { 
  openAuthModal, 
  closeAuthModal, 
  toggleAuthModal, 
  selectIsAuthModalOpen,
  selectUser,
  selectIsAuthenticated,
  logout
} from "@/redux/features/user/userSlice";

export const useAuth = () => {
  const dispatch = useDispatch();
  const isAuthModalOpen = useSelector(selectIsAuthModalOpen);
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const openLogin = (redirectPath = null) => dispatch(openAuthModal(redirectPath));
  const closeLogin = () => dispatch(closeAuthModal());
  const toggleLogin = () => dispatch(toggleAuthModal());
  
  const handleLogout = () => {
    // Before the dispatch: `logout` empties the user slice this reads from.
    pushLogout(user);
    dispatch(logout());
  };

  return {
    user,
    isAuthenticated,
    isAuthModalOpen,
    openLogin,
    closeLogin,
    toggleLogin,
    logout: handleLogout
  };
};
