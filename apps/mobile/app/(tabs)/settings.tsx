import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    AlertCircle,
    Bell,
    ChevronRight,
    Edit2,
    FileText,
    HelpCircle,
    Lock,
    LogOut,
    Mail,
    MapPin,
    Phone,
    Save,
    User,
    WifiOff,
    X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../firebase.config';
import { useFirebaseConnection } from '../../hooks/use-firebase-connection';
import { ThemedView } from '../../components/themed-view';

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  documentUpdates: boolean;
  securityAlerts: boolean;
}

export default function Settings() {
  const { isOnline } = useFirebaseConnection();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedData, setEditedData] = useState<UserData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings>({
    pushNotifications: true,
    emailNotifications: true,
    documentUpdates: true,
    securityAlerts: true,
  });

  // Check for pending changes when coming back online
  useEffect(() => {
    if (isOnline && userData) {
      AsyncStorage.getItem('pendingProfileChanges')
        .then(async (pending) => {
          if (pending) {
            const pendingChanges = JSON.parse(pending);
            const updateFn = httpsCallable(functions, 'updateUserProfile');
            try {
              await updateFn(pendingChanges);
              await AsyncStorage.removeItem('pendingProfileChanges');
              Alert.alert('Success', 'Pending changes synced successfully');
            } catch (error: any) {
              console.error('Error syncing pending changes:', error);
              // Keep the pending changes for next attempt
            }
          }
        })
        .catch(() => {});
    }
  }, [isOnline, userData]);

  useEffect(() => {
    // Listen for auth state and then attach Firestore listeners for the user
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserData(null);
        setEditedData(null);
        return;
      }

      const uid = user.uid;
      const userDocRef = doc(db, 'users', uid);

      // Try to load cached data first
      AsyncStorage.getItem('userData')
        .then((cached) => {
          if (cached) {
            const data = JSON.parse(cached) as UserData;
            setUserData(data);
            setEditedData(data);
          }
        })
        .catch(() => {});

      const unsubProfile = onSnapshot(userDocRef, (snap) => {
        setError(null);
        if (snap.exists()) {
          const data = snap.data() as UserData;
          setUserData(data);
          setEditedData(data);
          AsyncStorage.setItem('userData', JSON.stringify(data)).catch(() => {});
        } else {
          setUserData(null);
          setEditedData(null);
        }
      }, (err) => {
        console.error('Settings profile onSnapshot error:', err);
        setError(err.message);
      });

      // cleanup when auth changes
      return () => {
        unsubProfile();
      };
    });

    return () => unsubAuth();
  }, []);

  const handleSaveProfile = async () => {
    if (!editedData?.firstName || !editedData?.lastName || !editedData?.email) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isOnline) {
      Alert.alert(
        'Offline Mode',
        'You are currently offline. Changes will be saved locally and synced when you\'re back online.',
        [
          { 
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Save Locally',
            onPress: async () => {
              try {
                await AsyncStorage.setItem('pendingProfileChanges', JSON.stringify(editedData));
                setUserData(editedData);
                setIsEditingProfile(false);
                Alert.alert('Success', 'Changes saved locally and will sync when online');
              } catch (error) {
                console.error('Error saving locally:', error);
                Alert.alert('Error', 'Failed to save changes locally');
              }
            }
          }
        ]
      );
      return;
    }

    try {
      // Call server-side callable to validate and save profile
      const updateFn = httpsCallable(functions, 'updateUserProfile');
      await updateFn({
        firstName: editedData.firstName,
        lastName: editedData.lastName,
        email: editedData.email,
        phone: editedData.phone,
        address: editedData.address,
        city: editedData.city,
        state: editedData.state,
        zipCode: editedData.zipCode,
      });

      // Clear any pending changes
      await AsyncStorage.removeItem('pendingProfileChanges');

      // UI will update from Firestore onSnapshot; provide immediate feedback
      setIsEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error?.message || 'Failed to save profile. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditedData(userData);
    setIsEditingProfile(false);
  };

  const updateNotificationSetting = async (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    const newSettings = { ...notifications, [key]: value };
    setNotifications(newSettings);
    
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? Your data will remain saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            // In a real app, you might clear auth tokens here
            Alert.alert('Logged Out', 'You have been logged out successfully');
          },
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your saved information and document progress. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'userData',
                'documentProgress',
                'notificationSettings',
              ]);
              setUserData(null);
              Alert.alert('Success', 'All data has been cleared');
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  if (!userData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <User size={64} color="#9ca3af" />
          <Text style={styles.emptyStateTitle}>No Profile Found</Text>
          <Text style={styles.emptyStateText}>
            Please complete your profile in the Home tab to access settings
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {!isOnline && (
        <ThemedView style={styles.offlineBar}>
          <WifiOff size={16} color="#fff" />
          <Text style={styles.offlineText}>You're offline - some features may be limited</Text>
        </ThemedView>
      )}
      {error && (
        <ThemedView style={styles.errorBar}>
          <AlertCircle size={16} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </ThemedView>
      )}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            {!isEditingProfile ? (
              <TouchableOpacity
                onPress={() => setIsEditingProfile(true)}
                style={styles.editButton}
              >
                <Edit2 size={20} color="#2563eb" />
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={handleCancelEdit}
                  style={styles.cancelButton}
                >
                  <X size={20} color="#6b7280" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveProfile}
                  style={styles.saveButton}
                >
                  <Save size={20} color="#10b981" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <User size={40} color="#ffffff" />
            </View>
            <View style={styles.profileInfo}>
              {isEditingProfile && editedData ? (
                <View style={styles.editForm}>
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.editInput}
                      value={editedData.firstName}
                      onChangeText={(text) =>
                        setEditedData({ ...editedData, firstName: text })
                      }
                      placeholder="First Name"
                    />
                    <TextInput
                      style={styles.editInput}
                      value={editedData.lastName}
                      onChangeText={(text) =>
                        setEditedData({ ...editedData, lastName: text })
                      }
                      placeholder="Last Name"
                    />
                  </View>
                  <TextInput
                    style={[styles.editInput, { width: '100%' }]}
                    value={editedData.email}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, email: text })
                    }
                    placeholder="Email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={[styles.editInput, { width: '100%' }]}
                    value={editedData.phone}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, phone: text })
                    }
                    placeholder="Phone"
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={[styles.editInput, { width: '100%' }]}
                    value={editedData.address}
                    onChangeText={(text) =>
                      setEditedData({ ...editedData, address: text })
                    }
                    placeholder="Address"
                  />
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.editInput, { flex: 1 }]}
                      value={editedData.city}
                      onChangeText={(text) =>
                        setEditedData({ ...editedData, city: text })
                      }
                      placeholder="City"
                    />
                    <TextInput
                      style={[styles.editInput, { width: 60 }]}
                      value={editedData.state}
                      onChangeText={(text) =>
                        setEditedData({ ...editedData, state: text })
                      }
                      placeholder="State"
                      maxLength={2}
                      autoCapitalize="characters"
                    />
                    <TextInput
                      style={[styles.editInput, { width: 80 }]}
                      value={editedData.zipCode}
                      onChangeText={(text) =>
                        setEditedData({ ...editedData, zipCode: text })
                      }
                      placeholder="Zip"
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.profileName}>
                    {userData.firstName} {userData.lastName}
                  </Text>
                  <View style={styles.profileDetail}>
                    <Mail size={14} color="#6b7280" />
                    <Text style={styles.profileDetailText}>{userData.email}</Text>
                  </View>
                  {userData.phone && (
                    <View style={styles.profileDetail}>
                      <Phone size={14} color="#6b7280" />
                      <Text style={styles.profileDetailText}>{userData.phone}</Text>
                    </View>
                  )}
                  {userData.address && (
                    <View style={styles.profileDetail}>
                      <MapPin size={14} color="#6b7280" />
                      <Text style={styles.profileDetailText}>
                        {userData.address}, {userData.city}, {userData.state} {userData.zipCode}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Bell size={20} color="#2563eb" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive updates on your device
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.pushNotifications}
              onValueChange={(value) =>
                updateNotificationSetting('pushNotifications', value)
              }
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={notifications.pushNotifications ? '#2563eb' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Mail size={20} color="#2563eb" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Email Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive updates via email
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.emailNotifications}
              onValueChange={(value) =>
                updateNotificationSetting('emailNotifications', value)
              }
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={notifications.emailNotifications ? '#2563eb' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <FileText size={20} color="#2563eb" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Document Updates</Text>
                <Text style={styles.settingDescription}>
                  Notify about document status changes
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.documentUpdates}
              onValueChange={(value) =>
                updateNotificationSetting('documentUpdates', value)
              }
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={notifications.documentUpdates ? '#2563eb' : '#f3f4f6'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Lock size={20} color="#2563eb" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Security Alerts</Text>
                <Text style={styles.settingDescription}>
                  Important security notifications
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.securityAlerts}
              onValueChange={(value) =>
                updateNotificationSetting('securityAlerts', value)
              }
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={notifications.securityAlerts ? '#2563eb' : '#f3f4f6'}
            />
          </View>
        </View>

        {/* Support & About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & About</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <HelpCircle size={20} color="#2563eb" />
              <Text style={styles.menuLabel}>Help Center</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <FileText size={20} color="#2563eb" />
              <Text style={styles.menuLabel}>Terms of Service</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Lock size={20} color="#2563eb" />
              <Text style={styles.menuLabel}>Privacy Policy</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuLeft}>
              <LogOut size={20} color="#f59e0b" />
              <Text style={[styles.menuLabel, { color: '#f59e0b' }]}>Logout</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleClearAllData}>
            <View style={styles.menuLeft}>
              <X size={20} color="#ef4444" />
              <Text style={[styles.menuLabel, { color: '#ef4444' }]}>
                Clear All Data
              </Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Version */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>DocuTrack v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  offlineBar: {
    backgroundColor: '#f59e0b',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  offlineText: {
    color: '#fff',
    fontSize: 14,
  },
  errorBar: {
    backgroundColor: '#ef4444',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  editButton: {
    padding: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    padding: 8,
  },
  saveButton: {
    padding: 8,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  profileDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  profileDetailText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  editForm: {
    gap: 12,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  versionText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});