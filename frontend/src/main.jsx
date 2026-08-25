import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ClerkProvider } from '@clerk/clerk-react';
import { store } from './app/store';
import { MockAuthProvider } from './components/ClerkAuthAdapter';
import App from './App';
import './index.css';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isValidClerkKey =
  CLERK_PUBLISHABLE_KEY &&
  CLERK_PUBLISHABLE_KEY.startsWith('pk_') &&
  !CLERK_PUBLISHABLE_KEY.includes('your_');

function RootProvider({ children }) {
  if (isValidClerkKey) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        {children}
      </ClerkProvider>
    );
  }
  return <MockAuthProvider>{children}</MockAuthProvider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <RootProvider>
          <App />
        </RootProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
