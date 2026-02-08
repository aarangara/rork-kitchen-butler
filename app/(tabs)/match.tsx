import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChefHat, Clock, ArrowRight, Sparkles, ShoppingBag, Package, Plus, X, Search, Check, Crown } from 'lucide-react-native';
import colors from '@/constants/colors';
import { useRecipes } from '@/providers/RecipeProvider';
import { useSubscription, FREE_LIMITS } from '@/providers/SubscriptionProvider';

const COMMON_INGREDIENTS = [
  'Chicken', 'Beef', 'Pork', 'Fish', 'Salmon', 'Shrimp', 'Tofu',
  'Rice', 'Pasta', 'Bread', 'Noodles', 'Quinoa',
  'Tomatoes', 'Onion', 'Garlic', 'Potatoes', 'Carrots', 'Broccoli', 'Spinach', 'Bell Pepper',
  'Eggs', 'Milk', 'Cheese', 'Butter', 'Cream', 'Yogurt',
  'Olive Oil', 'Soy Sauce', 'Vinegar', 'Lemon', 'Lime',
  'Salt', 'Pepper', 'Cumin', 'Paprika', 'Oregano', 'Basil',
  'Beans', 'Chickpeas', 'Lentils', 'Mushrooms', 'Avocado',
];

export default function MatchScreen() {
  const router = useRouter();
  const { getMatchingRecipes, recipes, pantryItems } = useRecipes();
  const { isPremium, suggestionsRemaining, useSuggestion: consumeSuggestion } = useSubscription();
  
  const [useCustomIngredients, setUseCustomIngredients] = useState(false);
  const [customIngredients, setCustomIngredients] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = useMemo(() => {
    if (!searchText.trim()) return COMMON_INGREDIENTS.filter(ing => !customIngredients.includes(ing)).slice(0, 12);
    return COMMON_INGREDIENTS.filter(
      ing => ing.toLowerCase().includes(searchText.toLowerCase()) && !customIngredients.includes(ing)
    );
  }, [searchText, customIngredients]);

  const addCustomIngredient = useCallback((ingredient: string) => {
    const trimmed = ingredient.trim();
    if (trimmed && !customIngredients.includes(trimmed)) {
      setCustomIngredients(prev => [...prev, trimmed]);
    }
    setSearchText('');
    setShowSuggestions(false);
  }, [customIngredients]);

  const removeCustomIngredient = useCallback((ingredient: string) => {
    setCustomIngredients(prev => prev.filter(i => i !== ingredient));
  }, []);

  const customMatchingRecipes = useMemo(() => {
    if (!useCustomIngredients || customIngredients.length === 0) return [];
    
    const ingredientsList = customIngredients.map(i => i.toLowerCase());
    
    return recipes
      .map(recipe => {
        const recipeIngredients = recipe.ingredients.map(i => i.name.toLowerCase());
        const matchCount = recipeIngredients.filter(ing =>
          ingredientsList.some(custom => ing.includes(custom) || custom.includes(ing))
        ).length;
        const matchPercent = (matchCount / recipeIngredients.length) * 100;
        return { recipe, matchPercent, matchCount, totalIngredients: recipeIngredients.length };
      })
      .filter(item => item.matchCount >= 1)
      .sort((a, b) => b.matchCount - a.matchCount || b.matchPercent - a.matchPercent);
  }, [recipes, customIngredients, useCustomIngredients]);

  const pantryMatchingRecipes = getMatchingRecipes();
  const matchingRecipes = useCustomIngredients ? customMatchingRecipes : pantryMatchingRecipes;
  const inStockCount = pantryItems.filter(item => item.inStock).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>What Can I Cook?</Text>
          <Text style={styles.subtitle}>
            {useCustomIngredients 
              ? `Using ${customIngredients.length} custom ingredients`
              : `Based on your ${inStockCount} pantry items`
            }
          </Text>
        </View>

        <View style={styles.modeToggleContainer}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              !useCustomIngredients && styles.modeButtonActive,
            ]}
            onPress={() => setUseCustomIngredients(false)}
            activeOpacity={0.7}
          >
            <Package 
              color={!useCustomIngredients ? colors.white : colors.textSecondary} 
              size={18} 
            />
            <Text style={[
              styles.modeButtonText,
              !useCustomIngredients && styles.modeButtonTextActive,
            ]}>
              My Pantry
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              useCustomIngredients && styles.modeButtonActive,
            ]}
            onPress={() => setUseCustomIngredients(true)}
            activeOpacity={0.7}
          >
            <ShoppingBag 
              color={useCustomIngredients ? colors.white : colors.textSecondary} 
              size={18} 
            />
            <Text style={[
              styles.modeButtonText,
              useCustomIngredients && styles.modeButtonTextActive,
            ]}>
              Custom List
            </Text>
          </TouchableOpacity>
        </View>

        {useCustomIngredients ? (
          <View style={styles.customIngredientsSection}>
            <View style={styles.searchContainer}>
              <Search color={colors.textLight} size={18} />
              <TextInput
                style={styles.searchInput}
                placeholder="Add ingredients you can buy..."
                placeholderTextColor={colors.textLight}
                value={searchText}
                onChangeText={(text) => {
                  setSearchText(text);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onSubmitEditing={() => {
                  if (searchText.trim()) addCustomIngredient(searchText);
                }}
                returnKeyType="done"
              />
              {searchText.length > 0 && (
                <TouchableOpacity 
                  onPress={() => addCustomIngredient(searchText)}
                  style={styles.addButton}
                >
                  <Plus color={colors.white} size={16} />
                </TouchableOpacity>
              )}
            </View>

            {showSuggestions && filteredSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>Quick add:</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsScroll}
                >
                  {filteredSuggestions.map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion}
                      style={styles.suggestionChip}
                      onPress={() => addCustomIngredient(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                      <Plus color={colors.primary} size={14} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {customIngredients.length > 0 && (
              <View style={styles.selectedContainer}>
                <Text style={styles.selectedLabel}>Your shopping list:</Text>
                <View style={styles.selectedChips}>
                  {customIngredients.map((ingredient) => (
                    <View key={ingredient} style={styles.selectedChip}>
                      <Text style={styles.selectedChipText}>{ingredient}</Text>
                      <TouchableOpacity
                        onPress={() => removeCustomIngredient(ingredient)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X color={colors.white} size={14} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.customHeroCard}>
              <ChefHat color={colors.primary} size={28} />
              <View style={styles.customHeroText}>
                <Text style={styles.customHeroTitle}>
                  {matchingRecipes.length > 0
                    ? `${matchingRecipes.length} recipes match!`
                    : customIngredients.length > 0 
                      ? 'No matches yet'
                      : 'Add ingredients to start'
                  }
                </Text>
                <Text style={styles.customHeroSubtitle}>
                  {matchingRecipes.length > 0
                    ? 'Based on ingredients you can buy'
                    : 'Add items you plan to purchase'
                  }
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <ChefHat color={colors.white} size={32} />
            </View>
            <Text style={styles.heroTitle}>
              {matchingRecipes.length > 0 
                ? `${matchingRecipes.length} recipes you can make!`
                : 'No matching recipes yet'
              }
            </Text>
            <Text style={styles.heroSubtitle}>
              {matchingRecipes.length > 0
                ? 'These recipes match at least 50% of their ingredients with your pantry'
                : 'Add more items to your pantry or try new recipes'
              }
            </Text>
            <TouchableOpacity 
              style={styles.pantryButton}
              onPress={() => router.push('/(tabs)/pantry')}
            >
              <Text style={styles.pantryButtonText}>Update Pantry</Text>
              <ArrowRight color={colors.primary} size={18} />
            </TouchableOpacity>
          </View>
        )}

        {!isPremium && (
          <View style={styles.limitBanner}>
            <View style={styles.limitBannerLeft}>
              <Sparkles color="#FFB347" size={18} />
              <Text style={styles.limitBannerText}>
                {suggestionsRemaining > 0
                  ? `${suggestionsRemaining} of ${FREE_LIMITS.maxSuggestionsPerDay} suggestions left today`
                  : 'No suggestions left today'
                }
              </Text>
            </View>
            <TouchableOpacity
              style={styles.limitUpgradeBtn}
              onPress={() => router.push('/paywall')}
            >
              <Crown size={14} color={colors.white} />
              <Text style={styles.limitUpgradeText}>Pro</Text>
            </TouchableOpacity>
          </View>
        )}

        {matchingRecipes.length > 0 && (
          <View style={styles.resultsSection}>
            <View style={styles.sectionHeader}>
              <Sparkles color={colors.primary} size={20} />
              <Text style={styles.sectionTitle}>Recommended for You</Text>
            </View>

            {matchingRecipes.map(({ recipe, matchPercent, matchCount, totalIngredients }, index) => {
              const percent = Math.round(matchPercent);
              const matchColor = percent >= 80 ? colors.secondary : percent >= 50 ? colors.primary : colors.warning;
              
              const isLocked = !isPremium && index >= FREE_LIMITS.maxSuggestionsPerDay && suggestionsRemaining <= 0;
              return (
                <TouchableOpacity
                  key={recipe.id}
                  style={[styles.recipeCard, isLocked && styles.recipeCardLocked]}
                  onPress={() => {
                    if (isLocked) {
                      router.push('/paywall');
                      return;
                    }
                    if (!isPremium) {
                      consumeSuggestion();
                    }
                    router.push(`/recipe/${recipe.id}`);
                  }}
                  activeOpacity={0.9}
                >
                  <View style={styles.recipeRow}>
                    <Image
                      source={{ uri: recipe.imageUrl }}
                      style={styles.recipeImageSquare}
                      contentFit="cover"
                    />
                    <View style={styles.recipeInfo}>
                      <Text style={styles.recipeTitle} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                      <View style={styles.ingredientMatchRow}>
                        <Check color={colors.secondary} size={14} />
                        <Text style={styles.ingredientMatch}>
                          {matchCount}/{totalIngredients} ingredients match
                        </Text>
                      </View>
                      <View style={styles.recipeMeta}>
                        <Clock color={colors.textLight} size={14} />
                        <Text style={styles.metaText}>
                          {recipe.prepTime + recipe.cookTime} min
                        </Text>
                        <View style={styles.difficultyBadge}>
                          <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.percentageContainer}>
                      <View style={[styles.percentageCircle, { borderColor: matchColor }]}>
                        <Text style={[styles.percentageNumber, { color: matchColor }]}>
                          {percent}
                        </Text>
                        <Text style={[styles.percentageSymbol, { color: matchColor }]}>%</Text>
                      </View>
                      <Text style={styles.matchLabel}>match</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { width: `${matchPercent}%`, backgroundColor: matchColor }
                      ]} 
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {matchingRecipes.length === 0 && !useCustomIngredients && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <ChefHat color={colors.textLight} size={48} />
            </View>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptySubtitle}>
              Stock up your pantry to see which recipes you can make with what you have
            </Text>
            <TouchableOpacity 
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/pantry')}
            >
              <Text style={styles.emptyButtonText}>Go to Pantry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 24 }} />
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
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: colors.primary,
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  pantryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  pantryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  resultsSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  recipeCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  recipeRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  recipeImageSquare: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  recipeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  percentageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  percentageCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  percentageNumber: {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 20,
  },
  percentageSymbol: {
    fontSize: 10,
    fontWeight: '600' as const,
    marginTop: -2,
  },
  matchLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: colors.textLight,
    marginTop: 4,
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 4,
  },
  ingredientMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ingredientMatch: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '500' as const,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: colors.textLight,
    marginRight: 8,
  },
  difficultyBadge: {
    backgroundColor: colors.cream,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.borderLight,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.secondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.warmGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.warmGray,
    borderRadius: 14,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
  modeButtonTextActive: {
    color: colors.white,
  },
  customIngredientsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 12,
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    marginTop: 12,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  suggestionsScroll: {
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 6,
  },
  suggestionText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500' as const,
  },
  selectedContainer: {
    marginTop: 16,
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  selectedChipText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '500' as const,
  },
  customHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  customHeroText: {
    flex: 1,
  },
  customHeroTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  customHeroSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFF8ED',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FFE4B5',
  },
  limitBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  limitBannerText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#8B6914',
  },
  limitUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  limitUpgradeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.white,
  },
  recipeCardLocked: {
    opacity: 0.5,
  },
});
