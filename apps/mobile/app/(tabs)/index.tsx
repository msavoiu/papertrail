import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import {
    Camera,
    Check,
    CheckCircle,
    Circle,
    Clock,
    CreditCard,
    File,
    FileQuestion,
    FileText,
    Lock,
    Mail,
    Upload,
    X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Firebase imports
import { initializeApp } from 'firebase/app';
import {
    createUserWithEmailAndPassword,
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithCredential,
    signInWithEmailAndPassword
} from 'firebase/auth';
import {
    doc,
    getDoc,
    getFirestore,
    setDoc
} from 'firebase/firestore';

WebBrowser.maybeCompleteAuthSession();

// Initialize Firebase
const extra = Constants.expoConfig?.extra ?? {};
const firebaseConfig = {
  apiKey: extra.firebaseApiKey,
  authDomain: extra.firebaseAuthDomain,
  projectId: extra.firebaseProjectId,
  storageBucket: extra.firebaseStorageBucket,
  messagingSenderId: extra.firebaseMessagingSenderId,
  appId: extra.firebaseAppId,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

interface DocumentProgress {
  [key: string]: {
    status: 'not_started' | 'in_progress' | 'completed';
    updatedAt: string;
    frontImage?: string;
    backImage?: string;
    additionalFiles?: string[];
    uploadedFileName?: string;
    requestType?: 'upload' | 'request_replacement';
  };
}

const DOCUMENT_TYPES = [
  {
    id: 'drivers_license',
    title: "Driver's License",
    description: 'Upload or request replacement',
    icon: CreditCard,
    estimatedTime: '2-3 weeks',
    requiresBothSides: true,
  },
  {
    id: 'birth_certificate',
    title: 'Birth Certificate',
    description: 'Upload or request official copy',
    icon: FileText,
    estimatedTime: '4-6 weeks',
    requiresBothSides: false,
  },
  {
    id: 'social_security',
    title: 'Social Security Card',
    description: 'Upload or request replacement',
    icon: CreditCard,
    estimatedTime: '2-4 weeks',
    requiresBothSides: false,
  },
  {
    id: 'passport',
    title: 'Passport',
    description: 'Upload or apply/renew',
    icon: FileText,
    estimatedTime: '6-8 weeks',
    requiresBothSides: false,
  },
  {
    id: 'medical_records',
    title: 'Medical Records',
    description: 'Upload health records',
    icon: FileText,
    estimatedTime: '1-2 weeks',
    requiresBothSides: false,
  },
  {
    id: 'insurance_card',
    title: 'Insurance Card',
    description: 'Health insurance information',
    icon: CreditCard,
    estimatedTime: '1-2 weeks',
    requiresBothSides: true,
  },
  {
    id: 'disability_determination',
    title: 'Disability Determination',
    description: 'SSA disability decision letter',
    icon: FileText,
    estimatedTime: '4-6 weeks',
    requiresBothSides: false,
  },
  {
    id: 'medicaid_card',
    title: 'Medicaid Card',
    description: 'State Medicaid benefits card',
    icon: CreditCard,
    estimatedTime: '2-3 weeks',
    requiresBothSides: true,
  },
  {
    id: 'veterans_id',
    title: "Veteran's ID",
    description: 'VA identification card',
    icon: CreditCard,
    estimatedTime: '3-4 weeks',
    requiresBothSides: true,
  },
  {
    id: 'housing_voucher',
    title: 'Housing Voucher',
    description: 'Section 8 or housing assistance',
    icon: FileText,
    estimatedTime: '2-4 weeks',
    requiresBothSides: false,
  },
  {
    id: 'snap_benefits',
    title: 'SNAP/EBT Card',
    description: 'Food assistance benefits',
    icon: CreditCard,
    estimatedTime: '1-2 weeks',
    requiresBothSides: true,
  },
  {
    id: 'employment_records',
    title: 'Employment Records',
    description: 'Work history and pay stubs',
    icon: FileText,
    estimatedTime: '1-2 weeks',
    requiresBothSides: false,
  },
];

export default function HomeTab() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  
  const [hasProfile, setHasProfile] = useState(false);
  const [userData, setUserData] = useState<UserData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });
  const [documentProgress, setDocumentProgress] = useState<DocumentProgress>({});
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<string[]>([]);

  // Google Sign In Configuration
  const redirectUri = 'https://auth.expo.io/@markrgarcia/PaperTrail';

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: extra.webClientId,
    redirectUri: redirectUri,
    responseType: 'id_token',
    scopes: ['openid', 'profile', 'email'],
  });

  // Debug: Log the redirect URI (remove this after testing)
  useEffect(() => {
    console.log('=== AUTH SETUP ===');
    console.log('Redirect URI:', redirectUri);
    console.log('Web Client ID:', extra.webClientId);
    console.log('Request ready:', !!request);
    console.log('Response:', JSON.stringify(response, null, 2));
  }, [response, request]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
        await loadUserProfile(user.uid);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setHasProfile(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log('🔔 Response changed:', response?.type);
    if (response?.type === 'success') {
      console.log('✅ Google auth success! Full response:', JSON.stringify(response, null, 2));
      console.log('📦 Response params:', response.params);
      const { id_token } = response.params;
      if (id_token) {
        console.log('🎫 ID Token received, length:', id_token.length);
        const credential = GoogleAuthProvider.credential(id_token);
        handleGoogleSignIn(credential);
      } else {
        console.error('❌ No id_token in response params:', response.params);
        Alert.alert('Error', 'No ID token received from Google');
      }
    } else if (response?.type === 'error') {
      console.error('❌ Google auth error:', response.error);
      Alert.alert('Error', `Google sign-in failed: ${response.error}`);
    } else if (response?.type === 'cancel') {
      console.log('🚫 Google auth cancelled');
    }
  }, [response]);

  const loadUserProfile = async (userId: string) => {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data as UserData);
        setHasProfile(true);
      } else {
        setHasProfile(false);
      }

      const progressDocRef = doc(db, 'users', userId, 'documents', 'progress');
      const progressDoc = await getDoc(progressDocRef);
      if (progressDoc.exists()) {
        setDocumentProgress(progressDoc.data() as DocumentProgress);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const handleEmailSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Required Fields', 'Please enter email and password');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters');
      return;
    }

    try {
      setIsLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setCurrentUser(userCredential.user);
      Alert.alert('Success', 'Account created successfully!');
    } catch (error: any) {
      console.error('Sign up error:', error);
      Alert.alert('Sign Up Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Required Fields', 'Please enter email and password');
      return;
    }

    try {
      setIsLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setCurrentUser(userCredential.user);
    } catch (error: any) {
      console.error('Sign in error:', error);
      Alert.alert('Sign In Failed', 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async (credential: any) => {
    try {
      setIsLoading(true);
      console.log('Attempting Firebase signInWithCredential...');
      const userCredential = await signInWithCredential(auth, credential);
      console.log('Sign in successful!', userCredential.user.email);
      setCurrentUser(userCredential.user);
      
      // Auto-populate email from Google account
      if (userCredential.user.email) {
        setUserData(prev => ({ ...prev, email: userCredential.user.email! }));
      }
      Alert.alert('Success', 'Signed in with Google!');
    } catch (error: any) {
      console.error('Google sign in error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      Alert.alert('Sign In Failed', `Error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!userData.firstName || !userData.lastName || !userData.email) {
      Alert.alert('Required Fields', 'Please fill in at least your name and email');
      return;
    }

    if (!currentUser) return;

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, userData);
      setHasProfile(true);
      Alert.alert('Success', 'Profile created successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save your information. Please try again.');
    }
  };

  const handleDocumentPress = (doc: any) => {
    setSelectedDocument(doc);
    setShowActionModal(true);
  };

  const handleUploadDocument = () => {
    setShowActionModal(false);
    setFrontImage(null);
    setBackImage(null);
    setAdditionalFiles([]);
    setTimeout(() => setShowUploadModal(true), 300);
  };

  const handleRequestReplacement = async () => {
    setShowActionModal(false);
    
    if (!currentUser) return;

    const newProgress = {
      ...documentProgress,
      [selectedDocument.id]: {
        status: 'in_progress' as const,
        updatedAt: new Date().toISOString(),
        requestType: 'request_replacement' as const,
      },
    };
    
    try {
      const progressDocRef = doc(db, 'users', currentUser.uid, 'documents', 'progress');
      await setDoc(progressDocRef, newProgress);
      setDocumentProgress(newProgress);
      Alert.alert(
        'Request Submitted',
        `Your ${selectedDocument.title} replacement request has been submitted. Estimated time: ${selectedDocument.estimatedTime}`
      );
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const pickImage = async (side: 'front' | 'back') => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Camera permission is required to take photos');
      return;
    }

    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              if (side === 'front') {
                setFrontImage(result.assets[0].uri);
              } else {
                setBackImage(result.assets[0].uri);
              }
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              if (side === 'front') {
                setFrontImage(result.assets[0].uri);
              } else {
                setBackImage(result.assets[0].uri);
              }
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        setAdditionalFiles([...additionalFiles, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const removeAdditionalFile = (index: number) => {
    setAdditionalFiles(additionalFiles.filter((_, i) => i !== index));
  };

  const handleSubmitUpload = async () => {
    if (!frontImage && additionalFiles.length === 0) {
      Alert.alert('Required', 'Please upload at least one document');
      return;
    }

    if (selectedDocument.requiresBothSides && !backImage) {
      Alert.alert('Required', 'Please upload both front and back of the document');
      return;
    }

    if (!currentUser) return;

    const newProgress = {
      ...documentProgress,
      [selectedDocument.id]: {
        status: 'completed' as const,
        updatedAt: new Date().toISOString(),
        frontImage,
        backImage,
        additionalFiles,
        uploadedFileName: `${selectedDocument.title}.pdf`,
        requestType: 'upload' as const,
      },
    };

    try {
      const progressDocRef = doc(db, 'users', currentUser.uid, 'documents', 'progress');
      await setDoc(progressDocRef, newProgress);
      setDocumentProgress(newProgress);
      setShowUploadModal(false);
      Alert.alert('Success', `${selectedDocument.title} has been uploaded successfully!`);
    } catch (error) {
      console.error('Error saving upload:', error);
      Alert.alert('Error', 'Failed to save document. Please try again.');
    }
  };

  const getStatusIcon = (documentId: string) => {
    const status = documentProgress[documentId]?.status || 'not_started';
    
    switch (status) {
      case 'completed':
        return <CheckCircle size={20} color="#10b981" />;
      case 'in_progress':
        return <Clock size={20} color="#f59e0b" />;
      default:
        return <Circle size={20} color="#9ca3af" />;
    }
  };

  const getStatusText = (documentId: string) => {
    const progress = documentProgress[documentId];
    if (!progress) return 'Not Started';
    
    if (progress.status === 'completed') {
      return progress.requestType === 'upload' ? 'Uploaded' : 'Completed';
    }
    if (progress.status === 'in_progress') {
      return progress.requestType === 'request_replacement' ? 'Requested' : 'In Progress';
    }
    return 'Not Started';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  // Authentication Screen
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.authHeader}>
            <Text style={styles.authTitle}>Welcome to DocuTrack</Text>
            <Text style={styles.authSubtitle}>
              {authMode === 'signin' 
                ? 'Sign in to access your documents' 
                : 'Create an account to get started'}
            </Text>
          </View>

          <View style={styles.authForm}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWithIcon}>
                <Mail size={20} color="#6b7280" />
                <TextInput
                  style={styles.inputField}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWithIcon}>
                <Lock size={20} color="#6b7280" />
                <TextInput
                  style={styles.inputField}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            {authMode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWithIcon}>
                  <Lock size={20} color="#6b7280" />
                  <TextInput
                    style={styles.inputField}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    secureTextEntry
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={authMode === 'signin' ? handleEmailSignIn : handleEmailSignUp}
            >
              <Text style={styles.primaryButtonText}>
                {authMode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => {
                console.log('Google button pressed');
                console.log('Request object:', request);
                console.log('Redirect URI:', redirectUri);
                promptAsync();
              }}
              disabled={!request}
            >
              <View style={styles.googleIcon}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
            >
              <Text style={styles.switchModeText}>
                {authMode === 'signin' 
                  ? "Don't have an account? Sign Up" 
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Profile Setup Screen
  if (!hasProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Let's set up your information to get started
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={userData.firstName}
                onChangeText={(text) => setUserData({ ...userData, firstName: text })}
                placeholder="John"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput
                style={styles.input}
                value={userData.lastName}
                onChangeText={(text) => setUserData({ ...userData, lastName: text })}
                placeholder="Doe"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={userData.email}
                onChangeText={(text) => setUserData({ ...userData, email: text })}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={userData.phone}
                onChangeText={(text) => setUserData({ ...userData, phone: text })}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                style={styles.input}
                value={userData.address}
                onChangeText={(text) => setUserData({ ...userData, address: text })}
                placeholder="123 Main St"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  value={userData.city}
                  onChangeText={(text) => setUserData({ ...userData, city: text })}
                  placeholder="San Francisco"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={[styles.inputGroup, { width: 80, marginRight: 8 }]}>
                <Text style={styles.label}>State</Text>
                <TextInput
                  style={styles.input}
                  value={userData.state}
                  onChangeText={(text) => setUserData({ ...userData, state: text })}
                  placeholder="CA"
                  maxLength={2}
                  autoCapitalize="characters"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={[styles.inputGroup, { width: 100 }]}>
                <Text style={styles.label}>Zip Code</Text>
                <TextInput
                  style={styles.input}
                  value={userData.zipCode}
                  onChangeText={(text) => setUserData({ ...userData, zipCode: text })}
                  placeholder="94102"
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.signUpButton} onPress={handleCreateProfile}>
              <Text style={styles.signUpButtonText}>Complete Profile</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main Dashboard
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{userData.firstName}!</Text>
          <Text style={styles.subtitle}>Upload or request your documents</Text>
        </View>

        <View style={styles.documentsContainer}>
          {DOCUMENT_TYPES.map((doc) => {
            const Icon = doc.icon;
            const status = documentProgress[doc.id]?.status || 'not_started';

            return (
              <TouchableOpacity
                key={doc.id}
                style={styles.documentCard}
                onPress={() => handleDocumentPress(doc)}
              >
                <View style={styles.documentIconContainer}>
                  <Icon size={24} color="#2563eb" />
                </View>

                <View style={styles.documentContent}>
                  <Text style={styles.documentTitle}>{doc.title}</Text>
                  <Text style={styles.documentDescription}>{doc.description}</Text>
                  <View style={styles.documentFooter}>
                    <Text style={styles.estimatedTime}>⏱️ {doc.estimatedTime}</Text>
                    <View style={styles.statusBadge}>
                      {getStatusIcon(doc.id)}
                      <Text style={[
                        styles.statusText,
                        status === 'completed' && styles.statusCompleted,
                        status === 'in_progress' && styles.statusInProgress,
                      ]}>
                        {getStatusText(doc.id)}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Action Selection Modal */}
      <Modal
        visible={showActionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDocument?.title}
              </Text>
              <TouchableOpacity onPress={() => setShowActionModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>What would you like to do?</Text>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={handleUploadDocument}
              >
                <View style={styles.actionIconContainer}>
                  <Upload size={32} color="#2563eb" />
                </View>
                <Text style={styles.actionTitle}>Upload Existing Document</Text>
                <Text style={styles.actionDescription}>
                  I have the document and want to upload it
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={handleRequestReplacement}
              >
                <View style={styles.actionIconContainer}>
                  <FileQuestion size={32} color="#7c3aed" />
                </View>
                <Text style={styles.actionTitle}>Request Replacement</Text>
                <Text style={styles.actionDescription}>
                  I lost my document and need a replacement
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.uploadModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload {selectedDocument?.title}</Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.uploadScroll}>
              {/* Front Image */}
              <View style={styles.uploadSection}>
                <Text style={styles.uploadLabel}>
                  Front {selectedDocument?.requiresBothSides && '*'}
                </Text>
                {frontImage ? (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: frontImage }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => setFrontImage(null)}
                    >
                      <X size={16} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={() => pickImage('front')}
                  >
                    <Camera size={24} color="#6b7280" />
                    <Text style={styles.uploadButtonText}>Take or Choose Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Back Image */}
              {selectedDocument?.requiresBothSides && (
                <View style={styles.uploadSection}>
                  <Text style={styles.uploadLabel}>Back *</Text>
                  {backImage ? (
                    <View style={styles.previewContainer}>
                      <Image source={{ uri: backImage }} style={styles.previewImage} />
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => setBackImage(null)}
                      >
                        <X size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={() => pickImage('back')}
                    >
                      <Camera size={24} color="#6b7280" />
                      <Text style={styles.uploadButtonText}>Take or Choose Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Additional Files */}
              <View style={styles.uploadSection}>
                <Text style={styles.uploadLabel}>Additional Files (Optional)</Text>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={pickDocument}
                >
                  <File size={24} color="#6b7280" />
                  <Text style={styles.uploadButtonText}>Add PDF or Image</Text>
                </TouchableOpacity>

                {additionalFiles.map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <File size={20} color="#2563eb" />
                    <Text style={styles.fileName} numberOfLines={1}>
                      File {index + 1}
                    </Text>
                    <TouchableOpacity onPress={() => removeAdditionalFile(index)}>
                      <X size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmitUpload}
              >
                <Check size={20} color="#ffffff" />
                <Text style={styles.submitButtonText}>Submit Upload</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  authHeader: {
    marginBottom: 32,
    alignItems: 'center',
  },
  authTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  authForm: {
    gap: 16,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 12,
  },
  inputField: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6b7280',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  googleIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#4285f4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  switchModeButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  switchModeText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 20,
    color: '#6b7280',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
  },
  signUpButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  signUpButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  documentsContainer: {
    gap: 16,
  },
  documentCard: {
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
  documentIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#eff6ff',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentContent: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  documentDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  documentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estimatedTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9ca3af',
  },
  statusCompleted: {
    color: '#10b981',
  },
  statusInProgress: {
    color: '#f59e0b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  uploadModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  actionButtons: {
    gap: 16,
  },
  actionCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  actionIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#ffffff',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  uploadScroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  uploadButton: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 12,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});