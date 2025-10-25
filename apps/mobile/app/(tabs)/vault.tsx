import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';

const VaultTab = () => {
  const [documents, setDocuments] = useState({
    stateId: null,
    birthCertificate: null,
    medicalRecords: null,
    socialSecurity: null,
  });

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

  const handleUpload = (docId) => {
    // TODO: Integrate react-native-document-picker
    console.log('Upload document:', docId);
    // Simulated upload
    setDocuments(prev => ({
      ...prev,
      [docId]: { name: 'document.pdf', date: new Date() }
    }));
  };

  const handleView = (docId) => {
    console.log('View document:', docId);
    // TODO: Implement document viewer
  };

  const handleDelete = (docId) => {
    setDocuments(prev => ({
      ...prev,
      [docId]: null
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Digital Vault</Text>
        <Text style={styles.headerSubtitle}>Secure document storage</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {documentTypes.map((docType) => {
          const hasDocument = documents[docType.id];
          
          return (
            <View key={docType.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.icon}>{docType.icon}</Text>
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.cardTitle}>{docType.title}</Text>
                  <Text style={styles.cardDescription}>{docType.description}</Text>
                </View>
              </View>

              {hasDocument ? (
                <View style={styles.documentInfo}>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>✓ Uploaded</Text>
                  </View>
                  <Text style={styles.documentName}>{hasDocument.name}</Text>
                  <Text style={styles.documentDate}>
                    Added {hasDocument.date.toLocaleDateString()}
                  </Text>
                  
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.viewButton]}
                      onPress={() => handleView(docType.id)}
                    >
                      <Text style={styles.viewButtonText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.deleteButton]}
                      onPress={() => handleDelete(docType.id)}
                    >
                      <Text style={styles.deleteButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => handleUpload(docType.id)}
                >
                  <Text style={styles.uploadIcon}>📤</Text>
                  <Text style={styles.uploadText}>Upload Document</Text>
                </TouchableOpacity>
              )}
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
    marginBottom: 12,
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
  documentInfo: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statusBadge: {
    backgroundColor: '#e8f5e9',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    color: '#2e7d32',
    fontSize: 12,
    fontWeight: '600',
  },
  documentName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  documentDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: '#2196f3',
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  deleteButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  uploadButton: {
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: 12,
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 14,
    color: '#2196f3',
    fontWeight: '600',
  },
});

export default VaultTab;