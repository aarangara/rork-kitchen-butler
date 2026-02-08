import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Check, X, Package } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import colors from '@/constants/colors';
import { useRecipes } from '@/providers/RecipeProvider';
import { useSubscription, FREE_LIMITS } from '@/providers/SubscriptionProvider';
import { pantryCategories } from '@/mocks/recipes';

export default function PantryScreen() {
  const router = useRouter();
  const { pantryItems, togglePantryItem, addPantryItem } = useRecipes();
  const { canAddPantryItem, isPremium } = useSubscription();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Pantry');

  const filteredItems = useMemo(() => {
    if (!searchQuery) return pantryItems;
    return pantryItems.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pantryItems, searchQuery]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof pantryItems> = {};
    pantryCategories.forEach(cat => {
      groups[cat] = filteredItems.filter(item => item.category === cat);
    });
    return groups;
  }, [filteredItems]);

  const inStockCount = pantryItems.filter(item => item.inStock).length;

  const handleAddItem = () => {
    if (!newItemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    if (!canAddPantryItem(pantryItems.length)) {
      Alert.alert(
        'Pantry Limit Reached',
        `Free plan allows up to ${FREE_LIMITS.maxPantryItems} pantry items. Upgrade to Pro for unlimited.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall') },
        ]
      );
      return;
    }
    addPantryItem({
      name: newItemName.trim().toLowerCase(),
      category: newItemCategory,
      inStock: true,
    });
    setNewItemName('');
    setShowAddModal(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Pantry</Text>
          <Text style={styles.subtitle}>
            {inStockCount} of {pantryItems.length} items in stock
            {!isPremium && ` • ${FREE_LIMITS.maxPantryItems - pantryItems.length} slots left`}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Plus color={colors.white} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search color={colors.textLight} size={20} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search ingredients..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X color={colors.textLight} size={18} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {pantryCategories.map(category => {
          const items = groupedItems[category];
          if (!items || items.length === 0) return null;
          
          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Package color={colors.textSecondary} size={18} />
                <Text style={styles.categoryTitle}>{category}</Text>
                <Text style={styles.categoryCount}>
                  {items.filter(i => i.inStock).length}/{items.length}
                </Text>
              </View>
              <View style={styles.itemsGrid}>
                {items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemCard,
                      item.inStock && styles.itemCardActive
                    ]}
                    onPress={() => togglePantryItem(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.checkbox,
                      item.inStock && styles.checkboxActive
                    ]}>
                      {item.inStock && <Check color={colors.white} size={14} />}
                    </View>
                    <Text style={[
                      styles.itemName,
                      !item.inStock && styles.itemNameInactive
                    ]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>

      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Ingredient</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X color={colors.text} size={24} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. chicken breast"
              placeholderTextColor={colors.textLight}
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />

            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoryPicker}
            >
              {pantryCategories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    newItemCategory === cat && styles.categoryChipActive
                  ]}
                  onPress={() => setNewItemCategory(cat)}
                >
                  <Text style={[
                    styles.categoryChipText,
                    newItemCategory === cat && styles.categoryChipTextActive
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.addItemButton}
              onPress={handleAddItem}
            >
              <Text style={styles.addItemButtonText}>Add to Pantry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 20,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    flex: 1,
  },
  categoryCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  itemCardActive: {
    backgroundColor: colors.cream,
    borderColor: colors.secondary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  itemName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500' as const,
  },
  itemNameInactive: {
    color: colors.textLight,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPicker: {
    marginBottom: 24,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.text,
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  addItemButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  addItemButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
