import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { 
  ChefHat, 
  ShoppingBasket, 
  Sparkles, 
  ArrowRight,
  Check,
  Users,
  Flame,
  Clock,
  Crown,
  BookOpen,
  Zap,
  Gift,
  Infinity as InfinityIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useOnboarding, UserPreferences } from '@/providers/OnboardingProvider';
import { useSubscription, FREE_LIMITS } from '@/providers/SubscriptionProvider';
import colors from '@/constants/colors';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to Kitchen Butler',
    subtitle: 'Your personal kitchen companion that makes cooking effortless and enjoyable',
    icon: <ChefHat size={48} color={colors.white} strokeWidth={1.5} />,
    gradient: [colors.primary, colors.primaryDark],
  },
  {
    id: 'pantry',
    title: 'Track Your Pantry',
    subtitle: 'Know exactly what ingredients you have at home, always',
    icon: <ShoppingBasket size={48} color={colors.white} strokeWidth={1.5} />,
    gradient: ['#5B8FB9', '#3A6B8C'],
  },
  {
    id: 'match',
    title: 'Smart Matching',
    subtitle: 'Discover delicious recipes using what you already have',
    icon: <Sparkles size={48} color={colors.white} strokeWidth={1.5} />,
    gradient: ['#9B7EBD', '#7A5BA1'],
  },
];

const COOKING_LEVELS = [
  { id: 'beginner', label: 'Beginner', icon: <Clock size={24} color={colors.primary} />, desc: 'Just starting out' },
  { id: 'intermediate', label: 'Intermediate', icon: <Flame size={24} color={colors.primary} />, desc: 'Comfortable cooking' },
  { id: 'advanced', label: 'Advanced', icon: <ChefHat size={24} color={colors.primary} />, desc: 'Kitchen pro' },
];

const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten-Free' },
  { id: 'dairy-free', label: 'Dairy-Free' },
  { id: 'keto', label: 'Keto' },
  { id: 'none', label: 'None' },
];

const HOUSEHOLD_SIZES = [1, 2, 3, 4, 5];

const PRO_FEATURES = [
  { icon: BookOpen, title: 'Unlimited Recipes', desc: `Free: ${FREE_LIMITS.maxRecipes}`, color: '#E8856D' },
  { icon: ShoppingBasket, title: 'Unlimited Pantry', desc: `Free: ${FREE_LIMITS.maxPantryItems}`, color: '#8BA888' },
  { icon: Sparkles, title: 'Unlimited Suggestions', desc: `Free: ${FREE_LIMITS.maxSuggestionsPerDay}/day`, color: '#5B8FB9' },
  { icon: Zap, title: 'Priority Features', desc: 'Early access', color: '#FFB347' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding, updatePreferences } = useOnboarding();
  const { isPremium } = useSubscription();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPreferences, setShowPreferences] = useState(false);
  const [prefsStep, setPrefsStep] = useState(0);

  const PREFS_STEPS_COUNT = 4;
  console.log('[Onboarding] RENDER v2 | totalSteps:', SLIDES.length + PREFS_STEPS_COUNT, 'currentIndex:', currentIndex, 'prefsStep:', prefsStep, 'showPreferences:', showPreferences);
  
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [householdSize, setHouseholdSize] = useState(2);
  
  const scrollX = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const totalSteps = SLIDES.length + PREFS_STEPS_COUNT;
  const currentStep = showPreferences ? SLIDES.length + prefsStep : currentIndex;

  const handleComplete = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    const prefs: Partial<UserPreferences> = {
      cookingLevel: selectedLevel as UserPreferences['cookingLevel'],
      dietaryRestrictions: selectedDietary.filter(d => d !== 'none'),
      householdSize,
    };
    updatePreferences(prefs);
    completeOnboarding();
    router.replace('/(tabs)');
  }, [selectedLevel, selectedDietary, householdSize, updatePreferences, completeOnboarding]);

  const handleStartTrial = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (isPremium) {
      handleComplete();
      return;
    }
    router.push('/paywall');
  }, [isPremium, handleComplete]);

  const handleNext = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    if (!showPreferences && currentIndex < SLIDES.length - 1) {
      Animated.spring(scrollX, {
        toValue: (currentIndex + 1) * width,
        useNativeDriver: true,
      }).start();
      setCurrentIndex(currentIndex + 1);
    } else if (!showPreferences) {
      setShowPreferences(true);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (prefsStep < 3) {
      setPrefsStep(prefsStep + 1);
    } else {
      handleComplete();
    }
  }, [currentIndex, showPreferences, prefsStep, scrollX, slideAnim, handleComplete]);

  const handleBack = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    if (showPreferences && prefsStep > 0) {
      setPrefsStep(prefsStep - 1);
    } else if (showPreferences) {
      setShowPreferences(false);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (currentIndex > 0) {
      Animated.spring(scrollX, {
        toValue: (currentIndex - 1) * width,
        useNativeDriver: true,
      }).start();
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex, showPreferences, prefsStep, scrollX, slideAnim]);

  const handleSkip = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    completeOnboarding();
    router.replace('/(tabs)');
  }, [completeOnboarding]);

  const toggleDietary = useCallback((id: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    
    if (id === 'none') {
      setSelectedDietary(['none']);
    } else {
      setSelectedDietary(prev => {
        const filtered = prev.filter(d => d !== 'none');
        if (filtered.includes(id)) {
          return filtered.filter(d => d !== id);
        }
        return [...filtered, id];
      });
    }
  }, []);

  const renderSlide = () => {
    const slide = SLIDES[currentIndex];
    
    return (
      <View style={styles.slide}>
        <View style={[styles.iconContainer, { backgroundColor: slide.gradient[0] }]}>
          {slide.icon}
        </View>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
        
        <View style={styles.decorDots}>
          <View style={[styles.decorDot, { backgroundColor: slide.gradient[0], opacity: 0.3 }]} />
          <View style={[styles.decorDot, { backgroundColor: slide.gradient[0], opacity: 0.5, width: 8, height: 8 }]} />
          <View style={[styles.decorDot, { backgroundColor: slide.gradient[0], opacity: 0.3 }]} />
        </View>
      </View>
    );
  };

  const renderCookingLevel = () => (
    <View style={styles.prefsContainer}>
      <View style={styles.prefsHeader}>
        <Text style={styles.prefsTitle}>Your cooking level?</Text>
        <Text style={styles.prefsSubtitle}>This helps us recommend the right recipes</Text>
      </View>
      
      <View style={styles.levelOptions}>
        {COOKING_LEVELS.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={[
              styles.levelCard,
              selectedLevel === level.id && styles.levelCardSelected,
            ]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              setSelectedLevel(level.id);
            }}
            activeOpacity={0.7}
          >
            <View style={[
              styles.levelIconWrap,
              selectedLevel === level.id && styles.levelIconWrapSelected,
            ]}>
              {level.icon}
            </View>
            <View style={styles.levelText}>
              <Text style={[
                styles.levelLabel,
                selectedLevel === level.id && styles.levelLabelSelected,
              ]}>
                {level.label}
              </Text>
              <Text style={styles.levelDesc}>{level.desc}</Text>
            </View>
            {selectedLevel === level.id && (
              <View style={styles.checkMark}>
                <Check size={16} color={colors.white} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderDietaryPrefs = () => (
    <View style={styles.prefsContainer}>
      <View style={styles.prefsHeader}>
        <Text style={styles.prefsTitle}>Dietary preferences?</Text>
        <Text style={styles.prefsSubtitle}>Select all that apply</Text>
      </View>
      
      <View style={styles.dietaryGrid}>
        {DIETARY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.dietaryChip,
              selectedDietary.includes(option.id) && styles.dietaryChipSelected,
            ]}
            onPress={() => toggleDietary(option.id)}
            activeOpacity={0.7}
          >
            {selectedDietary.includes(option.id) && (
              <Check size={16} color={colors.secondaryDark} style={styles.dietaryCheck} />
            )}
            <Text style={[
              styles.dietaryLabel,
              selectedDietary.includes(option.id) && styles.dietaryLabelSelected,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderHouseholdSize = () => (
    <View style={styles.prefsContainer}>
      <View style={styles.prefsHeader}>
        <Text style={styles.prefsTitle}>Cooking for how many?</Text>
        <Text style={styles.prefsSubtitle}>We&apos;ll adjust portion sizes accordingly</Text>
      </View>
      
      <View style={styles.householdContainer}>
        <View style={styles.householdVisual}>
          <Users size={80} color={colors.borderLight} strokeWidth={1} />
          <View style={styles.householdBadge}>
            <Text style={styles.householdBadgeText}>
              {householdSize === 5 ? '5+' : householdSize}
            </Text>
          </View>
        </View>
        
        <Text style={styles.householdLabel}>
          {householdSize === 1 ? 'Just me' : householdSize === 5 ? '5+ people' : `${householdSize} people`}
        </Text>
        
        <View style={styles.householdRow}>
          {HOUSEHOLD_SIZES.map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.householdButton,
                householdSize === size && styles.householdButtonSelected,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                setHouseholdSize(size);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.householdNumber,
                householdSize === size && styles.householdNumberSelected,
              ]}>
                {size === 5 ? '5+' : size}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderPaywallStep = () => (
    <View style={styles.prefsContainer}>
      <View style={styles.paywallHeader}>
        <View style={styles.paywallCrown}>
          <Crown size={36} color="#FFB347" />
        </View>
        <Text style={styles.prefsTitle}>Try Pro Free for 4 Weeks</Text>
        <Text style={styles.prefsSubtitle}>Unlock everything with no commitment</Text>
      </View>

      <View style={styles.proFeaturesList}>
        {PRO_FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <View key={feature.title} style={styles.proFeatureRow}>
              <View style={[styles.proFeatureIcon, { backgroundColor: feature.color + '18' }]}> 
                <Icon size={20} color={feature.color} />
              </View>
              <View style={styles.proFeatureText}>
                <Text style={styles.proFeatureTitle}>{feature.title}</Text>
                <Text style={styles.proFeatureDesc}>{feature.desc}</Text>
              </View>
              <View style={styles.proFeatureCheck}>
                <Check size={14} color={colors.white} />
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.paywallCompare}>
        <View style={styles.paywallCompareRow}>
          <Text style={styles.paywallCompareLabel} />
          <Text style={styles.paywallCompareFree}>Free</Text>
          <Text style={styles.paywallComparePro}>Pro</Text>
        </View>
        <View style={styles.paywallCompareDivider} />
        <View style={styles.paywallCompareRow}>
          <Text style={styles.paywallCompareLabel}>Recipes</Text>
          <Text style={styles.paywallCompareVal}>{FREE_LIMITS.maxRecipes}</Text>
          <View style={styles.paywallInfinity}><InfinityIcon size={14} color="#FFB347" /></View>
        </View>
        <View style={styles.paywallCompareRow}>
          <Text style={styles.paywallCompareLabel}>Pantry</Text>
          <Text style={styles.paywallCompareVal}>{FREE_LIMITS.maxPantryItems}</Text>
          <View style={styles.paywallInfinity}><InfinityIcon size={14} color="#FFB347" /></View>
        </View>
        <View style={styles.paywallCompareRow}>
          <Text style={styles.paywallCompareLabel}>Suggestions</Text>
          <Text style={styles.paywallCompareVal}>{FREE_LIMITS.maxSuggestionsPerDay}/day</Text>
          <View style={styles.paywallInfinity}><InfinityIcon size={14} color="#FFB347" /></View>
        </View>
      </View>

      <View style={styles.paywallPriceInfo}>
        <Gift size={16} color="#FFB347" />
        <Text style={styles.paywallPriceText}>4 weeks free, then <Text style={styles.paywallPriceBold}>{"\u00A3"}7/month</Text></Text>
      </View>
    </View>
  );

  const renderPrefsContent = () => {
    switch (prefsStep) {
      case 0:
        return renderCookingLevel();
      case 1:
        return renderDietaryPrefs();
      case 2:
        return renderHouseholdSize();
      case 3:
        return renderPaywallStep();
      default:
        return null;
    }
  };

  const canProceed = () => {
    if (!showPreferences) return true;
    if (prefsStep === 0) return selectedLevel !== null;
    return true;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {(currentIndex > 0 || showPreferences) ? (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        ) : <View style={styles.backButton} />}
        
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentStep + 1) / totalSteps) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{currentStep + 1} of {totalSteps}</Text>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {!showPreferences ? renderSlide() : renderPrefsContent()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        {prefsStep === 3 && showPreferences ? (
          <>
            <TouchableOpacity
              style={styles.trialButton}
              onPress={handleStartTrial}
              activeOpacity={0.8}
            >
              <Crown size={18} color={colors.white} />
              <Text style={styles.trialButtonText}>Start Free Trial</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.maybeLaterBtn}
              onPress={handleComplete}
              activeOpacity={0.7}
            >
              <Text style={styles.maybeLaterText}>Maybe Later</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.nextButton,
              !canProceed() && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!canProceed()}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
            <ArrowRight size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    width: 60,
    height: 40,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 16,
    color: colors.textLight,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 13,
    color: colors.textLight,
    fontWeight: '500' as const,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  slide: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  slideTitle: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  slideSubtitle: {
    fontSize: 17,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  decorDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
  },
  decorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  prefsContainer: {
    paddingVertical: 12,
  },
  prefsHeader: {
    marginBottom: 32,
  },
  prefsTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  prefsSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  levelOptions: {
    gap: 14,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: colors.borderLight,
  },
  levelCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF8F6',
  },
  levelIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelIconWrapSelected: {
    backgroundColor: '#FFE8E3',
  },
  levelText: {
    flex: 1,
    marginLeft: 16,
  },
  levelLabel: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 4,
  },
  levelLabelSelected: {
    color: colors.primary,
  },
  levelDesc: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  checkMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dietaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  dietaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.borderLight,
    gap: 6,
  },
  dietaryChipSelected: {
    borderColor: colors.secondary,
    backgroundColor: '#F0F7EF',
  },
  dietaryCheck: {
    marginRight: 2,
  },
  dietaryLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.text,
  },
  dietaryLabelSelected: {
    color: colors.secondaryDark,
  },
  householdContainer: {
    alignItems: 'center',
  },
  householdVisual: {
    position: 'relative',
    marginBottom: 24,
  },
  householdBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  householdBadgeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.white,
  },
  householdLabel: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 24,
  },
  householdRow: {
    flexDirection: 'row',
    gap: 12,
  },
  householdButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.borderLight,
  },
  householdButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF8F6',
  },
  householdNumber: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  householdNumberSelected: {
    color: colors.primary,
  },
  paywallHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  paywallCrown: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF8ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  proFeaturesList: {
    gap: 10,
    marginBottom: 20,
  },
  proFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  proFeatureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proFeatureText: {
    flex: 1,
  },
  proFeatureTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 1,
  },
  proFeatureDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  proFeatureCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallCompare: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  paywallCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paywallCompareLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.text,
  },
  paywallCompareFree: {
    width: 56,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  paywallComparePro: {
    width: 56,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFB347',
  },
  paywallCompareDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
  paywallCompareVal: {
    width: 56,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.textLight,
  },
  paywallInfinity: {
    width: 56,
    alignItems: 'center',
  },
  paywallPriceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFB34712',
    borderWidth: 1,
    borderColor: '#FFB34728',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  paywallPriceText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  paywallPriceBold: {
    fontWeight: '700' as const,
    color: colors.text,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: colors.background,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonDisabled: {
    backgroundColor: colors.textLight,
    shadowOpacity: 0,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.white,
  },
  trialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFB347',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#FFB347',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  trialButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.white,
  },
  maybeLaterBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  maybeLaterText: {
    fontSize: 15,
    color: colors.textLight,
    fontWeight: '500' as const,
  },
});
