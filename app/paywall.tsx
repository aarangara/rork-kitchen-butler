import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  X,
  Crown,
  BookOpen,
  ShoppingBasket,
  Sparkles,
  Infinity as InfinityIcon,
  Check,
  Zap,
  Shield,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { useSubscription, FREE_LIMITS } from '@/providers/SubscriptionProvider';
import type { PurchasesPackage } from 'react-native-purchases';

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Unlimited Recipes',
    desc: `Save as many recipes as you want (free: ${FREE_LIMITS.maxRecipes})`,
    color: '#E8856D',
  },
  {
    icon: ShoppingBasket,
    title: 'Unlimited Pantry Items',
    desc: `Track everything in your kitchen (free: ${FREE_LIMITS.maxPantryItems})`,
    color: '#8BA888',
  },
  {
    icon: Sparkles,
    title: 'Unlimited Suggestions',
    desc: `Get meal ideas anytime (free: ${FREE_LIMITS.maxSuggestionsPerDay}/day)`,
    color: '#5B8FB9',
  },
  {
    icon: Zap,
    title: 'Priority Features',
    desc: 'Early access to new features & updates',
    color: '#FFB347',
  },
  {
    icon: Shield,
    title: 'Support Development',
    desc: 'Help us keep building & improving',
    color: '#DDA0DD',
  },
];

export default function PaywallScreen() {
  console.log('[PaywallScreen] Rendering paywall screen');
  const router = useRouter();
  const {
    isPremium,
    upgradeToPremium,
    offerings,
    isLoadingOfferings,
    isPurchasing,
    purchaseError,
    restorePurchases,
    isRestoring,
  } = useSubscription();
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const wasPremium = useRef<boolean>(isPremium);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const crownScale = useRef(new Animated.Value(0.3)).current;
  const featureAnims = useRef(FEATURES.map(() => new Animated.Value(0))).current;

  console.log('[PaywallScreen] isPremium:', isPremium);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(crownScale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    featureAnims.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 350,
        delay: 200 + index * 80,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const formatPackageLabel = useCallback((pkg: PurchasesPackage) => {
    const period = pkg.product?.subscriptionPeriod ?? '';
    if (pkg.identifier === 'annual') return 'Yearly';
    if (pkg.identifier === 'monthly') return 'Monthly';
    if (period.toLowerCase().includes('year')) return 'Yearly';
    if (period.toLowerCase().includes('month')) return 'Monthly';
    return pkg.identifier;
  }, []);

  const packages = useMemo<PurchasesPackage[]>(() => {
    const monthly = offerings?.availablePackages?.find(pkg => pkg.identifier === 'monthly');
    const annual = offerings?.availablePackages?.find(pkg => pkg.identifier === 'annual');
    const all = [monthly, annual].filter(Boolean) as PurchasesPackage[];
    return all.length > 0 ? all : offerings?.availablePackages ?? [];
  }, [offerings]);

  const selectedLabel = useMemo(() => {
    if (selectedPackage) return formatPackageLabel(selectedPackage);
    if (packages[0]) return formatPackageLabel(packages[0]);
    return 'Monthly';
  }, [selectedPackage, packages, formatPackageLabel]);

  const selectedPrice = useMemo(() => {
    if (selectedPackage?.product?.priceString) return selectedPackage.product.priceString;
    if (packages[0]?.product?.priceString) return packages[0].product.priceString;
    return selectedLabel === 'Yearly' ? '£70' : '£7';
  }, [selectedPackage, packages]);

  useEffect(() => {
    if (!selectedPackage && packages.length > 0) {
      setSelectedPackage(packages[0]);
    }
  }, [packages, selectedPackage]);

  const handleUpgrade = useCallback(() => {
    if (!selectedPackage) {
      Alert.alert('Choose a plan', 'Please select a plan to continue.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    upgradeToPremium(selectedPackage);
  }, [selectedPackage, upgradeToPremium]);

  const handleRestore = useCallback(() => {
    restorePurchases();
  }, [restorePurchases]);

  useEffect(() => {
    if (!wasPremium.current && isPremium) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        'Welcome to Premium!',
        'You now have unlimited access to all features.',
        [{ text: 'Let\'s Cook!', onPress: () => router.back() }]
      );
    }
    wasPremium.current = isPremium;
  }, [isPremium, router]);

  if (isPremium) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.alreadyPremium}>
          <Crown size={48} color="#FFB347" />
          <Text style={styles.alreadyTitle}>You{"'"}re Premium!</Text>
          <Text style={styles.alreadyDesc}>You already have unlimited access to everything.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} testID="paywall-back">
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID="paywall-close"
        >
          <X size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="paywall-scroll"
      >
        <Animated.View
          style={[
            styles.heroSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Animated.View
            style={[styles.crownContainer, { transform: [{ scale: crownScale }] }]}
          >
            <View style={styles.crownGlow} />
            <Crown size={44} color="#FFB347" />
          </Animated.View>
          <Text style={styles.heroTitle}>Unlock Everything</Text>
          <Text style={styles.heroSubtitle}>
            Go unlimited and never worry about limits again
          </Text>
        </Animated.View>

        <View style={styles.featuresSection}>
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Animated.View
                key={feature.title}
                style={[
                  styles.featureRow,
                  {
                    opacity: featureAnims[index],
                    transform: [
                      {
                        translateX: featureAnims[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [-30, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={[styles.featureIcon, { backgroundColor: feature.color + '20' }]}>
                  <Icon size={22} color={feature.color} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDesc}>{feature.desc}</Text>
                </View>
                <View style={styles.featureCheck}>
                  <Check size={16} color={colors.white} />
                </View>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.comparisonCard}>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel} />
            <Text style={styles.comparisonFree}>Free</Text>
            <Text style={styles.comparisonPro}>Pro</Text>
          </View>
          <View style={styles.comparisonDivider} />
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Recipes</Text>
            <Text style={styles.comparisonFreeVal}>{FREE_LIMITS.maxRecipes}</Text>
            <View style={styles.infinityWrap}>
              <InfinityIcon size={16} color="#FFB347" />
            </View>
          </View>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Pantry Items</Text>
            <Text style={styles.comparisonFreeVal}>{FREE_LIMITS.maxPantryItems}</Text>
            <View style={styles.infinityWrap}>
              <InfinityIcon size={16} color="#FFB347" />
            </View>
          </View>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Daily Suggestions</Text>
            <Text style={styles.comparisonFreeVal}>{FREE_LIMITS.maxSuggestionsPerDay}</Text>
            <View style={styles.infinityWrap}>
              <InfinityIcon size={16} color="#FFB347" />
            </View>
          </View>
        </View>

        <View style={styles.planSection}>
          <Text style={styles.planTitle}>Choose your plan</Text>
          <Text style={styles.planSubtitle}>4-week free trial, then pay anytime</Text>
          {isLoadingOfferings && (
            <Text style={styles.planLoading}>Loading plans...</Text>
          )}
          {!isLoadingOfferings && packages.length === 0 && (
            <Text style={styles.planError}>Plans are unavailable right now. Please try again later.</Text>
          )}
          {packages.map((pkg) => {
            const isSelected = selectedPackage?.identifier === pkg.identifier;
            return (
              <TouchableOpacity
                key={pkg.identifier}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                onPress={() => setSelectedPackage(pkg)}
                activeOpacity={0.8}
                testID={`paywall-plan-${pkg.identifier}`}
              >
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>{formatPackageLabel(pkg)}</Text>
                  <Text style={styles.planPrice}>
                    {pkg.product?.priceString ?? (pkg.identifier === 'annual' ? '£70' : '£7')}
                    <Text style={styles.planPeriod}>/{formatPackageLabel(pkg).toLowerCase()}</Text>
                  </Text>
                </View>
                <View style={[styles.planCheck, isSelected && styles.planCheckSelected]}>
                  <Check size={16} color={isSelected ? colors.white : colors.textLight} />
                </View>
              </TouchableOpacity>
            );
          })}
          {purchaseError && (
            <Text style={styles.planError}>Purchase failed. Please try again.</Text>
          )}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            activeOpacity={0.8}
            disabled={isRestoring}
            testID="paywall-restore"
          >
            <RefreshCw size={14} color={colors.textSecondary} />
            <Text style={styles.restoreText}>{isRestoring ? 'Restoring...' : 'Restore Purchases'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 180 }} />
      </ScrollView>

      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <TouchableOpacity
          style={[styles.purchaseBtn, (!selectedPackage || isPurchasing) && styles.purchaseBtnDisabled]}
          onPress={handleUpgrade}
          activeOpacity={0.8}
          disabled={!selectedPackage || isPurchasing}
          testID="paywall-purchase"
        >
          <Crown size={18} color={colors.white} />
          <Text style={styles.purchaseBtnText}>
            {isPurchasing ? 'Processing...' : 'Start Free Trial'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.trialDisclaimer}>
          {selectedPrice} per {selectedLabel.toLowerCase()} after 4-week trial. Cancel anytime.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeButton: {
    alignSelf: 'flex-end',
    margin: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warmGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  crownContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF8ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  crownGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFB34710',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  featuresSection: {
    gap: 12,
    marginBottom: 28,
  },
  planSection: {
    marginTop: 24,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text,
  },
  planSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  planLoading: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  planError: {
    fontSize: 12,
    color: colors.error,
  },
  planCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.warmGray,
  },
  planInfo: {
    gap: 4,
  },
  planName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.primaryDark,
  },
  planPeriod: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.textSecondary,
  },
  planCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCheckSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  restoreText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 14,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  featureCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comparisonCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500' as const,
  },
  comparisonFree: {
    width: 60,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  comparisonPro: {
    width: 60,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFB347',
  },
  comparisonDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
  comparisonFreeVal: {
    width: 60,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.textLight,
  },
  infinityWrap: {
    width: 60,
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  purchaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 28,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  purchaseBtnDisabled: {
    opacity: 0.6,
  },
  purchaseBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.white,
  },
  trialDisclaimer: {
    fontSize: 11,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },
  alreadyPremium: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  alreadyTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text,
  },
  alreadyDesc: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 8,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
