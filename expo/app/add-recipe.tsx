import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  X, 
  Plus, 
  Minus, 
  ChefHat,
  Clock,
  Users,
  Link,
  Trash2,
  Globe,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { generateObject } from '@rork-ai/toolkit-sdk';
import colors from '@/constants/colors';
import { useRecipes } from '@/providers/RecipeProvider';
import { useSubscription, FREE_LIMITS } from '@/providers/SubscriptionProvider';
import { ALL_TAGS, Ingredient } from '@/types/recipe';
import { trpc } from '@/lib/trpc';

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'] as const;
const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual Entry', icon: '✏️' },
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'pinterest', label: 'Pinterest', icon: '📌' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵' },
  { value: 'web', label: 'Website', icon: '🔗' },
] as const;

const SOCIAL_MEDIA_DOMAINS = ['instagram.com', 'tiktok.com', 'facebook.com', 'twitter.com', 'x.com'];

const isSocialMediaUrl = (url: string): boolean => {
  return SOCIAL_MEDIA_DOMAINS.some(domain => url.toLowerCase().includes(domain));
};

const recipeSchema = z.object({
  title: z.string().describe('Recipe title'),
  description: z.string().describe('Brief description of the recipe'),
  imageUrl: z.string().optional().describe('Main image URL if found'),
  servings: z.number().default(4).describe('Number of servings'),
  prepTime: z.number().default(15).describe('Prep time in minutes'),
  cookTime: z.number().default(30).describe('Cook time in minutes'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.string(),
    unit: z.string(),
  })).describe('List of ingredients with amounts and units'),
  instructions: z.array(z.string()).describe('Step by step cooking instructions'),
  tags: z.array(z.string()).describe('Recipe tags like breakfast, dinner, vegetarian, etc'),
});

export default function AddRecipeScreen() {
  const router = useRouter();
  const { addRecipe, recipes } = useRecipes();
  const { canAddRecipe } = useSubscription();

  const [importUrl, setImportUrl] = useState('');
  const [recipeText, setRecipeText] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteMode, setPasteMode] = useState<'hidden' | 'manual' | 'ai'>('hidden');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [source, setSource] = useState<'manual' | 'instagram' | 'pinterest' | 'tiktok' | 'web'>('manual');
  const [socialMediaDetected, setSocialMediaDetected] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [servings, setServings] = useState(4);
  const [prepTime, setPrepTime] = useState(15);
  const [cookTime, setCookTime] = useState(30);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: '1', name: '', amount: '', unit: '' }
  ]);
  const [instructions, setInstructions] = useState<string[]>(['']);

  const fetchUrlMutation = trpc.recipes.fetchUrl.useMutation();

  const parseUrlMutation = useMutation({
    mutationFn: async ({ url }: { url: string }) => {
      console.log('Parsing URL:', url);
      
      let htmlContent = '';
      
      // Try server-side fetch first (bypasses CORS)
      try {
        const result = await fetchUrlMutation.mutateAsync({ url });
        htmlContent = result.html;
        console.log('Fetched HTML via server, length:', htmlContent.length);
      } catch (serverError) {
        console.log('Server fetch failed:', serverError);
        
        // Fallback to direct fetch (might work for some sites)
        try {
          const response = await fetch(url, {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });
          if (response.ok) {
            htmlContent = await response.text();
            console.log('Fetched HTML directly, length:', htmlContent.length);
          }
        } catch (fetchError) {
          console.log('Direct fetch also failed (CORS):', fetchError);
        }
      }
      
      // If we couldn't fetch the content, ask user to paste
      if (!htmlContent || htmlContent.length < 100) {
        throw new Error('NEED_PASTE_TEXT');
      }
      
      // Truncate HTML to avoid token limits (keep most relevant parts)
      const truncatedHtml = htmlContent.length > 50000 
        ? htmlContent.substring(0, 50000) 
        : htmlContent;
      
      // Use AI to parse the HTML content
      const result = await generateObject({
        messages: [
          {
            role: 'user',
            content: `You are a recipe extraction expert. Parse this HTML page and extract ALL recipe information.

HTML CONTENT:
${truncatedHtml}

IMPORTANT EXTRACTION RULES:
1. Look for JSON-LD structured data (application/ld+json) - this often contains the most accurate recipe data
2. Look for recipe card sections with ingredients lists (usually <ul> or <li> elements with ingredient classes)
3. Look for "wprm-recipe-ingredient" or similar recipe plugin classes
4. Extract EVERY ingredient - do not skip any
5. Parse amounts carefully: "1/2 cup", "2 tablespoons", "1 (14oz) can" etc.
6. For compound amounts like "1 1/2", keep as "1 1/2" not separate
7. Common units: cup, tablespoon, teaspoon, oz, lb, g, ml, pinch, to taste
8. If an ingredient has no amount, use "" for amount and "to taste" or "" for unit

Do NOT make up or guess any details. Extract exactly what's in the HTML.
If you cannot find recipe information, return an empty title.

Extract: title, description, ALL ingredients with exact amounts and units, step-by-step cooking instructions, prep/cook times, servings, and difficulty level.

Suggest appropriate tags from: breakfast, lunch, dinner, dessert, snack, vegetarian, quick, healthy, comfort, italian, asian, mexican.`,
          },
        ],
        schema: recipeSchema,
      });
      console.log('Parsed recipe:', result);
      
      // If AI couldn't extract a title, the content might not be a recipe page
      if (!result.title || result.title.trim() === '') {
        throw new Error('NEED_PASTE_TEXT');
      }
      
      return result;
    },
    onSuccess: (data) => {
      setTitle(data.title || '');
      setDescription(data.description || '');
      if (data.imageUrl) setImageUrl(data.imageUrl);
      setServings(data.servings || 4);
      setPrepTime(data.prepTime || 15);
      setCookTime(data.cookTime || 30);
      setDifficulty(data.difficulty || 'medium');
      
      if (data.ingredients && data.ingredients.length > 0) {
        setIngredients(
          data.ingredients.map((ing, idx) => ({
            id: (idx + 1).toString(),
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
          }))
        );
      }
      
      if (data.instructions && data.instructions.length > 0) {
        setInstructions(data.instructions);
      }
      
      const validTags = (data.tags || []).filter(tag => 
        ALL_TAGS.includes(tag as any)
      );
      setSelectedTags(validTags);
      
      setSourceUrl(importUrl);
      
      if (importUrl.includes('instagram.com')) {
        setSource('instagram');
      } else if (importUrl.includes('pinterest.com')) {
        setSource('pinterest');
      } else if (importUrl.includes('tiktok.com')) {
        setSource('tiktok');
      } else {
        setSource('web');
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      console.error('Failed to parse URL:', error);
      if (error.message === 'NEED_PASTE_TEXT') {
        setShowPasteArea(true);
        setPasteMode('hidden');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Alert.alert('Error', 'Could not parse recipe from URL. Please try again or enter manually.');
      }
    },
  });

  const handleImportUrl = () => {
    if (!importUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }
    
    let url = importUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
      setImportUrl(url);
    }
    
    // For social media, go straight to paste mode (these platforms block scraping)
    if (isSocialMediaUrl(url)) {
      setShowPasteArea(true);
      setPasteMode('hidden');
      setSocialMediaDetected(true);
      setSourceUrl(url);
      
      if (url.includes('instagram.com')) {
        setSource('instagram');
      } else if (url.includes('tiktok.com')) {
        setSource('tiktok');
      } else if (url.includes('pinterest.com')) {
        setSource('pinterest');
      } else {
        setSource('web');
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    
    setSocialMediaDetected(false);
    
    setShowPasteArea(false);
    setPasteMode('hidden');
    parseUrlMutation.mutate({ url });
  };

  

  const handleManualEntry = () => {
    if (!recipeText.trim()) {
      Alert.alert('Error', 'Please paste the recipe text first');
      return;
    }
    setPasteMode('manual');
    setDescription(recipeText.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowPasteArea(false);
  };

  const toggleTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const addIngredient = () => {
    setIngredients(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', amount: '', unit: '' }
    ]);
  };

  const updateIngredient = (id: string, field: keyof Ingredient, value: string) => {
    setIngredients(prev => 
      prev.map(ing => ing.id === id ? { ...ing, [field]: value } : ing)
    );
  };

  const removeIngredient = (id: string) => {
    if (ingredients.length > 1) {
      setIngredients(prev => prev.filter(ing => ing.id !== id));
    }
  };

  const addInstruction = () => {
    setInstructions(prev => [...prev, '']);
  };

  const updateInstruction = (index: number, value: string) => {
    setInstructions(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const removeInstruction = (index: number) => {
    if (instructions.length > 1) {
      setInstructions(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSave = () => {
    if (!canAddRecipe(recipes.length)) {
      Alert.alert(
        'Recipe Limit Reached',
        `Free plan allows up to ${FREE_LIMITS.maxRecipes} recipes. Upgrade to Pro for unlimited.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall') },
        ]
      );
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a recipe title');
      return;
    }
    if (ingredients.filter(i => i.name.trim()).length === 0) {
      Alert.alert('Error', 'Please add at least one ingredient');
      return;
    }
    if (instructions.filter(i => i.trim()).length === 0) {
      Alert.alert('Error', 'Please add at least one instruction');
      return;
    }

    addRecipe({
      title: title.trim(),
      description: description.trim() || 'No description',
      imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800',
      source,
      sourceUrl: sourceUrl.trim() || undefined,
      tags: selectedTags,
      ingredients: ingredients.filter(i => i.name.trim()),
      instructions: instructions.filter(i => i.trim()),
      servings,
      prepTime,
      cookTime,
      difficulty,
      isFavorite: false,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <X color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Recipe</Text>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.importSection}>
            <View style={styles.importHeader}>
              <Globe color={colors.primary} size={20} />
              <Text style={styles.importTitle}>Import from URL</Text>
            </View>
            <Text style={styles.importSubtitle}>
              Paste a link — public websites will be parsed automatically, social media will ask you to paste the recipe text
            </Text>
            <View style={styles.importInputRow}>
              <TextInput
                style={styles.importInput}
                placeholder="https://..."
                placeholderTextColor={colors.textLight}
                value={importUrl}
                onChangeText={setImportUrl}
                autoCapitalize="none"
                keyboardType="url"
                editable={!parseUrlMutation.isPending}
              />
              <TouchableOpacity
                style={[
                  styles.importButton,
                  parseUrlMutation.isPending && styles.importButtonDisabled,
                ]}
                onPress={handleImportUrl}
                disabled={parseUrlMutation.isPending}
              >
                {parseUrlMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
<Text style={styles.importButtonText}>Import</Text>
                )}
              </TouchableOpacity>
            </View>
            {parseUrlMutation.isPending && (
              <Text style={styles.parsingText}>Analyzing recipe...</Text>
            )}
            {showPasteArea && (
              <View style={styles.pasteSection}>
                <Text style={styles.pasteTitle}>📋 Paste Recipe Text</Text>
                <Text style={styles.pasteSubtitle}>
                  Social media platforms require login to view content. Please copy the recipe from the post and paste it below.
                </Text>
                <TextInput
                  style={styles.recipeTextInput}
                  placeholder="Paste the recipe text here...&#10;&#10;Example:&#10;Ingredients:&#10;- 2 cups flour&#10;- 1 tsp salt&#10;...&#10;&#10;Instructions:&#10;1. Mix dry ingredients..."
                  placeholderTextColor={colors.textLight}
                  value={recipeText}
                  onChangeText={setRecipeText}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.useTextButton}
                  onPress={handleManualEntry}
                >
                  <Text style={styles.useTextButtonText}>Use This Text</Text>
                </TouchableOpacity>
                <Text style={styles.pasteNote}>
                  💡 The text will be added to the description field. You can then manually fill in the ingredients and instructions.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or enter manually</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Recipe Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Creamy Tuscan Chicken"
              placeholderTextColor={colors.textLight}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Briefly describe this recipe..."
              placeholderTextColor={colors.textLight}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Image URL</Text>
            <View style={styles.inputWithIcon}>
              <Link color={colors.textLight} size={18} />
              <TextInput
                style={styles.inputInner}
                placeholder="https://..."
                placeholderTextColor={colors.textLight}
                value={imageUrl}
                onChangeText={setImageUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Source</Text>
            <View style={styles.sourceOptions}>
              {SOURCE_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.sourceOption,
                    source === option.value && styles.sourceOptionActive
                  ]}
                  onPress={() => setSource(option.value)}
                >
                  <Text style={styles.sourceIcon}>{option.icon}</Text>
                  <Text style={[
                    styles.sourceLabel,
                    source === option.value && styles.sourceLabelActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {source !== 'manual' && (
              <TextInput
                style={[styles.input, { marginTop: 12 }]}
                placeholder="Source URL (optional)"
                placeholderTextColor={colors.textLight}
                value={sourceUrl}
                onChangeText={setSourceUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Tags</Text>
            <View style={styles.tagsGrid}>
              {ALL_TAGS.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagChip,
                    selectedTags.includes(tag) && {
                      backgroundColor: colors.tagColors[tag] || colors.primary,
                      borderColor: colors.tagColors[tag] || colors.primary,
                    }
                  ]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[
                    styles.tagChipText,
                    selectedTags.includes(tag) && styles.tagChipTextActive
                  ]}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Details</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <Users color={colors.primary} size={18} />
                </View>
                <Text style={styles.detailLabel}>Servings</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity 
                    style={styles.stepperButton}
                    onPress={() => setServings(Math.max(1, servings - 1))}
                  >
                    <Minus color={colors.text} size={16} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{servings}</Text>
                  <TouchableOpacity 
                    style={styles.stepperButton}
                    onPress={() => setServings(servings + 1)}
                  >
                    <Plus color={colors.text} size={16} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <Clock color={colors.primary} size={18} />
                </View>
                <Text style={styles.detailLabel}>Prep (min)</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity 
                    style={styles.stepperButton}
                    onPress={() => setPrepTime(Math.max(0, prepTime - 5))}
                  >
                    <Minus color={colors.text} size={16} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{prepTime}</Text>
                  <TouchableOpacity 
                    style={styles.stepperButton}
                    onPress={() => setPrepTime(prepTime + 5)}
                  >
                    <Plus color={colors.text} size={16} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.detailItem}>
                <View style={styles.detailIcon}>
                  <Clock color={colors.primary} size={18} />
                </View>
                <Text style={styles.detailLabel}>Cook (min)</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity 
                    style={styles.stepperButton}
                    onPress={() => setCookTime(Math.max(0, cookTime - 5))}
                  >
                    <Minus color={colors.text} size={16} />
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{cookTime}</Text>
                  <TouchableOpacity 
                    style={styles.stepperButton}
                    onPress={() => setCookTime(cookTime + 5)}
                  >
                    <Plus color={colors.text} size={16} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.difficultySection}>
              <View style={styles.detailIcon}>
                <ChefHat color={colors.primary} size={18} />
              </View>
              <Text style={styles.detailLabel}>Difficulty</Text>
              <View style={styles.difficultyOptions}>
                {DIFFICULTY_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.difficultyChip,
                      difficulty === opt && styles.difficultyChipActive
                    ]}
                    onPress={() => setDifficulty(opt)}
                  >
                    <Text style={[
                      styles.difficultyText,
                      difficulty === opt && styles.difficultyTextActive
                    ]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.label}>Ingredients *</Text>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={addIngredient}
              >
                <Plus color={colors.primary} size={18} />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            {ingredients.map((ingredient, index) => (
              <View key={ingredient.id} style={styles.ingredientRow}>
                <TextInput
                  style={[styles.input, styles.amountInput]}
                  placeholder="Amt"
                  placeholderTextColor={colors.textLight}
                  value={ingredient.amount}
                  onChangeText={(val) => updateIngredient(ingredient.id, 'amount', val)}
                />
                <TextInput
                  style={[styles.input, styles.unitInput]}
                  placeholder="Unit"
                  placeholderTextColor={colors.textLight}
                  value={ingredient.unit}
                  onChangeText={(val) => updateIngredient(ingredient.id, 'unit', val)}
                />
                <TextInput
                  style={[styles.input, styles.nameInput]}
                  placeholder="Ingredient name"
                  placeholderTextColor={colors.textLight}
                  value={ingredient.name}
                  onChangeText={(val) => updateIngredient(ingredient.id, 'name', val)}
                />
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => removeIngredient(ingredient.id)}
                >
                  <Trash2 color={colors.textLight} size={18} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.label}>Instructions *</Text>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={addInstruction}
              >
                <Plus color={colors.primary} size={18} />
                <Text style={styles.addButtonText}>Add Step</Text>
              </TouchableOpacity>
            </View>
            {instructions.map((instruction, index) => (
              <View key={index} style={styles.instructionRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.instructionInput]}
                  placeholder="Describe this step..."
                  placeholderTextColor={colors.textLight}
                  value={instruction}
                  onChangeText={(val) => updateInstruction(index, val)}
                  multiline
                />
                <TouchableOpacity 
                  style={styles.removeButton}
                  onPress={() => removeInstruction(index)}
                >
                  <Trash2 color={colors.textLight} size={18} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputInner: {
    flex: 1,
    padding: 14,
    paddingLeft: 10,
    fontSize: 15,
    color: colors.text,
  },
  sourceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  sourceOptionActive: {
    backgroundColor: colors.cream,
    borderColor: colors.primary,
  },
  sourceIcon: {
    fontSize: 14,
  },
  sourceLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500' as const,
  },
  sourceLabelActive: {
    color: colors.primary,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.text,
    textTransform: 'capitalize',
  },
  tagChipTextActive: {
    color: colors.white,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    minWidth: 24,
    textAlign: 'center',
  },
  difficultySection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  difficultyOptions: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  difficultyChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  difficultyChipActive: {
    backgroundColor: colors.primary,
  },
  difficultyText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  difficultyTextActive: {
    color: colors.white,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.primary,
  },
  ingredientRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  amountInput: {
    width: 60,
    textAlign: 'center',
  },
  unitInput: {
    width: 70,
  },
  nameInput: {
    flex: 1,
  },
  removeButton: {
    padding: 8,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.white,
  },
  instructionInput: {
    flex: 1,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  importSection: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  importHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  importTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
  },
  importSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  importInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  importInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  importButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 90,
  },
  importButtonDisabled: {
    opacity: 0.7,
  },
  importButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
  },
  parsingText: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  pasteSection: {
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  pasteTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 4,
  },
  pasteSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  recipeTextInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
    minHeight: 160,
    borderWidth: 1,
    borderColor: colors.border,
  },
  useTextButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  useTextButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.white,
  },
  pasteNote: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
