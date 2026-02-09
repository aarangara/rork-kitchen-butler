import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RecipeProvider } from "@/providers/RecipeProvider";
import { PerformanceProvider } from "@/providers/PerformanceProvider";
import { OnboardingProvider, useOnboarding } from "@/providers/OnboardingProvider";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { trpc, trpcClient } from "@/lib/trpc";
import colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync().catch(() => {
  console.log('[RootLayout] SplashScreen.preventAutoHideAsync failed, continuing...');
});


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

function RootLayoutNav() {
  console.log('[RootLayout] RootLayoutNav rendering');
  const router = useRouter();
  const segments = useSegments();
  const { hasCompletedOnboarding, isReady } = useOnboarding();
  console.log('[RootLayout] isReady:', isReady, 'hasCompletedOnboarding:', hasCompletedOnboarding, 'segments:', segments);

  useEffect(() => {
    if (!isReady) return;

    const inOnboarding = segments[0] === 'onboarding';

    if (!hasCompletedOnboarding && !inOnboarding) {
      router.replace('/onboarding');
    } else if (hasCompletedOnboarding && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [hasCompletedOnboarding, isReady, segments, router]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="onboarding" 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="recipe/[id]" 
        options={{ 
          headerShown: false,
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="add-recipe" 
        options={{ 
          presentation: 'modal',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="paywall" 
        options={{ 
          presentation: 'modal',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="privacy-policy" 
        options={{ 
          presentation: 'modal',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="terms-of-service" 
        options={{ 
          presentation: 'modal',
          headerShown: false,
        }} 
      />
    </Stack>
  );
}

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <PerformanceProvider>
          <OnboardingProvider>
            <SubscriptionProvider>
              <RecipeProvider>
                {children}
              </RecipeProvider>
            </SubscriptionProvider>
          </OnboardingProvider>
        </PerformanceProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <AppProviders>
          <RootLayoutNav />
        </AppProviders>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
