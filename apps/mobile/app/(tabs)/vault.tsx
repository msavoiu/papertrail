import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    AlertCircle,
    Check,
    Download,
    Edit,
    Eye,
    EyeOff,
    FileText,
    Lock,
    Search,
    Share2,
    Shield,
    WifiOff,
    X,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
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
  dateOfBirth?: string;
  socialSecurity?: string;
}

interface DocumentProgress {
  [key: string]: {
    status: 'not_started' | 'in_progress' | 'completed';
    updatedAt: string;
    uploadedFileName?: string;
  };
}

interface Document {
  id: string;
  name: string;
  type: string;
  date: string;
  status: string;
  size: string;
}

type DocTypes = typeof docTypes;
type DocTypeKeys = keyof DocTypes;

const docTypes = {
  drivers_license: {
    name: "Driver's License",
    requiresBothSides: true,
  },
  birth_certificate: {
    name: 'Birth Certificate',
    requiresBothSides: false,
  },
  social_security: {
    name: 'Social Security Card',
    requiresBothSides: false,
  },
  passport: {
    name: 'Passport',
    requiresBothSides: false,
  },
  medical_records: {
    name: 'Medical Records',
    requiresBothSides: false,
  },
  insurance_card: {
    name: 'Insurance Card',
    requiresBothSides: true,
  },
} as const;

export default function VaultTab() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [editedUserData, setEditedUserData] = useState<UserData | null>(null);
  const [documentProgress, setDocumentProgress] = useState<DocumentProgress>({});
  const [showSensitive, setShowSensitive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingPersonalInfo, setIsEditingPersonalInfo] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocTypeKeys | ''>('');
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const { isOnline } = useFirebaseConnection();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to auth state and then listen to Firestore documents for the user
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserData(null);
        setEditedUserData(null);
        setDocumentProgress({});
        return;
      }

      const uid = user.uid;
      const userDocRef = doc(db, 'users', uid);
      const progressDocRef = doc(db, 'users', uid, 'documents', 'progress');

      // Try to load cached data first
      AsyncStorage.getItem('userData')
        .then((cached) => {
          if (cached) {
            const data = JSON.parse(cached) as UserData;
            setUserData(data);
            setEditedUserData(data);
          }
        })
        .catch(() => {});

      const unsubProfile = onSnapshot(userDocRef, (snap) => {
        setError(null);
        if (snap.exists()) {
          const data = snap.data() as UserData;
          setUserData(data);
          setEditedUserData(data);
          // cache for faster startup
          AsyncStorage.setItem('userData', JSON.stringify(data)).catch(() => {});
        } else {
          setUserData(null);
          setEditedUserData(null);
        }
      }, (err) => {
        console.error('Profile onSnapshot error:', err);
        setError(err.message);
      });

      const unsubProgress = onSnapshot(progressDocRef, (snap) => {
        if (snap.exists()) {
          const p = snap.data() as DocumentProgress;
          setDocumentProgress(p);
          AsyncStorage.setItem('documentProgress', JSON.stringify(p)).catch(() => {});
        } else {
          setDocumentProgress({});
        }
      }, (err) => {
        console.error('Progress onSnapshot error:', err);
      });

      // cleanup snapshots when auth changes
      return () => {
        unsubProfile();
        unsubProgress();
      };
    });

    return () => unsubAuth();
  }, []);

  const buildDocumentsList = (): Document[] => {
    const docs: Document[] = [];
    const docTypes = {
      drivers_license: {
        name: "Driver's License",
        requiresBothSides: true,
      },
      birth_certificate: {
        name: 'Birth Certificate',
        requiresBothSides: false,
      },
      social_security: {
        name: 'Social Security Card',
        requiresBothSides: false,
      },
      passport: {
        name: 'Passport',
        requiresBothSides: false,
      },
      medical_records: {
        name: 'Medical Records',
        requiresBothSides: false,
      },
      insurance_card: {
        name: 'Insurance Card',
        requiresBothSides: true,
      },
    };

    const docNames = Object.fromEntries(
      Object.entries(docTypes).map(([key, value]) => [key, value.name])
    );

    Object.entries(documentProgress).forEach(([docType, progress]) => {
      if (progress?.status === 'completed') {
        const fileName = progress.uploadedFileName || `${docNames[docType] || 'Document'}.pdf`;
        docs.push({
          id: docType,
          name: fileName,
          type: docNames[docType] || 'Document',
          date: new Date().toISOString().split('T')[0],
          status: 'Verified',
          size: '245 KB',
        });
      }
    });

    return docs;
  };

  const allDocuments = buildDocumentsList();
  const filteredDocuments = allDocuments.filter(
    (doc) =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSavePersonalInfo = async () => {
    if (!editedUserData) return;

    try {
      await AsyncStorage.setItem('userData', JSON.stringify(editedUserData));
      setUserData(editedUserData);
      setIsEditingPersonalInfo(false);
      Alert.alert('Success', 'Personal information updated');
    } catch (error) {
      console.error('Error saving personal info:', error);
      Alert.alert('Error', 'Failed to save personal information');
    }
  };

  const handleCancelEdit = () => {
    setEditedUserData(userData);
    setIsEditingPersonalInfo(false);
  };

  const handleDocumentUpload = async (
    documentId: string,
    fileData: string,
    fileType: string,
    side: 'front' | 'back' = 'front'
  ) => {
    if (!isOnline) {
      Alert.alert(
        'Offline Mode',
        'Document upload is not available while offline. Please try again when you have an internet connection.'
      );
      return;
    }

    try {
      const uploadFn = httpsCallable(functions, 'uploadDocument');
      const result = await uploadFn({
        documentId,
        fileData,
        fileType,
        side,
        isAdditionalFile: false,
      });

      // Update local progress state
      const updatedProgress = {
        ...documentProgress,
        [documentId]: {
          status: 'completed' as const,
          updatedAt: new Date().toISOString(),
          uploadedFileName: `${documentId}_${side}.${fileType}`,
        },
      };
      
      setDocumentProgress(updatedProgress);
      AsyncStorage.setItem('documentProgress', JSON.stringify(updatedProgress)).catch(() => {});

      Alert.alert('Success', 'Document uploaded successfully');
      return result;
    } catch (error: any) {
      console.error('Error uploading document:', error);
      Alert.alert(
        'Upload Failed',
        error?.message || 'Failed to upload document. Please try again.'
      );
      throw error;
    }
  };

  const generateDocumentPreview = (doc: Document) => {
    if (!userData) return { title: doc.name, fields: [] };

    const docTypeMap: Record<string, any> = {
      birth_certificate: {
        title: 'Birth Certificate',
        fields: [
          { label: 'Full Name', value: `${userData.firstName} ${userData.lastName}` },
          { label: 'Date of Birth', value: userData.dateOfBirth || 'Not provided' },
          { label: 'Place of Birth', value: `${userData.city}, ${userData.state}` },
          {
            label: 'Certificate Number',
            value: 'BC-2025-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          },
        ],
      },
      drivers_license: {
        title: "Driver's License",
        fields: [
          { label: 'Full Name', value: `${userData.firstName} ${userData.lastName}` },
          { label: 'Date of Birth', value: userData.dateOfBirth || 'Not provided' },
          { label: 'Address', value: `${userData.city}, ${userData.state}` },
          {
            label: 'License Number',
            value: 'DL' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          },
          { label: 'Issue Date', value: new Date().toLocaleDateString() },
          {
            label: 'Expiration Date',
            value: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          },
        ],
      },
      social_security: {
        title: 'Social Security Card',
        fields: [
          { label: 'Full Name', value: `${userData.firstName} ${userData.lastName}` },
          { label: 'Social Security Number', value: userData.socialSecurity || 'XXX-XX-XXXX' },
          { label: 'Date of Birth', value: userData.dateOfBirth || 'Not provided' },
        ],
      },
      passport: {
        title: 'Passport',
        fields: [
          { label: 'Full Name', value: `${userData.firstName} ${userData.lastName}` },
          { label: 'Date of Birth', value: userData.dateOfBirth || 'Not provided' },
          { label: 'Nationality', value: 'United States' },
          {
            label: 'Passport Number',
            value: 'P' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          },
          { label: 'Issue Date', value: new Date().toLocaleDateString() },
          {
            label: 'Expiration Date',
            value: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          },
        ],
      },
    };

    return docTypeMap[doc.id] || {
      title: doc.name,
      fields: [{ label: 'Document', value: 'Preview not available' }],
    };
  };

  if (!userData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Lock size={64} color="#9ca3af" />
          <Text style={styles.emptyStateTitle}>No Profile Found</Text>
          <Text style={styles.emptyStateText}>
            Please complete your profile in the Home tab to access your vault
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
          <View style={styles.headerContent}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Digital Vault</Text>
              <Text style={styles.headerSubtitle}>Secure document storage</Text>
            </View>
            <View style={styles.headerIcon}>
              <Lock size={24} color="#ffffff" />
            </View>
          </View>

          {/* Security Badge */}
          <View style={styles.securityBadge}>
            <Shield size={32} color="#10b981" />
            <View style={styles.securityText}>
              <Text style={styles.securityTitle}>End-to-end encrypted</Text>
              <Text style={styles.securitySubtitle}>256-bit encryption • Your eyes only</Text>
            </View>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search documents..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* Sensitive Data Toggle */}
        <View style={styles.section}>
          <View style={styles.sensitiveCard}>
            <View style={styles.sensitiveLeft}>
              {showSensitive ? (
                <Eye size={20} color="#d97706" />
              ) : (
                <EyeOff size={20} color="#d97706" />
              )}
              <Text style={styles.sensitiveText}>Show sensitive information</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowSensitive(!showSensitive)}
              style={styles.sensitiveButton}
            >
              <Text style={styles.sensitiveButtonText}>{showSensitive ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            {!isEditingPersonalInfo && (
              <TouchableOpacity
                onPress={() => setIsEditingPersonalInfo(true)}
                style={styles.editButton}
              >
                <Edit size={16} color="#2563eb" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            {!isEditingPersonalInfo ? (
              <View style={styles.infoContainer}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>
                    {userData.firstName} {userData.lastName}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date of Birth</Text>
                  <Text style={styles.infoValue}>{userData.dateOfBirth || 'Not provided'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>SSN</Text>
                  <Text style={styles.infoValue}>
                    {showSensitive ? userData.socialSecurity || 'Not provided' : '•••-••-••••'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={[styles.infoValue, styles.infoValueRight]}>
                    {userData.city}, {userData.state}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.editForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editedUserData?.firstName}
                    onChangeText={(text) =>
                      setEditedUserData(
                        editedUserData ? { ...editedUserData, firstName: text } : null
                      )
                    }
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    value={editedUserData?.lastName}
                    onChangeText={(text) =>
                      setEditedUserData(
                        editedUserData ? { ...editedUserData, lastName: text } : null
                      )
                    }
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Date of Birth</Text>
                  <TextInput
                    style={styles.input}
                    value={editedUserData?.dateOfBirth}
                    onChangeText={(text) =>
                      setEditedUserData(
                        editedUserData ? { ...editedUserData, dateOfBirth: text } : null
                      )
                    }
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Social Security Number</Text>
                  <TextInput
                    style={styles.input}
                    value={editedUserData?.socialSecurity}
                    onChangeText={(text) =>
                      setEditedUserData(
                        editedUserData ? { ...editedUserData, socialSecurity: text } : null
                      )
                    }
                    placeholder="XXX-XX-XXXX"
                  />
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity
                    onPress={handleSavePersonalInfo}
                    style={styles.saveButton}
                  >
                    <Check size={16} color="#ffffff" />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelButton}>
                    <X size={16} color="#6b7280" />
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Stored Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stored Documents</Text>

          {filteredDocuments.map((doc) => (
            <View key={doc.id} style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <View style={styles.documentLeft}>
                  <View style={styles.documentIconContainer}>
                    <FileText size={20} color="#2563eb" />
                  </View>
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName}>{doc.name}</Text>
                    <Text style={styles.documentMeta}>
                      {doc.type} • {doc.date}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{doc.status}</Text>
                </View>
              </View>
              <View style={styles.documentActions}>
                <TouchableOpacity style={styles.actionButton}>
                  <Download size={16} color="#6b7280" />
                  <Text style={styles.actionButtonText}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setPreviewDocument(doc)}
                >
                  <Share2 size={16} color="#6b7280" />
                  <Text style={styles.actionButtonText}>Preview</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {filteredDocuments.length === 0 && (
            <View style={styles.emptyDocuments}>
              <FileText size={48} color="#d1d5db" />
              <Text style={styles.emptyDocumentsText}>No documents found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Upload Document Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isUploadModalVisible}
        onRequestClose={() => {
          if (!isUploading) {
            setIsUploadModalVisible(false);
            setSelectedDocumentType('');
            setUploadProgress(0);
          }
        }}>
        <SafeAreaView style={styles.uploadModalContainer}>
          <View style={styles.uploadModalContent}>
            <View style={styles.uploadModalHeader}>
              <Text style={styles.uploadModalTitle}>Upload Document</Text>
              {!isUploading && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setIsUploadModalVisible(false);
                    setSelectedDocumentType('');
                    setUploadProgress(0);
                  }}>
                  <X size={24} color="#000" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.sectionLabel}>Select Document Type</Text>
              {Object.entries(docTypes).map(([id, { name, requiresBothSides }]) => (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.documentTypeButton,
                    selectedDocumentType === id && styles.documentTypeButtonSelected,
                  ]}
                  onPress={() => setSelectedDocumentType(id as DocTypeKeys)}
                  disabled={isUploading}>
                  <Text
                    style={[
                      styles.documentTypeText,
                      selectedDocumentType === id && styles.documentTypeTextSelected,
                    ]}>
                    {name}
                    {requiresBothSides ? ' (Front & Back)' : ''}
                  </Text>
                </TouchableOpacity>
              ))}

              {selectedDocumentType && (
                <View style={styles.uploadSection}>
                  <Text style={styles.sectionLabel}>Upload Files</Text>
                  {docTypes[selectedDocumentType]?.requiresBothSides ? (
                    <>
                      <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={() => {/* TODO: Handle front side upload */}}
                        disabled={isUploading}>
                        <FileText size={24} color="#2563eb" />
                        <Text style={styles.uploadButtonText}>Select Front Side</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={() => {/* TODO: Handle back side upload */}}
                        disabled={isUploading}>
                        <FileText size={24} color="#2563eb" />
                        <Text style={styles.uploadButtonText}>Select Back Side</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={() => {/* TODO: Handle single side upload */}}
                      disabled={isUploading}>
                      <FileText size={24} color="#2563eb" />
                      <Text style={styles.uploadButtonText}>Select File</Text>
                    </TouchableOpacity>
                  )}

                  {isUploading && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View
                          style={[styles.progressFill, { width: `${uploadProgress}%` }]}
                        />
                      </View>
                      <Text style={styles.progressText}>{uploadProgress}%</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        visible={!!previewDocument}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPreviewDocument(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <FileText size={20} color="#2563eb" />
                <Text style={styles.modalTitle}>Document Preview</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewDocument(null)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {previewDocument && (
              <ScrollView style={styles.modalScroll}>
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>
                    {generateDocumentPreview(previewDocument).title}
                  </Text>
                  <Text style={styles.previewSubtitle}>Official Document Preview</Text>

                  <View style={styles.previewFields}>
                    {generateDocumentPreview(previewDocument).fields.map(
                      (field: any, index: number) => (
                        <View key={index} style={styles.previewField}>
                          <Text style={styles.previewFieldLabel}>{field.label}</Text>
                          <Text style={styles.previewFieldValue}>{field.value}</Text>
                        </View>
                      )
                    )}
                  </View>

                  <View style={styles.previewFooter}>
                    <Text style={styles.previewFooterText}>Status: {previewDocument.status}</Text>
                    <Text style={styles.previewFooterText}>{previewDocument.date}</Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalButton}>
                    <Download size={16} color="#6b7280" />
                    <Text style={styles.modalButtonText}>Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalButtonPrimary}
                    onPress={() => {
                      Alert.alert('Success', 'Document ready to share with case manager');
                      setPreviewDocument(null);
                    }}
                  >
                    <Share2 size={16} color="#ffffff" />
                    <Text style={styles.modalButtonTextPrimary}>Share</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  uploadModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  uploadModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  uploadModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '80%',
  },
  uploadModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalBody: {
    padding: 20,
  },
  closeButton: {
    padding: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
  },
  documentTypeButton: {
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  documentTypeButtonSelected: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  documentTypeText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  documentTypeTextSelected: {
    color: '#2563eb',
  },
  uploadSection: {
    marginTop: 24,
  },
  uploadButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '500',
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
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
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#bfdbfe',
    marginTop: 4,
  },
  headerIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  securityText: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  securitySubtitle: {
    fontSize: 12,
    color: '#bfdbfe',
    marginTop: 2,
  },
  searchContainer: {
    padding: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  section: {
    paddingHorizontal: 20,
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
  },
  sensitiveCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  sensitiveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sensitiveText: {
    fontSize: 14,
    color: '#78350f',
  },
  sensitiveButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  sensitiveButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#78350f',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoContainer: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  infoValueRight: {
    textAlign: 'right',
  },
  editForm: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  documentCard: {
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
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  documentLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  documentIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  documentMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#065f46',
  },
  documentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  emptyDocuments: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
  },
  emptyDocumentsText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalScroll: {
    padding: 20,
  },
  previewCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#bfdbfe',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  previewFields: {
    gap: 12,
  },
  previewField: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  previewFieldLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  previewFieldValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  previewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  previewFooterText: {
    fontSize: 12,
    color: '#6b7280',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  modalButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
  },
  modalButtonTextPrimary: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  emptyStateText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});