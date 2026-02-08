import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Clock, Users, ChefHat, Heart, Sparkles, Plus } from 'lucide-react-native';
import colors from '@/constants/colors';
import { useRecipes } from '@/providers/RecipeProvider';

export default function HomeScreen() {
  const router = useRouter();
  const { recipes, getFeaturedRecipe, isLoading, toggleFavorite } = useRecipes();
  const featured = getFeaturedRecipe();
  
  const recentRecipes = [...recipes]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good to see you!</Text>
            <Text style={styles.title}>Help Me Cook</Text>
          </View>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => router.push('/add-recipe')}
            testID="add-recipe-button"
          >
            <Plus color={colors.white} size={24} />
          </TouchableOpacity>
        </View>

        {featured && (
          <View style={styles.featuredSection}>
            <View style={styles.sectionHeader}>
              <Sparkles color={colors.primary} size={20} />
              <Text style={styles.sectionTitle}>Try This Today</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.featuredCard}
              onPress={() => router.push(`/recipe/${featured.id}`)}
              activeOpacity={0.9}
              testID="featured-recipe"
            >
              <Image
                source={{ uri: featured.imageUrl }}
                style={styles.featuredImage}
                contentFit="cover"
              />
              <View style={styles.featuredOverlay}>
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredBadgeText}>Featured</Text>
                </View>
                <TouchableOpacity 
                  style={styles.favoriteButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleFavorite(featured.id);
                  }}
                >
                  <Heart 
                    color={featured.isFavorite ? colors.primary : colors.white} 
                    fill={featured.isFavorite ? colors.primary : 'transparent'}
                    size={22} 
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.featuredContent}>
                <Text style={styles.featuredTitle}>{featured.title}</Text>
                <Text style={styles.featuredDescription} numberOfLines={2}>
                  {featured.description}
                </Text>
                <View style={styles.featuredMeta}>
                  <View style={styles.metaItem}>
                    <Clock color={colors.textSecondary} size={16} />
                    <Text style={styles.metaText}>
                      {featured.prepTime + featured.cookTime} min
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Users color={colors.textSecondary} size={16} />
                    <Text style={styles.metaText}>{featured.servings} servings</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <ChefHat color={colors.textSecondary} size={16} />
                    <Text style={styles.metaText}>{featured.difficulty}</Text>
                  </View>
                </View>
                <View style={styles.tagsContainer}>
                  {featured.tags.slice(0, 3).map((tag) => (
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
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={[styles.quickAction, { backgroundColor: colors.primaryLight }]}
              onPress={() => router.push('/(tabs)/match')}
            >
              <ChefHat color={colors.white} size={28} />
              <Text style={styles.quickActionText}>What Can I Cook?</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.quickAction, { backgroundColor: colors.secondary }]}
              onPress={() => router.push('/add-recipe')}
            >
              <Plus color={colors.white} size={28} />
              <Text style={styles.quickActionText}>Add Recipe</Text>
            </TouchableOpacity>
          </View>
        </View>

        {recentRecipes.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recently Added</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/recipes')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentList}
            >
              {recentRecipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe.id}
                  style={styles.recentCard}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: recipe.imageUrl }}
                    style={styles.recentImage}
                    contentFit="cover"
                  />
                  <View style={styles.recentContent}>
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {recipe.title}
                    </Text>
                    <Text style={styles.recentMeta}>
                      {recipe.prepTime + recipe.cookTime} min • {recipe.difficulty}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  featuredSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500' as const,
  },
  featuredCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  featuredImage: {
    width: '100%',
    height: 200,
  },
  featuredOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  featuredBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  featuredBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredContent: {
    padding: 16,
  },
  featuredTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 6,
  },
  featuredDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  featuredMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.white,
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  quickAction: {
    flex: 1,
    height: 100,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
  },
  recentSection: {
    paddingLeft: 20,
  },
  recentList: {
    paddingRight: 20,
    gap: 12,
  },
  recentCard: {
    width: 160,
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  recentImage: {
    width: '100%',
    height: 100,
  },
  recentContent: {
    padding: 12,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 4,
  },
  recentMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
