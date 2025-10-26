import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
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
    Upload,
    X
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
];

export default function HomeTab() {
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const savedUserData = await AsyncStorage.getItem('userData');
      const savedProgress = await AsyncStorage.getItem('documentProgress');

      if (savedUserData) {
        setUserData(JSON.parse(savedUserData));
        setIsSignedUp(true);
      }

      if (savedProgress) {
        setDocumentProgress(JSON.parse(savedProgress));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!userData.firstName || !userData.lastName || !userData.email) {
      Alert.alert('Required Fields', 'Please fill in at least your name and email');
      return;
    }

    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setIsSignedUp(true);
    } catch (error) {
      console.error('Error saving user data:', error);
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
    
    const newProgress = {
      ...documentProgress,
      [selectedDocument.id]: {
        status: 'in_progress' as const,
        updatedAt: new Date().toISOString(),
        requestType: 'request_replacement' as const,
      },
    };
    
    try {
      await AsyncStorage.setItem('documentProgress', JSON.stringify(newProgress));
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
      await AsyncStorage.setItem('documentProgress', JSON.stringify(newProgress));
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

  if (!isSignedUp) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to DocuTrack</Text>
            <Text style={styles.subtitle}>
              Let's get started by setting up your profile
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

            <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
              <Text style={styles.signUpButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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