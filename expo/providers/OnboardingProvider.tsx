import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

const ONBOARDING_KEY = 'kitchenbutler_onboarding';
const USER_PREFS_KEY = 'kitchenbutler_user_prefs';

export interface UserPreferences {
  cookingLevel: 'beginner' | 'intermediate' | 'advanced' | null;
  dietaryRestrictions: string[];
  cuisinePreferences: string[];
  householdSize: number;
  notificationsEnabled: boolean;
}

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentStep: number;
  completedAt: string | null;
}

const DEFAULT_PREFS: UserPreferences = {
  cookingLevel: null,
  dietaryRestrictions: [],
  cuisinePreferences: [],
  householdSize: 2,
  notificationsEnabled: true,
};

const DEFAULT_STATE: OnboardingState = {
  hasCompletedOnboarding: false,
  currentStep: 0,
  completedAt: null,
};

export const [OnboardingProvider, useOnboarding] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(DEFAULT_STATE);
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [isReady, setIsReady] = useState(false);

  const onboardingQuery = useQuery({
    queryKey: ['onboarding'],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (stored) {
          return JSON.parse(stored) as OnboardingState;
        }
        return DEFAULT_STATE;
      } catch (error) {
        console.error('Failed to load onboarding state:', error);
        return DEFAULT_STATE;
      }
    },
  });

  const prefsQuery = useQuery({
    queryKey: ['userPrefs'],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_PREFS_KEY);
        if (stored) {
          return JSON.parse(stored) as UserPreferences;
        }
        return DEFAULT_PREFS;
      } catch (error) {
        console.error('Failed to load user prefs:', error);
        return DEFAULT_PREFS;
      }
    },
  });

  useEffect(() => {
    if (onboardingQuery.data) {
      setOnboardingState(onboardingQuery.data);
    }
  }, [onboardingQuery.data]);

  useEffect(() => {
    if (prefsQuery.data) {
      setUserPrefs(prefsQuery.data);
    }
  }, [prefsQuery.data]);

  useEffect(() => {
    if (!onboardingQuery.isLoading && !prefsQuery.isLoading) {
      setIsReady(true);
    }
  }, [onboardingQuery.isLoading, prefsQuery.isLoading]);

  const { mutate: saveOnboardingState } = useMutation({
    mutationFn: async (state: OnboardingState) => {
      await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
      return state;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  const { mutate: saveUserPrefs } = useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      await AsyncStorage.setItem(USER_PREFS_KEY, JSON.stringify(prefs));
      return prefs;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPrefs'] });
    },
  });

  const completeOnboarding = useCallback(() => {
    const newState: OnboardingState = {
      hasCompletedOnboarding: true,
      currentStep: -1,
      completedAt: new Date().toISOString(),
    };
    setOnboardingState(newState);
    saveOnboardingState(newState);
    console.log('Onboarding completed');
  }, [saveOnboardingState]);

  const setCurrentStep = useCallback((step: number) => {
    const newState = { ...onboardingState, currentStep: step };
    setOnboardingState(newState);
    saveOnboardingState(newState);
  }, [onboardingState, saveOnboardingState]);

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    const newPrefs = { ...userPrefs, ...updates };
    setUserPrefs(newPrefs);
    saveUserPrefs(newPrefs);
    console.log('User preferences updated:', updates);
  }, [userPrefs, saveUserPrefs]);

  const resetOnboarding = useCallback(async () => {
    setOnboardingState(DEFAULT_STATE);
    setUserPrefs(DEFAULT_PREFS);
    await AsyncStorage.multiRemove([ONBOARDING_KEY, USER_PREFS_KEY]);
    queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    queryClient.invalidateQueries({ queryKey: ['userPrefs'] });
    console.log('Onboarding reset');
  }, [queryClient]);

  return {
    hasCompletedOnboarding: onboardingState.hasCompletedOnboarding,
    currentStep: onboardingState.currentStep,
    userPrefs,
    isReady,
    isLoading: onboardingQuery.isLoading || prefsQuery.isLoading,
    completeOnboarding,
    setCurrentStep,
    updatePreferences,
    resetOnboarding,
  };
});
