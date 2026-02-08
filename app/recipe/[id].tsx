import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Heart, 
  Clock, 
  Users, 
  ChefHat, 
  ExternalLink,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import colors from '@/constants/colors';
import { useRecipes } from '@/providers/RecipeProvider';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { recipes, toggleFavorite, deleteRecipe, pantryItems } = useRecipes();
  
  const recipe = recipes.find(r => r.id === id);
  
  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Recipe not found</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const inStockItems = pantryItems
    .filter(item => item.inStock)
    .map(item => item.name.toLowerCase());

  const checkIngredientInPantry = (ingredientName: string) => {
    return inStockItems.some(stock => 
      ingredientName.toLowerCase().includes(stock) || 
      stock.includes(ingredientName.toLowerCase())
    );
  };

  const handleFavorite = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(recipe.id);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recipe',
      'Are you sure you want to delete this recipe?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            deleteRecipe(recipe.id);
            router.back();
          }
        },
      ]
    );
  };

  const handleOpenSource = async () => {
    if (recipe.sourceUrl) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await WebBrowser.openBrowserAsync(recipe.sourceUrl);
    }
  };

  const sourceIcon = {
    instagram: '📸',
    pinterest: '📌',
    tiktok: '🎵',
    web: '🔗',
    manual: '✏️',
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: recipe.imageUrl }}
            style={styles.heroImage}
            contentFit="cover"
          />
          <SafeAreaView style={styles.headerOverlay} edges={['top']}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => router.back()}
            >
              <ArrowLeft color={colors.white} size={22} />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={handleFavorite}
              >
                <Heart 
                  color={recipe.isFavorite ? colors.primary : colors.white} 
                  fill={recipe.isFavorite ? colors.primary : 'transparent'}
                  size={22} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={handleDelete}
              >
                <Trash2 color={colors.white} size={22} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.content}>
          <View style={styles.sourceRow}>
            <Text style={styles.sourceEmoji}>{sourceIcon[recipe.source]}</Text>
            <Text style={styles.sourceText}>
              {recipe.source === 'manual' ? 'Added manually' : `From ${recipe.source}`}
            </Text>
            {recipe.sourceUrl && (
              <TouchableOpacity 
                style={styles.sourceLinkButton}
                onPress={handleOpenSource}
              >
                <ExternalLink color={colors.primary} size={14} />
                <Text style={styles.sourceLinkText}>View Source</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.description}>{recipe.description}</Text>

          <View style={styles.tagsRow}>
            {recipe.tags.map((tag) => (
              <View 
                key={tag} 
                style={[
                  styles.tag, 
                  { backgroundColor: colors.tagColors[tag] || colors.secondary }
                ]}
              >
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.statIcon}>
                <Clock color={colors.primary} size={20} />
              </View>
              <Text style={styles.statValue}>{recipe.prepTime + recipe.cookTime}</Text>
              <Text style={styles.statLabel}>minutes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIcon}>
                <Users color={colors.primary} size={20} />
              </View>
              <Text style={styles.statValue}>{recipe.servings}</Text>
              <Text style={styles.statLabel}>servings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIcon}>
                <ChefHat color={colors.primary} size={20} />
              </View>
              <Text style={styles.statValue}>{recipe.difficulty}</Text>
              <Text style={styles.statLabel}>level</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Ingredients ({recipe.ingredients.length})
            </Text>
            <View style={styles.ingredientsList}>
              {recipe.ingredients.map((ingredient, index) => {
                const inPantry = checkIngredientInPantry(ingredient.name);
                return (
                  <View 
                    key={ingredient.id || index} 
                    style={[
                      styles.ingredientRow,
                      inPantry && styles.ingredientRowInPantry
                    ]}
                  >
                    <View style={[
                      styles.ingredientDot,
                      inPantry && styles.ingredientDotInPantry
                    ]} />
                    <Text style={styles.ingredientAmount}>
                      {ingredient.amount} {ingredient.unit}
                    </Text>
                    <Text style={styles.ingredientName}>{ingredient.name}</Text>
                    {inPantry && (
                      <Text style={styles.inPantryBadge}>✓ Have it</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <View style={styles.instructionsList}>
              {recipe.instructions.map((instruction, index) => (
                <View key={index} style={styles.instructionRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  imageContainer: {
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 300,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  content: {
    padding: 20,
    marginTop: -20,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sourceEmoji: {
    fontSize: 14,
  },
  sourceText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sourceLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    backgroundColor: colors.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  sourceLinkText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.primary,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.white,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
    textTransform: 'capitalize',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 16,
  },
  ingredientsList: {
    gap: 10,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 12,
  },
  ingredientRowInPantry: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  ingredientDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 12,
  },
  ingredientDotInPantry: {
    backgroundColor: colors.secondary,
  },
  ingredientAmount: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    minWidth: 70,
  },
  ingredientName: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  inPantryBadge: {
    fontSize: 11,
    color: colors.secondary,
    fontWeight: '600' as const,
  },
  instructionsList: {
    gap: 16,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.white,
  },
  instructionText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    flex: 1,
  },
});
