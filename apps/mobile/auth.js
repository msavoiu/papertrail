// apps/mobile/auth.js
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCredential,
    signInWithEmailAndPassword
} from "firebase/auth";
import { auth } from "./firebaseConfig";

// Important: Warm up the browser for better UX
WebBrowser.maybeCompleteAuthSession();

const webClientId = Constants.expoConfig?.extra?.webClientId;

// Email/password login
export async function loginWithEmail(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Email login error:", error.code, error.message);
    throw error;
  }
}

// Google sign-in (Expo Go compatible)
export async function loginWithGoogle() {
  try {
    if (!webClientId) {
      throw new Error("webClientId not configured in app.json");
    }

    // Create redirect URI
    const redirectUri = AuthSession.makeRedirectUri({
      useProxy: true,
    });

    console.log("Redirect URI:", redirectUri);

    // Start auth session
    const response = await AuthSession.startAsync({
      authUrl:
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${webClientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=id_token` +
        `&scope=openid%20profile%20email` +
        `&nonce=${Math.random().toString(36)}`,
    });

    if (response.type !== "success") {
      throw new Error("Google sign-in cancelled or failed");
    }

    // Extract ID token
    const { id_token } = response.params;
    
    if (!id_token) {
      throw new Error("No ID token received from Google");
    }

    // Sign in to Firebase
    const credential = GoogleAuthProvider.credential(id_token);
    const result = await signInWithCredential(auth, credential);
    
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
}

// Get current user's ID token
export async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not signed in");
  
  try {
    return await user.getIdToken(true); // Force refresh
  } catch (error) {
    console.error("Token error:", error);
    throw error;
  }
}

// Listen to auth state changes
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// Sign out
export async function signOut() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Sign out error:", error);
    throw error;
  }
}