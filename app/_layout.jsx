import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from '../context/AuthContext';

ExpoSplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F0F2F5',
  },
};

function AppContent() {
  const { isLoading: isAuthContextBusy, isLoggedIn } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const router = useRouter();
  const segments = useSegments();
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    const manageNavigationAndSplash = async () => {
      if (!initialLoadComplete) {
        if (isAuthContextBusy || (!fontsLoaded && !fontError)) {
          return;
        } else {
          setInitialLoadComplete(true);
          return;
        }
      }

      const currentSegments = Array.isArray(segments) ? segments : [];
      const currentInitialSegment = currentSegments[0] || '';
      const onAuthRoute = currentInitialSegment === 'loginScreen' || currentInitialSegment === 'registerScreen';

      let navigationNeeded = false;
      if (!isLoggedIn && !onAuthRoute) {
        if (currentInitialSegment !== 'loginScreen') {
          try {
            router.replace('/loginScreen');
            navigationNeeded = true;
          } catch (navError) {
          }
        }
      } else if (isLoggedIn && onAuthRoute) {
        try {
          router.replace('/(tabs)/');
          navigationNeeded = true;
        } catch (navError) {
        }
      }

      if (!navigationNeeded) {
        await ExpoSplashScreen.hideAsync();
      }
    };

    manageNavigationAndSplash();
  }, [fontsLoaded, fontError, isAuthContextBusy, isLoggedIn, segments, router, initialLoadComplete]);

  if (!initialLoadComplete) {
    return null;
  }

  return (
    <ThemeProvider value={LightTheme}>
      <>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar backgroundColor="white" style="dark" translucent={false} />
        <Toast />
      </>
    </ThemeProvider>
  );
}