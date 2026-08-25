import React, { createContext, useContext, useState } from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/clerk-react';
import { currentUser } from '../assets/assets';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export const isClerkEnabled =
  Boolean(CLERK_PUBLISHABLE_KEY) &&
  CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  !CLERK_PUBLISHABLE_KEY.includes('your_');

// Mock fallback context if Clerk is disabled
const MockAuthContext = createContext({
  isSignedIn: true,
  user: {
    id: currentUser.id,
    firstName: currentUser.name.split(' ')[0],
    lastName: currentUser.name.split(' ')[1] || '',
    fullName: currentUser.name,
    imageUrl: currentUser.image,
    primaryEmailAddress: { emailAddress: currentUser.email },
  },
  signOut: () => {},
  openSignIn: () => {},
  openSignUp: () => {},
});

export function MockAuthProvider({ children }) {
  const [isSignedIn, setIsSignedIn] = useState(true);

  const mockUser = {
    id: currentUser.id,
    firstName: currentUser.name.split(' ')[0],
    lastName: currentUser.name.split(' ')[1] || '',
    fullName: currentUser.name,
    imageUrl: currentUser.image,
    primaryEmailAddress: { emailAddress: currentUser.email },
  };

  return (
    <MockAuthContext.Provider
      value={{
        isSignedIn,
        user: isSignedIn ? mockUser : null,
        signOut: () => setIsSignedIn(false),
        openSignIn: () => setIsSignedIn(true),
        openSignUp: () => setIsSignedIn(true),
      }}
    >
      {children}
    </MockAuthContext.Provider>
  );
}

// Unified useAppUser hook
export function useAppUser() {
  if (isClerkEnabled) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const clerk = useUser();
    return {
      isLoaded: clerk.isLoaded,
      isSignedIn: clerk.isSignedIn,
      user: clerk.user
        ? {
            id: clerk.user.id,
            firstName: clerk.user.firstName,
            lastName: clerk.user.lastName,
            fullName: clerk.user.fullName || `${clerk.user.firstName || ''} ${clerk.user.lastName || ''}`.trim() || 'User',
            imageUrl: clerk.user.imageUrl,
            primaryEmailAddress: clerk.user.primaryEmailAddress,
          }
        : null,
    };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const ctx = useContext(MockAuthContext);
  return {
    isLoaded: true,
    isSignedIn: ctx.isSignedIn,
    user: ctx.user,
  };
}

// Unified Show Component (<Show when="signed-in"> / <Show when="signed-out">)
export function Show({ when, children }) {
  if (isClerkEnabled) {
    if (when === 'signed-in') {
      return <SignedIn>{children}</SignedIn>;
    }
    if (when === 'signed-out') {
      return <SignedOut>{children}</SignedOut>;
    }
    return null;
  }

  const { isSignedIn } = useContext(MockAuthContext);
  if (when === 'signed-in' && isSignedIn) return <>{children}</>;
  if (when === 'signed-out' && !isSignedIn) return <>{children}</>;
  return null;
}

// Unified Sign In Button
export function AppSignInButton({ mode = 'modal', children }) {
  if (isClerkEnabled) {
    return (
      <SignInButton mode={mode}>
        <button className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer">
          {children || 'Sign In'}
        </button>
      </SignInButton>
    );
  }

  const { openSignIn } = useContext(MockAuthContext);
  return (
    <button
      onClick={openSignIn}
      className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer"
    >
      {children || 'Sign In'}
    </button>
  );
}

// Unified Sign Up Button
export function AppSignUpButton({ mode = 'modal', children }) {
  if (isClerkEnabled) {
    return (
      <SignUpButton mode={mode}>
        <button className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow-sm shadow-indigo-600/20 cursor-pointer">
          {children || 'Sign Up'}
        </button>
      </SignUpButton>
    );
  }

  const { openSignUp } = useContext(MockAuthContext);
  return (
    <button
      onClick={openSignUp}
      className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition shadow-sm shadow-indigo-600/20 cursor-pointer"
    >
      {children || 'Sign Up'}
    </button>
  );
}

// Unified User Profile Button
export function AppUserButton() {
  if (isClerkEnabled) {
    return (
      <div className="flex items-center">
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: 'w-7 h-7 ring-2 ring-indigo-500/40',
            },
          }}
        />
      </div>
    );
  }

  const { user, signOut } = useContext(MockAuthContext);
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-1 rounded-full hover:ring-2 hover:ring-indigo-500/30 transition cursor-pointer"
      >
        <img
          src={user.imageUrl}
          alt={user.fullName}
          className="w-7 h-7 rounded-full object-cover border border-indigo-500/40"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{user.fullName}</p>
            <p className="text-[11px] text-zinc-500 truncate">{user.primaryEmailAddress?.emailAddress}</p>
          </div>
          <div className="pt-1">
            <button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
