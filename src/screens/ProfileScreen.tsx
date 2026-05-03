import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks';
import { useAppContext } from '@/context/AppContext';
import { grainApi } from '@/api';
import { Header, Navigation } from '@/components';
import { GRADIENTS, IOS_TYPOGRAPHY } from '@/utils/constants';

const BIO_MAX_LENGTH = 200;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, updateProfileImage, logout, refreshProfile } = useAuth();
  const { showToast } = useAppContext();

  // Refresh profile on focus to sync with web admin changes
  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [])
  );

  const [name, setName] = useState(user?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [location, setLocation] = useState(user?.location || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const isDirty = name !== (user?.name || '') || phoneNumber !== (user?.phoneNumber || '') || location !== (user?.location || '') || bio !== (user?.bio || '');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhoneNumber(user.phoneNumber || '');
      setLocation(user.location || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        location: location.trim(),
        bio: bio.trim(),
      });
      showToast('Profile updated successfully', 'success');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  }, [name, phoneNumber, location, bio, updateProfile, showToast]);

  const handlePickImage = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Update Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: handleCameraLaunch },
      { text: 'Choose from Library', onPress: handleLibraryPick },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const handleCameraLaunch = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showToast('Camera permission denied', 'error');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      await processAndUploadImage(result.assets[0].uri);
    }
  }, []);

  const handleLibraryPick = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Photo library permission denied', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      await processAndUploadImage(result.assets[0].uri);
    }
  }, []);

  const processAndUploadImage = useCallback(async (uri: string) => {
    setIsUploading(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400 } }],
        { compress: 0.5, base64: true },
      );
      if (manipulated.base64) {
        // Validate base64 size (~5MB limit)
        const sizeInBytes = Math.ceil(manipulated.base64.length * 0.75);
        if (sizeInBytes > 5 * 1024 * 1024) {
          showToast('Image too large. Please choose a smaller image.', 'error');
          return;
        }
        // Convert raw base64 to data URI format expected by backend
        const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;
        await updateProfileImage(dataUri);
        showToast('Profile photo updated', 'success');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  }, [updateProfileImage, showToast]);

  const handleChangePassword = useCallback(async () => {
    setPasswordError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }
    setIsChangingPassword(true);
    try {
      await grainApi.profile.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated', 'success');
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  }, [currentPassword, newPassword, confirmPassword, showToast]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/(auth)/login');
          } catch (err) {
            console.error('Logout error:', err);
          }
        },
      },
    ]);
  }, [logout, router]);

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <LinearGradient colors={GRADIENTS.settings} style={styles.gradient}>
        <Header showBack onBack={() => router.back()} />
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={{ flex: 1 }}>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.screenTitle}>My Profile</Text>

            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7} style={styles.avatarContainer}>
                {user?.profileImage ? (
                  <View style={styles.avatarCircle}>
                    <Image
                      source={{ uri: user.profileImage.startsWith('data:') ? user.profileImage : `data:image/jpeg;base64,${user.profileImage}` }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitials}>{getInitials(user?.name || '')}</Text>
                  </View>
                )}
                {isUploading ? (
                  <View style={styles.cameraOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.cameraOverlay}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Edit Profile Form */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>EDIT PROFILE</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder="Enter phone number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Location / Farm Name</Text>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Enter location or farm name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.inputGroup}>
                <View style={styles.bioHeader}>
                  <Text style={styles.inputLabel}>Bio</Text>
                  <Text style={styles.charCounter}>{bio.length}/{BIO_MAX_LENGTH}</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.bioInput]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={BIO_MAX_LENGTH}
                />
              </View>
              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={[styles.saveButton, (isSaving || !isDirty) && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={isSaving || !isDirty}
                  activeOpacity={0.7}
                >
                  {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelButton, !isDirty && styles.buttonDisabled]}
                  onPress={() => {
                    setName(user?.name || '');
                    setPhoneNumber(user?.phoneNumber || '');
                    setLocation(user?.location || '');
                    setBio(user?.bio || '');
                  }}
                  disabled={!isDirty}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Account Settings Card */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>ACCOUNT SETTINGS</Text>
              <TouchableOpacity style={styles.settingsRow} onPress={() => setShowPasswordModal(true)} activeOpacity={0.7}>
                <View style={styles.settingsLeft}>
                  <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
                  <Text style={styles.settingsLabel}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/(app)/alerts' as any)} activeOpacity={0.7}>
                <View style={styles.settingsLeft}>
                  <Ionicons name="notifications-outline" size={20} color="#6B7280" />
                  <Text style={styles.settingsLabel}>Notifications</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsRow} onPress={() => setShowAboutModal(true)} activeOpacity={0.7}>
                <View style={styles.settingsLeft}>
                  <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
                  <Text style={styles.settingsLabel}>About grAIn</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.settingsRow, styles.signOutRow]} onPress={handleSignOut} activeOpacity={0.7}>
                <View style={styles.settingsLeft}>
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                  <Text style={[styles.settingsLabel, { color: '#EF4444' }]}>Sign Out</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Change Password Modal */}
            <Modal visible={showPasswordModal} animationType="slide" transparent={true} onRequestClose={() => setShowPasswordModal(false)}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Change Password</Text>
                    <TouchableOpacity onPress={() => setShowPasswordModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Current Password</Text>
                    <View style={styles.passwordWrapper}>
                      <TextInput
                        style={styles.passwordInput}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        placeholder="Enter current password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showCurrentPassword}
                      />
                      <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>New Password</Text>
                    <View style={styles.passwordWrapper}>
                      <TextInput
                        style={styles.passwordInput}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Enter new password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showNewPassword}
                      />
                      <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Confirm New Password</Text>
                    <View style={styles.passwordWrapper}>
                      <TextInput
                        style={styles.passwordInput}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm new password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showConfirmPassword}
                      />
                      <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                  <TouchableOpacity
                    style={[styles.saveButton, isChangingPassword && styles.buttonDisabled]}
                    onPress={handleChangePassword}
                    disabled={isChangingPassword}
                    activeOpacity={0.7}
                  >
                    {isChangingPassword ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Update Password</Text>}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </Modal>

            {/* About Modal */}
            <Modal visible={showAboutModal} animationType="slide" transparent={true} onRequestClose={() => setShowAboutModal(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.aboutContent}>
                  <TouchableOpacity style={styles.aboutClose} onPress={() => setShowAboutModal(false)}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                  <View style={styles.aboutBody}>
                    <Ionicons name="leaf" size={48} color="#22C55E" />
                    <Text style={styles.aboutTitle}>grAIn</Text>
                    <Text style={styles.aboutVersion}>App Version: v1.0.0</Text>
                    <Text style={styles.aboutCapstone}>AI-Assisted Optimization of IoT Solar-Powered Rice Grain Dryer with Android-Based Monitoring and Predictive Control System</Text>
                    <View style={styles.aboutDivider} />
                    <Text style={styles.aboutSchool}>St. Dominic College of Asia</Text>
                    <Text style={styles.aboutDegree}>BSIT Capstone 1 2026</Text>
                    <View style={styles.aboutDivider} />
                    <Text style={styles.aboutDevLabel}>Developed by:</Text>
                    <Text style={styles.aboutDev}>Elmar Kenneth Radin</Text>
                    <Text style={styles.aboutDev}>Joshua Carlo Santelices</Text>
                    <Text style={styles.aboutDev}>Prince Jin Stephen Moya</Text>
                    <Text style={styles.aboutDev}>Mark John Lar</Text>
                    <View style={styles.aboutDivider} />
                    <Text style={styles.aboutDevLabel}>Adviser:</Text>
                    <Text style={styles.aboutDev}>Dr. Alvin Jason Virata</Text>
                  </View>
                </View>
              </View>
            </Modal>
          </ScrollView>
        </Animated.View>
        <Navigation />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 72, gap: 12 },
  screenTitle: { ...IOS_TYPOGRAPHY.largeTitle, color: '#111111' },
  avatarSection: { alignItems: 'center', paddingVertical: 8 },
  avatarContainer: { position: 'relative' },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#DCFCE7', borderWidth: 3, borderColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarInitials: { fontSize: 28, fontWeight: '700', color: '#22C55E' },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardLabel: {
    ...IOS_TYPOGRAPHY.caption2, fontWeight: '600', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
  },
  inputGroup: { marginBottom: 12 },
  inputLabel: { ...IOS_TYPOGRAPHY.footnote, fontWeight: '600', color: '#374151', marginBottom: 4 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16 },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 17, color: '#111111' },
  eyeButton: { padding: 4 },
  input: {
    ...IOS_TYPOGRAPHY.body, color: '#111111',
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#F9FAFB',
  },
  bioInput: { height: 80, paddingTop: 10, textAlignVertical: 'top' },
  bioHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  charCounter: { ...IOS_TYPOGRAPHY.caption2, color: '#9CA3AF' },
  formButtons: { gap: 8, marginTop: 4 },
  saveButton: {
    backgroundColor: '#22C55E', borderRadius: 50, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  saveButtonText: { color: '#FFFFFF', ...IOS_TYPOGRAPHY.headline },
  cancelButton: {
    borderRadius: 50, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  cancelButtonText: { ...IOS_TYPOGRAPHY.headline, color: '#6B7280' },
  buttonDisabled: { opacity: 0.7 },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsLabel: { ...IOS_TYPOGRAPHY.body, color: '#111111' },
  signOutRow: { borderBottomWidth: 0 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 12,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { ...IOS_TYPOGRAPHY.title2, color: '#111111' },
  errorText: { ...IOS_TYPOGRAPHY.footnote, color: '#EF4444', marginTop: -4 },
  aboutContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, marginHorizontal: 16, marginBottom: 40,
  },
  aboutClose: { alignSelf: 'flex-end', padding: 4 },
  aboutBody: { alignItems: 'center', gap: 6 },
  aboutTitle: { ...IOS_TYPOGRAPHY.largeTitle, color: '#22C55E' },
  aboutVersion: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280' },
  aboutCapstone: { ...IOS_TYPOGRAPHY.callout, color: '#374151', textAlign: 'center', fontWeight: '500', marginTop: 4 },
  aboutDivider: { width: 40, height: 1, backgroundColor: '#E5E7EB', marginVertical: 6 },
  aboutSchool: { ...IOS_TYPOGRAPHY.headline, color: '#111111' },
  aboutDegree: { ...IOS_TYPOGRAPHY.footnote, color: '#6B7280' },
  aboutDevLabel: { ...IOS_TYPOGRAPHY.caption1, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase' },
  aboutDev: { ...IOS_TYPOGRAPHY.footnote, color: '#374151' },
});
