import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChefHat, 
  Clock, 
  Flame, 
  Users, 
  Check,
  ChevronRight,
  Leaf,
  Crown,
  BookOpen,
  ShoppingBasket,
  Sparkles,
  Cloud,
  RefreshCw,
  Shield,
  FileText,
  Info,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { useOnboarding, UserPreferences } from '@/providers/OnboardingProvider';
import { useSubscription, FREE_LIMITS } from '@/providers/SubscriptionProvider';
import { useRecipes } from '@/providers/RecipeProvider';

const COOKING_LEVELS = [
  { id: 'beginner', label: 'Beginner', icon: Clock, desc: 'Just starting out' },
  { id: 'intermediate', label: 'Intermediate', icon: Flame, desc: 'Comfortable cooking' },
  { id: 'advanced', label: 'Advanced', icon: ChefHat, desc: 'Kitchen pro' },
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

type SectionType = 'level' | 'dietary' | 'household' | null;

export default function SettingsScreen() {
  const router = useRouter();
  const { userPrefs, updatePreferences } = useOnboarding();
  const { isPremium, suggestionsRemaining } = useSubscription();
  const { stats, backendEnabled, isSyncing, lastSyncTime, syncToBackend } = useRecipes();
  const [expandedSection, setExpandedSection] = useState<SectionType>(null);
  const [isSyncingManually, setIsSyncingManually] = useState(false);

  const toggleSection = useCallback((section: SectionType) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedSection(prev => prev === section ? null : section);
  }, []);

  const handleLevelSelect = useCallback((level: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    updatePreferences({ cookingLevel: level as UserPreferences['cookingLevel'] });
  }, [updatePreferences]);

  const handleDietaryToggle = useCallback((id: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    
    if (id === 'none') {
      updatePreferences({ dietaryRestrictions: [] });
    } else {
      const current = userPrefs.dietaryRestrictions;
      if (current.includes(id)) {
        updatePreferences({ dietaryRestrictions: current.filter(d => d !== id) });
      } else {
        updatePreferences({ dietaryRestrictions: [...current, id] });
      }
    }
  }, [userPrefs.dietaryRestrictions, updatePreferences]);

  const handleHouseholdSelect = useCallback((size: number) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    updatePreferences({ householdSize: size });
  }, [updatePreferences]);



  const getLevelLabel = () => {
    const level = COOKING_LEVELS.find(l => l.id === userPrefs.cookingLevel);
    return level?.label || 'Not set';
  };

  const getDietaryLabel = () => {
    if (userPrefs.dietaryRestrictions.length === 0) return 'None';
    return userPrefs.dietaryRestrictions.join(', ');
  };

  const getHouseholdLabel = () => {
    if (userPrefs.householdSize === 1) return 'Just me';
    if (userPrefs.householdSize === 5) return '5+ people';
    return `${userPrefs.householdSize} people`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage your cooking preferences</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cooking Preferences</Text>

          {/* Cooking Level */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => toggleSection('level')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIcon}>
              <ChefHat size={22} color={colors.primary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Cooking Level</Text>
              <Text style={styles.settingValue}>{getLevelLabel()}</Text>
            </View>
            <ChevronRight 
              size={20} 
              color={colors.textLight} 
              style={[
                styles.chevron,
                expandedSection === 'level' && styles.chevronExpanded
              ]}
            />
          </TouchableOpacity>

          {expandedSection === 'level' && (
            <View style={styles.expandedContent}>
              {COOKING_LEVELS.map((level) => {
                const Icon = level.icon;
                const isSelected = userPrefs.cookingLevel === level.id;
                return (
                  <TouchableOpacity
                    key={level.id}
                    style={[
                      styles.levelOption,
                      isSelected && styles.levelOptionSelected,
                    ]}
                    onPress={() => handleLevelSelect(level.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.levelIconWrap,
                      isSelected && styles.levelIconWrapSelected,
                    ]}>
                      <Icon size={20} color={isSelected ? colors.primary : colors.textSecondary} />
                    </View>
                    <View style={styles.levelText}>
                      <Text style={[
                        styles.levelLabel,
                        isSelected && styles.levelLabelSelected,
                      ]}>
                        {level.label}
                      </Text>
                      <Text style={styles.levelDesc}>{level.desc}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.checkMark}>
                        <Check size={14} color={colors.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Dietary Preferences */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => toggleSection('dietary')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIcon}>
              <Leaf size={22} color={colors.secondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Dietary Preferences</Text>
              <Text style={styles.settingValue} numberOfLines={1}>{getDietaryLabel()}</Text>
            </View>
            <ChevronRight 
              size={20} 
              color={colors.textLight}
              style={[
                styles.chevron,
                expandedSection === 'dietary' && styles.chevronExpanded
              ]}
            />
          </TouchableOpacity>

          {expandedSection === 'dietary' && (
            <View style={styles.expandedContent}>
              <View style={styles.dietaryGrid}>
                {DIETARY_OPTIONS.map((option) => {
                  const isSelected = option.id === 'none' 
                    ? userPrefs.dietaryRestrictions.length === 0
                    : userPrefs.dietaryRestrictions.includes(option.id);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.dietaryChip,
                        isSelected && styles.dietaryChipSelected,
                      ]}
                      onPress={() => handleDietaryToggle(option.id)}
                      activeOpacity={0.7}
                    >
                      {isSelected && (
                        <Check size={14} color={colors.secondaryDark} />
                      )}
                      <Text style={[
                        styles.dietaryLabel,
                        isSelected && styles.dietaryLabelSelected,
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Household Size */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => toggleSection('household')}
            activeOpacity={0.7}
          >
            <View style={styles.settingIcon}>
              <Users size={22} color="#5B8FB9" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Household Size</Text>
              <Text style={styles.settingValue}>{getHouseholdLabel()}</Text>
            </View>
            <ChevronRight 
              size={20} 
              color={colors.textLight}
              style={[
                styles.chevron,
                expandedSection === 'household' && styles.chevronExpanded
              ]}
            />
          </TouchableOpacity>

          {expandedSection === 'household' && (
            <View style={styles.expandedContent}>
              <View style={styles.householdRow}>
                {HOUSEHOLD_SIZES.map((size) => {
                  const isSelected = userPrefs.householdSize === size;
                  return (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.householdButton,
                        isSelected && styles.householdButtonSelected,
                      ]}
                      onPress={() => handleHouseholdSelect(size)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.householdNumber,
                        isSelected && styles.householdNumberSelected,
                      ]}>
                        {size === 5 ? '5+' : size}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.householdHint}>
                Portion sizes will be adjusted based on your selection
              </Text>
            </View>
          )}
        </View>

        {backendEnabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Sync</Text>
            
            <View style={styles.syncCard}>
              <View style={styles.syncHeader}>
                <View style={styles.syncIcon}>
                  {isSyncing ? (
                    <RefreshCw size={20} color={colors.primary} />
                  ) : (
                    <Cloud size={20} color={colors.secondary} />
                  )}
                </View>
                <View style={styles.syncInfo}>
                  <Text style={styles.syncStatus}>
                    {isSyncing ? 'Syncing...' : 'Connected to Cloud'}
                  </Text>
                  {lastSyncTime && !isSyncing && (
                    <Text style={styles.syncTime}>
                      Last synced: {new Date(lastSyncTime).toLocaleTimeString()}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.syncButton, (isSyncing || isSyncingManually) && styles.syncButtonDisabled]}
                onPress={async () => {
                  if (isSyncing || isSyncingManually) return;
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                  setIsSyncingManually(true);
                  try {
                    await syncToBackend();
                  } finally {
                    setIsSyncingManually(false);
                  }
                }}
                disabled={isSyncing || isSyncingManually}
                activeOpacity={0.7}
              >
                <RefreshCw 
                  size={18} 
                  color={isSyncing || isSyncingManually ? colors.textLight : colors.white} 
                />
                <Text style={[styles.syncButtonText, (isSyncing || isSyncingManually) && styles.syncButtonTextDisabled]}>
                  {isSyncing || isSyncingManually ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>

              <View style={styles.syncStats}>
                <View style={styles.syncStat}>
                  <Text style={styles.syncStatLabel}>Recipes</Text>
                  <Text style={styles.syncStatValue}>{stats.totalRecipes}</Text>
                </View>
                <View style={styles.syncStatDivider} />
                <View style={styles.syncStat}>
                  <Text style={styles.syncStatLabel}>Pantry Items</Text>
                  <Text style={styles.syncStatValue}>{stats.totalPantryItems}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>

          <TouchableOpacity
            style={styles.subscriptionCard}
            onPress={() => {
              console.log('[Settings] Subscription card pressed, isPremium:', isPremium);
              if (!isPremium) {
                console.log('[Settings] Navigating to /paywall');
                router.push('/paywall');
              }
            }}
            activeOpacity={isPremium ? 1 : 0.7}
          >
            <View style={[
              styles.planBadge,
              isPremium ? styles.planBadgePro : styles.planBadgeFree,
            ]}>
              <Crown size={20} color={isPremium ? '#FFB347' : colors.textLight} />
              <Text style={[
                styles.planBadgeText,
                isPremium && styles.planBadgeTextPro,
              ]}>
                {isPremium ? 'Pro Plan' : 'Free Plan'}
              </Text>
            </View>

            <View style={styles.usageGrid}>
              <View style={styles.usageItem}>
                <BookOpen size={16} color={colors.primary} />
                <Text style={styles.usageValue}>
                  {stats.totalRecipes}{!isPremium ? `/${FREE_LIMITS.maxRecipes}` : ''}
                </Text>
                <Text style={styles.usageLabel}>Recipes</Text>
              </View>
              <View style={styles.usageDivider} />
              <View style={styles.usageItem}>
                <ShoppingBasket size={16} color={colors.secondary} />
                <Text style={styles.usageValue}>
                  {stats.totalPantryItems}{!isPremium ? `/${FREE_LIMITS.maxPantryItems}` : ''}
                </Text>
                <Text style={styles.usageLabel}>Pantry</Text>
              </View>
              <View style={styles.usageDivider} />
              <View style={styles.usageItem}>
                <Sparkles size={16} color="#FFB347" />
                <Text style={styles.usageValue}>
                  {isPremium ? '∞' : `${suggestionsRemaining}/${FREE_LIMITS.maxSuggestionsPerDay}`}
                </Text>
                <Text style={styles.usageLabel}>Suggestions</Text>
              </View>
            </View>

            {!isPremium && (
              <View style={styles.upgradeRow}>
                <Text style={styles.upgradeRowText}>Upgrade to Pro for unlimited</Text>
                <View style={styles.upgradeRowBtn}>
                  <Text style={styles.upgradeRowBtnText}>£7/mo · £70/yr</Text>
                  <ChevronRight size={14} color={colors.white} />
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>



        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <TouchableOpacity
            style={styles.legalRow}
            onPress={() => router.push('/privacy-policy')}
            activeOpacity={0.7}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#E8F4FD' }]}>
              <Shield size={22} color="#3B82F6" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Privacy Policy</Text>
              <Text style={styles.settingValue}>How we handle your data</Text>
            </View>
            <ChevronRight size={20} color={colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.legalRow}
            onPress={() => router.push('/terms-of-service')}
            activeOpacity={0.7}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
              <FileText size={22} color="#D97706" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Terms of Service</Text>
              <Text style={styles.settingValue}>Usage terms and conditions</Text>
            </View>
            <ChevronRight size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        <View style={styles.appInfo}>
          <Info size={16} color={colors.textLight} />
          <Text style={styles.appInfoText}>Kitchen Butler v1.0.0</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.text,
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  expandedContent: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  levelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  levelOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF8F6',
  },
  levelIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelIconWrapSelected: {
    backgroundColor: '#FFE8E3',
  },
  levelText: {
    flex: 1,
    marginLeft: 12,
  },
  levelLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 2,
  },
  levelLabelSelected: {
    color: colors.primary,
  },
  levelDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  checkMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dietaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dietaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
  },
  dietaryChipSelected: {
    borderColor: colors.secondary,
    backgroundColor: '#F0F7EF',
  },
  dietaryLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.text,
  },
  dietaryLabelSelected: {
    color: colors.secondaryDark,
  },
  householdRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  householdButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
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
  householdHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  subscriptionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 18,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  planBadgeFree: {
    backgroundColor: colors.warmGray,
  },
  planBadgePro: {
    backgroundColor: '#FFF8ED',
    borderWidth: 1,
    borderColor: '#FFE4B5',
  },
  planBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  planBadgeTextPro: {
    color: '#8B6914',
  },
  usageGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  usageItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  usageDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.borderLight,
  },
  usageValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text,
  },
  usageLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  upgradeRowText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  upgradeRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  upgradeRowBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.white,
  },
  syncCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 18,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  syncIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  syncInfo: {
    flex: 1,
  },
  syncStatus: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 2,
  },
  syncTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  syncButtonDisabled: {
    backgroundColor: colors.warmGray,
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.white,
  },
  syncButtonTextDisabled: {
    color: colors.textLight,
  },
  syncStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
  },
  syncStat: {
    flex: 1,
    alignItems: 'center',
  },
  syncStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.borderLight,
  },
  syncStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  syncStatValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  appInfoText: {
    fontSize: 13,
    color: colors.textLight,
  },
});
