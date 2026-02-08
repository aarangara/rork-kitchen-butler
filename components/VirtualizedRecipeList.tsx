import React, { useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image,
  ListRenderItem,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, Users, Heart } from 'lucide-react-native';
import colors from '@/constants/colors';
import { Recipe } from '@/types/recipe';

interface VirtualizedRecipeListProps {
  recipes: Recipe[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onEndReached?: () => void;
  ListHeaderComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement;
  numColumns?: number;
  showFavoriteButton?: boolean;
  onToggleFavorite?: (id: string) => void;
}

const ITEM_HEIGHT = 280;

const RecipeCard = React.memo(({ 
  recipe, 
  showFavoriteButton,
  onToggleFavorite,
  onPress,
}: { 
  recipe: Recipe;
  showFavoriteButton?: boolean;
  onToggleFavorite?: (id: string) => void;
  onPress: () => void;
}) => {
  const handleFavoritePress = useCallback(() => {
    onToggleFavorite?.(recipe.id);
  }, [recipe.id, onToggleFavorite]);

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.9}
      testID={`recipe-card-${recipe.id}`}
    >
      <Image 
        source={{ uri: recipe.imageUrl }} 
        style={styles.image}
        resizeMode="cover"
      />
      
      {showFavoriteButton && (
        <TouchableOpacity 
          style={styles.favoriteButton}
          onPress={handleFavoritePress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Heart 
            size={20} 
            color={recipe.isFavorite ? colors.error : colors.white}
            fill={recipe.isFavorite ? colors.error : 'transparent'}
          />
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        <View style={styles.tagsRow}>
          {recipe.tags.slice(0, 2).map(tag => (
            <View 
              key={tag} 
              style={[styles.tag, { backgroundColor: colors.tagColors[tag] || colors.primary }]}
            >
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>
        
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Clock size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {recipe.prepTime + recipe.cookTime} min
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Users size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{recipe.servings}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

RecipeCard.displayName = 'RecipeCard';

export function VirtualizedRecipeList({
  recipes,
  onRefresh,
  isRefreshing = false,
  onEndReached,
  ListHeaderComponent,
  ListEmptyComponent,
  numColumns = 1,
  showFavoriteButton = true,
  onToggleFavorite,
}: VirtualizedRecipeListProps) {
  const router = useRouter();

  const handlePress = useCallback((id: string) => {
    router.push(`/recipe/${id}`);
  }, [router]);

  const renderItem: ListRenderItem<Recipe> = useCallback(({ item }) => (
    <RecipeCard 
      recipe={item}
      showFavoriteButton={showFavoriteButton}
      onToggleFavorite={onToggleFavorite}
      onPress={() => handlePress(item.id)}
    />
  ), [showFavoriteButton, onToggleFavorite, handlePress]);

  const keyExtractor = useCallback((item: Recipe) => item.id, []);

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const refreshControl = useMemo(() => (
    onRefresh ? (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        tintColor={colors.primary}
        colors={[colors.primary]}
      />
    ) : undefined
  ), [onRefresh, isRefreshing]);

  const defaultEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No recipes found</Text>
      <Text style={styles.emptySubtext}>Try adjusting your filters or add a new recipe</Text>
    </View>
  ), []);

  return (
    <FlatList
      data={recipes}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      numColumns={numColumns}
      key={numColumns}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={6}
      updateCellsBatchingPeriod={50}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={refreshControl}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent || defaultEmptyComponent}
      testID="recipe-list"
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: colors.background,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 14,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.white,
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 10,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default VirtualizedRecipeList;
