import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Privacy Policy</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <X size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={styles.lastUpdated}>Last updated: February 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Introduction</Text>
          <Text style={styles.paragraph}>
            Welcome to Kitchen Butler (we, our, or us). We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our mobile application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Information We Collect</Text>
          <Text style={styles.paragraph}>
            We collect information that you provide directly to us, including:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Recipe data (titles, ingredients, instructions)</Text>
            <Text style={styles.bulletItem}>• Pantry inventory information</Text>
            <Text style={styles.bulletItem}>• Cooking preferences and dietary restrictions</Text>
            <Text style={styles.bulletItem}>• Household size preferences</Text>
            <Text style={styles.bulletItem}>• Subscription and payment information (processed securely via RevenueCat)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            We use the information we collect to:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Provide, maintain, and improve our services</Text>
            <Text style={styles.bulletItem}>• Personalize your cooking experience</Text>
            <Text style={styles.bulletItem}>• Sync your data across devices</Text>
            <Text style={styles.bulletItem}>• Process subscriptions and transactions</Text>
            <Text style={styles.bulletItem}>• Send you updates about our services (with your consent)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Data Storage & Security</Text>
          <Text style={styles.paragraph}>
            Your data is stored securely on your device and, if you opt into cloud sync, on our secure servers. We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Data Sharing</Text>
          <Text style={styles.paragraph}>
            We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• With service providers who assist in operating our app (e.g., payment processing)</Text>
            <Text style={styles.bulletItem}>• To comply with legal obligations</Text>
            <Text style={styles.bulletItem}>• To protect our rights and safety</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Your Rights</Text>
          <Text style={styles.paragraph}>
            You have the right to:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Access your personal data</Text>
            <Text style={styles.bulletItem}>• Correct inaccurate data</Text>
            <Text style={styles.bulletItem}>• Delete your data</Text>
            <Text style={styles.bulletItem}>• Export your data</Text>
            <Text style={styles.bulletItem}>• Withdraw consent at any time</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Children&apos;s Privacy</Text>
          <Text style={styles.paragraph}>
            Our app is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Changes to This Policy</Text>
          <Text style={styles.paragraph}>
            We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the Last Updated date.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about this privacy policy or our data practices, please contact us at support@kitchenbutler.app
          </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.text,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  bulletList: {
    marginTop: 8,
    gap: 6,
  },
  bulletItem: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    paddingLeft: 4,
  },
});
