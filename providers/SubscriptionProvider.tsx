import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  PurchasesOfferings,
  CustomerInfo,
} from 'react-native-purchases';

const USAGE_KEY = 'helpmecook_daily_usage';
const SUBSCRIPTION_KEY = 'helpmecook_subscription';
const RC_ENTITLEMENT = 'pro';

function getRCToken(): string | undefined {
  if (__DEV__ || Platform.OS === 'web') return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY,
  });
}

let rcConfigured = false;
function ensureRCConfigured() {
  if (rcConfigured || Platform.OS === 'web') return;
  const key = getRCToken();
  if (key) {
    console.log('[RevenueCat] Configuring Purchases');
    Purchases.configure({ apiKey: key });
    rcConfigured = true;
  } else {
    console.warn('[RevenueCat] Missing API key. Purchases not configured.');
  }
}


export type PlanType = 'free' | 'premium';

export interface SubscriptionState {
  plan: PlanType;
  subscribedAt: string | null;
  expiresAt: string | null;
}

interface DailyUsage {
  date: string;
  suggestionsUsed: number;
}

export const FREE_LIMITS = {
  maxRecipes: 30,
  maxPantryItems: 50,
  maxSuggestionsPerDay: 3,
} as const;

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>({ date: getTodayKey(), suggestionsUsed: 0 });
  const [subscription, setSubscription] = useState<SubscriptionState>({
    plan: 'free',
    subscribedAt: null,
    expiresAt: null,
  });

  useEffect(() => {
    ensureRCConfigured();
  }, []);

  const { mutate: saveUsage } = useMutation({
    mutationFn: async (usage: DailyUsage) => {
      await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(usage));
      return usage;
    },
  });

  const { mutate: saveSubscription } = useMutation({
    mutationFn: async (sub: SubscriptionState) => {
      await AsyncStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(sub));
      return sub;
    },
  });

  const subscriptionQuery = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(SUBSCRIPTION_KEY);
        if (stored) {
          return JSON.parse(stored) as SubscriptionState;
        }
        return { plan: 'free' as PlanType, subscribedAt: null, expiresAt: null };
      } catch (error) {
        console.error('[Subscription] Failed to load subscription:', error);
        return { plan: 'free' as PlanType, subscribedAt: null, expiresAt: null };
      }
    },
  });

  const isNative = Platform.OS !== 'web';

  const offeringsQuery = useQuery({
    queryKey: ['rcOfferings'],
    queryFn: async (): Promise<PurchasesOfferings> => {
      console.log('[RevenueCat] Fetching offerings');
      return Purchases.getOfferings();
    },
    enabled: isNative && rcConfigured,
  });

  const customerInfoQuery = useQuery({
    queryKey: ['rcCustomerInfo'],
    queryFn: async (): Promise<CustomerInfo> => {
      console.log('[RevenueCat] Fetching customer info');
      return Purchases.getCustomerInfo();
    },
    enabled: isNative && rcConfigured,
  });

  const usageQuery = useQuery({
    queryKey: ['dailyUsage'],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(USAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as DailyUsage;
          if (parsed.date === getTodayKey()) {
            return parsed;
          }
        }
        return { date: getTodayKey(), suggestionsUsed: 0 };
      } catch (error) {
        console.error('[Subscription] Failed to load daily usage:', error);
        return { date: getTodayKey(), suggestionsUsed: 0 };
      }
    },
  });

  useEffect(() => {
    if (usageQuery.data) {
      setDailyUsage(usageQuery.data);
    }
  }, [usageQuery.data]);

  useEffect(() => {
    if (subscriptionQuery.data) {
      setSubscription(subscriptionQuery.data);
    }
  }, [subscriptionQuery.data]);

  useEffect(() => {
    if (!customerInfoQuery.data) return;
    const entitlement = customerInfoQuery.data.entitlements.active?.[RC_ENTITLEMENT];
    if (entitlement) {
      const newSub: SubscriptionState = {
        plan: 'premium',
        subscribedAt: entitlement.originalPurchaseDate ?? new Date().toISOString(),
        expiresAt: entitlement.expirationDate ?? null,
      };
      setSubscription(newSub);
      saveSubscription(newSub);
      console.log('[RevenueCat] Active entitlement detected');
      return;
    }
    const newSub: SubscriptionState = {
      plan: 'free',
      subscribedAt: null,
      expiresAt: null,
    };
    setSubscription(newSub);
    saveSubscription(newSub);
    console.log('[RevenueCat] No active entitlement');
  }, [customerInfoQuery.data, saveSubscription]);

  const isPremium = useMemo(() => {
    return subscription.plan === 'premium';
  }, [subscription.plan]);

  const suggestionsRemaining = useMemo(() => {
    if (isPremium) return Infinity;
    const today = getTodayKey();
    if (dailyUsage.date !== today) return FREE_LIMITS.maxSuggestionsPerDay;
    return Math.max(0, FREE_LIMITS.maxSuggestionsPerDay - dailyUsage.suggestionsUsed);
  }, [isPremium, dailyUsage]);

  const useSuggestion = useCallback(() => {
    if (isPremium) return true;
    const today = getTodayKey();
    const current = dailyUsage.date === today ? dailyUsage.suggestionsUsed : 0;
    if (current >= FREE_LIMITS.maxSuggestionsPerDay) return false;
    const updated: DailyUsage = { date: today, suggestionsUsed: current + 1 };
    setDailyUsage(updated);
    saveUsage(updated);
    return true;
  }, [isPremium, dailyUsage, saveUsage]);

  const canAddRecipe = useCallback((currentCount: number) => {
    if (isPremium) return true;
    return currentCount < FREE_LIMITS.maxRecipes;
  }, [isPremium]);

  const canAddPantryItem = useCallback((currentCount: number) => {
    if (isPremium) return true;
    return currentCount < FREE_LIMITS.maxPantryItems;
  }, [isPremium]);

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage): Promise<CustomerInfo> => {
      console.log('[RevenueCat] Purchasing package', pkg.identifier);
      const result = await Purchases.purchasePackage(pkg);
      return result.customerInfo;
    },
    onSuccess: (info) => {
      console.log('[RevenueCat] Purchase success');
      customerInfoQuery.refetch();
      const entitlement = info.entitlements.active?.[RC_ENTITLEMENT];
      if (entitlement) {
        const newSub: SubscriptionState = {
          plan: 'premium',
          subscribedAt: entitlement.originalPurchaseDate ?? new Date().toISOString(),
          expiresAt: entitlement.expirationDate ?? null,
        };
        setSubscription(newSub);
        saveSubscription(newSub);
      }
    },
    onError: (error) => {
      console.error('[RevenueCat] Purchase failed:', error);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (): Promise<CustomerInfo> => {
      console.log('[RevenueCat] Restoring purchases');
      return Purchases.restorePurchases();
    },
    onSuccess: () => {
      console.log('[RevenueCat] Restore success');
      customerInfoQuery.refetch();
    },
    onError: (error) => {
      console.error('[RevenueCat] Restore failed:', error);
    },
  });

  const { mutate: purchasePkg } = purchaseMutation;
  const upgradeToPremium = useCallback((pkg: PurchasesPackage) => {
    purchasePkg(pkg);
  }, [purchasePkg]);

  const downgradeToFree = useCallback(() => {
    const newSub: SubscriptionState = {
      plan: 'free',
      subscribedAt: null,
      expiresAt: null,
    };
    setSubscription(newSub);
    saveSubscription(newSub);
    console.log('[Subscription] Downgraded to free');
  }, [saveSubscription]);

  return {
    isPremium,
    suggestionsRemaining,
    useSuggestion,
    canAddRecipe,
    canAddPantryItem,
    upgradeToPremium,
    downgradeToFree,
    offerings: offeringsQuery.data?.current ?? null,
    isLoadingOfferings: offeringsQuery.isLoading,
    purchaseError: purchaseMutation.error,
    isPurchasing: purchaseMutation.isPending,
    restorePurchases: restoreMutation.mutate,
    isRestoring: restoreMutation.isPending,
  };
});
