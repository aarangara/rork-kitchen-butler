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

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Terms of Service</Text>
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
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By downloading, installing, or using Kitchen Butler (the App), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Description of Service</Text>
          <Text style={styles.paragraph}>
            Kitchen Butler is a mobile application that helps you manage recipes, track pantry items, and discover meals based on available ingredients. The App offers both free and premium subscription tiers with different feature sets.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. User Accounts</Text>
          <Text style={styles.paragraph}>
            The App uses device-based identification to sync your data. You are responsible for maintaining the confidentiality of your device and any data stored on it. You agree to accept responsibility for all activities that occur under your account or device.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Subscription & Payments</Text>
          <Text style={styles.paragraph}>
            Premium features are available through subscription plans. By subscribing:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Payment will be charged to your Apple App Store or Google Play account</Text>
            <Text style={styles.bulletItem}>• Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period</Text>
            <Text style={styles.bulletItem}>• You can manage or cancel your subscription through your device&apos;s app store settings</Text>
            <Text style={styles.bulletItem}>• No refunds will be provided for partial subscription periods</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. User Content</Text>
          <Text style={styles.paragraph}>
            You retain ownership of any recipes, notes, or other content you create in the App (User Content). By using the App, you grant us a limited license to store, process, and display your User Content solely for the purpose of providing and improving our services.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Acceptable Use</Text>
          <Text style={styles.paragraph}>
            You agree not to:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Use the App for any unlawful purpose</Text>
            <Text style={styles.bulletItem}>• Attempt to gain unauthorized access to our systems</Text>
            <Text style={styles.bulletItem}>• Interfere with or disrupt the App&apos;s functionality</Text>
            <Text style={styles.bulletItem}>• Reverse engineer or decompile the App</Text>
            <Text style={styles.bulletItem}>• Use automated systems to access the App without permission</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Intellectual Property</Text>
          <Text style={styles.paragraph}>
            The App, including its design, features, and content (excluding User Content), is owned by us and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written permission.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Disclaimer of Warranties</Text>
          <Text style={styles.paragraph}>
            The App is provided as-is without warranties of any kind. We do not guarantee that the App will be error-free, secure, or continuously available. Recipe suggestions are for informational purposes only and should not replace professional dietary or medical advice.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App, including but not limited to dietary decisions, food allergies, or data loss.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Modifications to Terms</Text>
          <Text style={styles.paragraph}>
            We reserve the right to modify these terms at any time. We will notify you of significant changes through the App or via email. Your continued use of the App after changes constitutes acceptance of the modified terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Termination</Text>
          <Text style={styles.paragraph}>
            We may terminate or suspend your access to the App at any time, without prior notice, for conduct that we believe violates these terms or is harmful to other users, us, or third parties.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Governing Law</Text>
          <Text style={styles.paragraph}>
            These terms shall be governed by and construed in accordance with the laws of the United Kingdom, without regard to its conflict of law provisions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. Contact Information</Text>
          <Text style={styles.paragraph}>
            For any questions regarding these Terms of Service, please contact us at support@kitchenbutler.app
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
