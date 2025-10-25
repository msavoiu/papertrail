import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
  ActionSheetIOS,
  Platform,
  ActivityIndicator,
} from 'react-native';


// AWS S3 configuration
const AWS_CONFIG = {
  bucket: 'your-bucket-name',
  region: 'us-west-1',
  // Get presigned URL from your backend
  getPresignedUrl: async (fileName, fileType) => {
    // Call your backend API to get presigned URL
    const response = await fetch('https://your-api.com/get-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, fileType }),
    });
    return response.json();
  },
};

const VaultTab = () => {
  const [documents, setDocuments] = useState({
    stateId: { front: null, back: null },
    birthCertificate: { front: null, back: null },
    medicalRecords: { front: null, back: null },
    socialSecurity: { front: null, back: null },
  });
  
  const [uploading, setUploading] = useState({});

  const documentTypes = [
    {
      id: 'stateId',
      title: 'California State ID',
      icon: '🪪',
      description: 'Your state identification',
    },
    {
      id: 'birthCertificate',
      title: 'Birth Certificate',
      icon: '📜',
      description: 'Official birth record',
    },
    {
      id: 'medicalRecords',
      title: 'Medical Records',
      icon: '🏥',
      description: 'Health information',
    },
    {
      id: 'socialSecurity',
      title: 'Social Security Card',
      icon: '🔐',
      description: 'SSN documentation',
    },
  ];

  const imagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: false,
  };

  const showUploadOptions = (docId, side) => {
    const options = ['Cancel', 'Take Photo', 'Choose from Photos', 'Choose PDF'];
    const cancelButtonIndex = 0;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        (buttonIndex) => {
          if (buttonIndex === 1) openCamera(docId, side);
          else if (buttonIndex === 2) openLibrary(docId, side);
          else if (buttonIndex === 3) openDocumentPicker(docId, side);
        }
      );
    } else {
      Alert.alert(
        'Upload Document',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => openCamera(docId, side) },
          { text: 'Choose from Photos', onPress: () => openLibrary(docId, side) },
          { text: 'Choose PDF', onPress: () => openDocumentPicker(docId, side) },
        ]
      );
    }
  };

  const openCamera = async (docId, side) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Camera permission is required');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync(imagePickerOptions);
    handleImageResult(result, docId, side);
  };

  const openLibrary = async (docId, side) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo library permission is required');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync(imagePickerOptions);
    handleImageResult(result, docId, side);
  };

  const openDocumentPicker = async (docId, side) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        handleDocumentResult(file, docId, side);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleImageResult = async (result, docId, side) => {
    if (result.canceled) return;
    
    if (result.assets && result.assets[0]) {
      const image = result.assets[0];
      await uploadToS3(image, docId, side, 'image');
    }
  };

  const handleDocumentResult = async (file, docId, side) => {
    await uploadToS3(file, docId, side, 'pdf');
  };

  const uploadToS3 = async (file, docId, side, fileType) => {
    const uploadKey = `${docId}-${side}`;
    setUploading(prev => ({ ...prev, [uploadKey]: true }));

    try {
      // Step 1: Get presigned URL from your backend
      const fileName = `${docId}/${side}/${Date.now()}-${file.fileName || file.name || 'document'}`;
      const mimeType = file.mimeType || file.type || (fileType === 'pdf' ? 'application/pdf' : 'image/jpeg');
      
      const { uploadUrl, s3Url } = await AWS_CONFIG.getPresignedUrl(fileName, mimeType);

      // Step 2: Read file and upload to S3
      const fileUri = file.uri;
      
      // For Expo, use fetch with blob
      const response = await fetch(fileUri);
      const blob = await response.blob();

      // Step 3: Upload to S3 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      // Step 4: Save document metadata
      setDocuments(prev => ({
        ...prev,
        [docId]: {
          ...prev[docId],
          [side]: {
            uri: fileType === 'image' ? file.uri : null,
            s3Url: s3Url,
            fileName: file.fileName || file.name || 'document',
            fileType: fileType,
            mimeType: mimeType,
            fileSize: file.fileSize || file.size,
            date: new Date(),
          }
        }
      }));

      Alert.alert('Success', 'Document uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Could not upload document. Please try again.');
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleDelete = (docId, side) => {
    Alert.alert(
      'Remove Document',
      'Are you sure you want to remove this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // TODO: Call backend to delete from S3
            setDocuments(prev => ({
              ...prev,
              [docId]: {
                ...prev[docId],
                [side]: null
              }
            }));
          }
        }
      ]
    );
  };

  const handleView = (doc) => {
    if (doc.fileType === 'pdf') {
      // TODO: Open PDF viewer
      console.log('Open PDF:', doc.s3Url);
    } else {
      // TODO: Open full-screen image viewer
      console.log('View image:', doc.uri);
    }
  };

  const hasAnyDocument = (doc) => {
    return doc.front || doc.back;
  };

  const hasBothDocuments = (doc) => {
    return doc.front && doc.back;
  };

  const renderDocumentPreview = (doc, docId, side) => {
    const uploadKey = `${docId}-${side}`;
    const isUploading = uploading[uploadKey];

    if (isUploading) {
      return (
        <View style={styles.uploadingBox}>
          <ActivityIndicator size="large" color="#2196f3" />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      );
    }

    if (!doc) {
      return (
        <TouchableOpacity
          style={styles.uploadBox}
          onPress={() => showUploadOptions(docId, side)}
        >
          <Text style={styles.uploadIcon}>📄</Text>
          <Text style={styles.uploadText}>Add Document</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View>
        <TouchableOpacity onPress={() => handleView(doc)}>
          {doc.fileType === 'pdf' ? (
            <View style={styles.pdfPreview}>
              <Text style={styles.pdfIcon}>📄</Text>
              <Text style={styles.pdfFileName} numberOfLines={1}>
                {doc.fileName}
              </Text>
            </View>
          ) : (
            <Image source={{ uri: doc.uri }} style={styles.photoPreview} />
          )}
        </TouchableOpacity>
        <View style={styles.photoActions}>
          <TouchableOpacity
            style={styles.replaceButton}
            onPress={() => showUploadOptions(docId, side)}
          >
            <Text style={styles.replaceButtonText}>Replace</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleDelete(docId, side)}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>The Vault</Text>
        <Text style={styles.headerSubtitle}>Secure document storage</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {documentTypes.map((docType) => {
          const doc = documents[docType.id];
          
          return (
            <View key={docType.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.icon}>{docType.icon}</Text>
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.cardTitle}>{docType.title}</Text>
                  <Text style={styles.cardDescription}>{docType.description}</Text>
                </View>
                {hasBothDocuments(doc) && (
                  <View style={styles.completeBadge}>
                    <Text style={styles.completeText}>✓</Text>
                  </View>
                )}
              </View>

              <View style={styles.photoSection}>
                <View style={styles.photoContainer}>
                  <Text style={styles.photoLabel}>Front</Text>
                  {renderDocumentPreview(doc.front, docType.id, 'front')}
                </View>

                <View style={styles.photoContainer}>
                  <Text style={styles.photoLabel}>Back</Text>
                  {renderDocumentPreview(doc.back, docType.id, 'back')}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cardDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  completeBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4caf50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photoSection: {
    flexDirection: 'row',
    gap: 12,
  },
  photoContainer: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  photoPreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  pdfPreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#fff3e0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  pdfIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  pdfFileName: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  uploadingBox: {
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  replaceButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#2196f3',
    borderRadius: 6,
    alignItems: 'center',
  },
  replaceButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  uploadBox: {
    height: 120,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  uploadText: {
    fontSize: 12,
    color: '#2196f3',
    fontWeight: '600',
  },
});

export default VaultTab;