import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Configuration
const API_CONFIG = {
  BASE_URL: 'https://web.growthacademy.in',
  UPLOAD_ENDPOINT: '/upload-recording.php',
};

const STORAGE_KEYS = {
  SAVED_PATH: '@call_recordings_path',
  LAST_SYNC: '@last_sync_timestamp',
  API_URL: '@api_base_url',
  SYNCED_FILES: '@synced_files_list',
};

// Professional Color Scheme
const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  secondary: '#10B981',
  accent: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  
  text: {
    primary: '#1E293B',
    secondary: '#64748B',
    tertiary: '#94A3B8',
    inverse: '#FFFFFF',
  },
  
  border: {
    light: '#E2E8F0',
    medium: '#CBD5E1',
    dark: '#94A3B8',
  },
};

const CallRecordingApp = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [apiUrl, setApiUrl] = useState(API_CONFIG.BASE_URL);
  const [syncedFilesList, setSyncedFilesList] = useState(new Set());
  const [currentSyncFile, setCurrentSyncFile] = useState('');
  
  // Audio player state
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingUri, setPlayingUri] = useState(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  useEffect(() => {
    loadSavedSettings();
    
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    configureAudio();
  }, []);

  const configureAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error('Error configuring audio:', error);
    }
  };

  // Load synced files list
  const loadSyncedFilesList = async () => {
    try {
      const syncedData = await AsyncStorage.getItem(STORAGE_KEYS.SYNCED_FILES);
      if (syncedData) {
        const syncedArray = JSON.parse(syncedData);
        const syncedSet = new Set(syncedArray);
        setSyncedFilesList(syncedSet);
        return syncedSet;
      }
      return new Set();
    } catch (error) {
      console.error('Error loading synced files:', error);
      return new Set();
    }
  };

  // Save synced files list
  const saveSyncedFilesList = async (syncedSet) => {
    try {
      const syncedArray = Array.from(syncedSet);
      await AsyncStorage.setItem(STORAGE_KEYS.SYNCED_FILES, JSON.stringify(syncedArray));
      console.log('Saved synced files:', syncedArray.length);
    } catch (error) {
      console.error('Error saving synced files:', error);
    }
  };

  // Generate unique file identifier
  const getFileIdentifier = (file) => {
    return `${file.fileName}_${file.size}_${file.timestamp}`;
  };

  // Load saved settings
  const loadSavedSettings = async () => {
    try {
      const [savedPath, savedApiUrl, savedLastSync] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SAVED_PATH),
        AsyncStorage.getItem(STORAGE_KEYS.API_URL),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
      ]);

      if (savedApiUrl) setApiUrl(savedApiUrl);
      if (savedLastSync) setLastSync(new Date(parseInt(savedLastSync)));

      const syncedSet = await loadSyncedFilesList();

      if (savedPath) {
        setSelectedPath(savedPath);
        await loadDirectory(savedPath, syncedSet);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Save API URL
  const saveApiUrl = async (url) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.API_URL, url);
      setApiUrl(url);
      Alert.alert('✓ Success', 'API URL saved successfully');
    } catch (error) {
      Alert.alert('✗ Error', 'Failed to save API URL');
    }
  };

  // Clear synced data
  const clearSyncedData = async () => {
    Alert.alert(
      'Clear Sync History',
      'This will reset all sync records. All recordings will be marked as unsynced. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEYS.SYNCED_FILES);
              await AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
              setSyncedFilesList(new Set());
              setLastSync(null);
              
              setFiles(prevFiles => 
                prevFiles.map(f => ({ ...f, synced: false }))
              );
              
              Alert.alert('✓ Success', 'Sync history cleared');
            } catch (error) {
              Alert.alert('✗ Error', 'Failed to clear sync history');
            }
          }
        }
      ]
    );
  };

  // Clear saved path
  const clearSavedPath = async () => {
    Alert.alert(
      'Clear Saved Path',
      'Remove the saved directory path?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_PATH);
              setSelectedPath('');
              setFiles([]);
              Alert.alert('✓ Success', 'Saved path cleared');
            } catch (error) {
              Alert.alert('✗ Error', 'Failed to clear path');
            }
          }
        }
      ]
    );
  };

  // Parse filename
  const parseCallRecording = (filename) => {
    try {
      const nameWithoutExt = filename.replace(/\.(mp3|m4a|wav|amr|3gp|aac)$/i, '');
      
      let phoneNumber = '';
      let rawPhoneNumber = '';
      const phoneMatch = nameWithoutExt.match(/^(\d+)~/);
      
      if (phoneMatch) {
        rawPhoneNumber = phoneMatch[1];
        phoneNumber = formatPhoneNumber(phoneMatch[1]);
      } else {
        const fallbackMatch = nameWithoutExt.match(/^(\d+)/);
        if (fallbackMatch) {
          rawPhoneNumber = fallbackMatch[1];
          phoneNumber = formatPhoneNumber(fallbackMatch[1]);
        }
      }
      
      const timestampMatch = nameWithoutExt.match(/_(\d{14})/);
      
      let dateObj = null;
      let timeString = '';
      let dateString = '';
      let timestamp = '';
      
      if (timestampMatch) {
        const ts = timestampMatch[1];
        const year = ts.substring(0, 4);
        const month = ts.substring(4, 6);
        const day = ts.substring(6, 8);
        const hour = ts.substring(8, 10);
        const minute = ts.substring(10, 12);
        const second = ts.substring(12, 14);
        
        dateObj = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        );
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dateString = `${day} ${monthNames[parseInt(month) - 1]} ${year}`;
        
        const hourNum = parseInt(hour);
        const ampm = hourNum >= 12 ? 'PM' : 'AM';
        const hour12 = hourNum % 12 || 12;
        timeString = `${hour12.toString().padStart(2, '0')}:${minute}:${second} ${ampm}`;
        timestamp = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
      }
      
      let callType = 'Recorded Call';
      const lowerName = filename.toLowerCase();
      
      if (lowerName.includes('incoming') || lowerName.includes('_in_')) {
        callType = 'Incoming';
      } else if (lowerName.includes('outgoing') || lowerName.includes('_out_')) {
        callType = 'Outgoing';
      } else if (lowerName.includes('missed')) {
        callType = 'Missed';
      }
      
      return {
        phoneNumber: phoneNumber || 'Unknown',
        rawPhoneNumber,
        date: dateString || 'Unknown Date',
        time: timeString || 'Unknown Time',
        timestamp,
        dateTime: dateObj,
        callType,
        fileName: filename,
      };
    } catch (error) {
      return {
        phoneNumber: 'Unknown',
        rawPhoneNumber: '',
        date: 'N/A',
        time: 'N/A',
        timestamp: '',
        dateTime: null,
        callType: 'Unknown',
        fileName: filename,
      };
    }
  };

  // Format phone number
  const formatPhoneNumber = (number) => {
    if (!number) return 'Unknown';
    
    if (number.startsWith('0091')) {
      const main = number.substring(4);
      return main.length === 10 ? `+91 ${main.substring(0, 5)} ${main.substring(5)}` : `+91 ${main}`;
    } else if (number.startsWith('91') && number.length === 12) {
      const main = number.substring(2);
      return `+91 ${main.substring(0, 5)} ${main.substring(5)}`;
    } else if (number.length === 10) {
      return `${number.substring(0, 5)} ${number.substring(5)}`;
    }
    
    return number;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Format duration from milliseconds
  const formatDuration = (millis) => {
    if (!millis || millis === 0) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get actual audio duration
  const getAudioDuration = async (uri) => {
    try {
      const { sound: tempSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false }
      );
      
      const status = await tempSound.getStatusAsync();
      await tempSound.unloadAsync();
      
      if (status.isLoaded && status.durationMillis) {
        return status.durationMillis;
      }
      return 0;
    } catch (error) {
      console.error('Error getting duration:', error);
      return 0;
    }
  };

  // Load directory
  const loadDirectory = async (directoryUri, syncedSet = null) => {
    try {
      setLoading(true);
      const currentSyncedSet = syncedSet || await loadSyncedFilesList();
      
      const fileUris = await FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri);
      
      const fileDetails = await Promise.all(
        fileUris.map(async (fileUri) => {
          try {
            const info = await FileSystem.getInfoAsync(fileUri, { size: true });
            const fileName = decodeURIComponent(fileUri.split('/').pop().split('%2F').pop());
            
            if (/\.(mp3|m4a|wav|amr|3gp|aac)$/i.test(fileName)) {
              const callInfo = parseCallRecording(fileName);
              
              // Get actual duration
              const durationMillis = await getAudioDuration(fileUri);
              
              const fileData = {
                ...callInfo,
                uri: fileUri,
                size: info.size || 0,
                exists: info.exists,
                duration: formatDuration(durationMillis),
                durationMillis: durationMillis,
                modificationTime: info.modificationTime,
                synced: false,
              };
              
              const fileId = getFileIdentifier(fileData);
              fileData.synced = currentSyncedSet.has(fileId);
              
              return fileData;
            }
            return null;
          } catch (err) {
            console.error('File error:', err);
            return null;
          }
        })
      );

      const validFiles = fileDetails
        .filter(f => f !== null && f.exists)
        .sort((a, b) => {
          if (a.dateTime && b.dateTime) return b.dateTime - a.dateTime;
          return 0;
        });

      setFiles(validFiles);
      
      if (validFiles.length === 0) {
        Alert.alert('No Recordings', 'No audio files found in selected directory');
      }
      
    } catch (error) {
      console.error('Load error:', error);
      Alert.alert('Error', `Failed to load directory: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Select directory
  const selectDirectory = async () => {
    try {
      setLoading(true);
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      
      if (!permissions.granted) {
        Alert.alert('Permission Denied', 'Directory access required');
        return;
      }

      const directoryUri = permissions.directoryUri;
      setSelectedPath(directoryUri);
      await loadDirectory(directoryUri);
      
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PATH, directoryUri);
      Alert.alert('✓ Success', 'Directory loaded and saved successfully');
      
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Upload file
  const uploadFileToServer = async (file) => {
    try {
      const base64Data = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const uploadData = {
        phone_number: file.phoneNumber,
        raw_phone_number: file.rawPhoneNumber,
        timestamp: file.timestamp,
        date: file.date,
        time: file.time,
        call_type: file.callType,
        file_name: file.fileName,
        file_size: file.size,
        duration: file.duration,
        file_data: base64Data,
        file_identifier: getFileIdentifier(file),
      };

      const response = await fetch(`${apiUrl}${API_CONFIG.UPLOAD_ENDPOINT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadData),
      });

      const result = await response.json();
      return result.success 
        ? { success: true, data: result }
        : { success: false, error: result.message || 'Upload failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Mark as synced
  const markFileAsSynced = async (file) => {
    const fileId = getFileIdentifier(file);
    const newSyncedSet = new Set(syncedFilesList);
    newSyncedSet.add(fileId);
    setSyncedFilesList(newSyncedSet);
    await saveSyncedFilesList(newSyncedSet);
  };

  // Sync all files
  const syncAllFiles = async () => {
    const unsyncedFiles = files.filter(f => !f.synced);
    
    if (unsyncedFiles.length === 0) {
      Alert.alert('All Synced', 'All recordings are already synced');
      return;
    }

    Alert.alert(
      'Sync Recordings',
      `Upload ${unsyncedFiles.length} unsynced recording${unsyncedFiles.length > 1 ? 's' : ''}?\n\n${files.filter(f => f.synced).length} already synced`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Upload', 
          onPress: async () => {
            setSyncing(true);
            setSyncProgress(0);
            
            let successCount = 0;
            let failCount = 0;
            
            const updatedSyncedSet = new Set(syncedFilesList);
            
            for (let i = 0; i < unsyncedFiles.length; i++) {
              const file = unsyncedFiles[i];
              setCurrentSyncFile(file.phoneNumber);
              
              const result = await uploadFileToServer(file);
              
              if (result.success) {
                successCount++;
                const fileId = getFileIdentifier(file);
                updatedSyncedSet.add(fileId);
                
                setFiles(prevFiles => 
                  prevFiles.map(f => 
                    f.uri === file.uri ? { ...f, synced: true } : f
                  )
                );
              } else {
                failCount++;
                console.error('Upload failed for:', file.fileName, result.error);
              }
              
              setSyncProgress(((i + 1) / unsyncedFiles.length) * 100);
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            setSyncedFilesList(updatedSyncedSet);
            await saveSyncedFilesList(updatedSyncedSet);
            
            setSyncing(false);
            setSyncProgress(0);
            setCurrentSyncFile('');
            
            const now = Date.now();
            await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, now.toString());
            setLastSync(new Date(now));
            
            await loadDirectory(selectedPath);
            
            Alert.alert(
              'Sync Complete',
              `✓ Uploaded: ${successCount}\n✗ Failed: ${failCount}\n\nTotal synced: ${updatedSyncedSet.size}/${files.length}`,
            );
          }
        },
      ]
    );
  };

  // Playback status update
  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis || 0);
      setPlaybackDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }
  };

  // Play audio
  const playAudio = async (file) => {
    try {
      setIsLoadingAudio(true);

      // Stop current playback if any
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
        setPlayingUri(null);
        setPlaybackPosition(0);
        setPlaybackDuration(0);
      }

      // If clicking the same file, just stop
      if (playingUri === file.uri) {
        setIsLoadingAudio(false);
        return;
      }

      // Load and play new audio
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: file.uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setPlayingUri(file.uri);
      setIsLoadingAudio(false);
    } catch (error) {
      console.error('Playback error:', error);
      setIsLoadingAudio(false);
      Alert.alert('Playback Error', 'Could not play this recording');
    }
  };

  // Pause audio
  const pauseAudio = async () => {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  };

  // Resume audio
  const resumeAudio = async () => {
    if (sound) {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  // Stop audio
  const stopAudio = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      setPlayingUri(null);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
    }
  };

  // Seek audio
  const seekAudio = async (position) => {
    if (sound) {
      await sound.setPositionAsync(position);
    }
  };

  // Get call type color
  const getCallTypeColor = (callType) => {
    switch (callType.toLowerCase()) {
      case 'incoming': return COLORS.success;
      case 'outgoing': return COLORS.info;
      case 'missed': return COLORS.danger;
      default: return COLORS.text.secondary;
    }
  };

  // Filter files
  const filteredFiles = files.filter(file => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      file.phoneNumber.toLowerCase().includes(query) ||
      file.rawPhoneNumber.includes(query) ||
      file.date.toLowerCase().includes(query) ||
      file.callType.toLowerCase().includes(query)
    );
  });

  // Custom Progress Bar
  const CustomProgressBar = ({ progress }) => (
    <View style={styles.customProgressBar}>
      <View style={[styles.customProgressFill, { width: `${progress}%` }]} />
    </View>
  );

  // Audio Progress Bar
  const AudioProgressBar = ({ position, duration, onSeek }) => {
    const progress = duration > 0 ? (position / duration) * 100 : 0;
    
    return (
      <View style={styles.audioProgressContainer}>
        <View style={styles.audioProgressTimes}>
          <Text style={styles.audioProgressTime}>{formatDuration(position)}</Text>
          <Text style={styles.audioProgressTime}>{formatDuration(duration)}</Text>
        </View>
        <Pressable
          style={styles.audioProgressBar}
          onPress={(e) => {
            const { locationX } = e.nativeEvent;
            const { width } = e.currentTarget.measure || { width: 300 };
            const percent = locationX / width;
            const newPosition = duration * percent;
            onSeek(newPosition);
          }}
        >
          <View style={styles.audioProgressTrack}>
            <View style={[styles.audioProgressFill, { width: `${progress}%` }]} />
          </View>
        </Pressable>
      </View>
    );
  };

  // Render call item
  const renderCallItem = ({ item }) => {
    const isCurrentlyPlaying = playingUri === item.uri;
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.callCard,
          pressed && styles.callCardPressed,
          isCurrentlyPlaying && styles.callCardPlaying,
        ]}
        onPress={() => {
          setSelectedCall(item);
          setModalVisible(true);
        }}
      >
        <View style={[styles.callTypeIndicator, { backgroundColor: getCallTypeColor(item.callType) }]} />
        
        <View style={styles.callCardContent}>
          <View style={styles.callCardHeader}>
            <Text style={styles.callPhoneNumber} numberOfLines={1}>
              {item.phoneNumber}
            </Text>
            <View style={styles.callCardBadges}>
              {item.synced && (
                <View style={styles.syncedBadge}>
                  <Text style={styles.syncedBadgeText}>✓</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.callCardMeta}>
            <View style={[styles.callTypePill, { backgroundColor: getCallTypeColor(item.callType) + '15' }]}>
              <Text style={[styles.callTypePillText, { color: getCallTypeColor(item.callType) }]}>
                {item.callType}
              </Text>
            </View>
            <Text style={styles.callMetaText}>{item.date}</Text>
          </View>
          
          <View style={styles.callCardFooter}>
            <Text style={styles.callFooterText}>⏱ {item.time}</Text>
            <Text style={styles.callFooterText}>•</Text>
            <Text style={styles.callFooterText}>{item.duration}</Text>
            <Text style={styles.callFooterText}>•</Text>
            <Text style={styles.callFooterText}>{formatFileSize(item.size)}</Text>
          </View>

          {/* Show progress bar if currently playing */}
          {isCurrentlyPlaying && (
            <View style={styles.miniProgressContainer}>
              <View style={styles.miniProgressBar}>
                <View style={[
                  styles.miniProgressFill, 
                  { width: `${playbackDuration > 0 ? (playbackPosition / playbackDuration) * 100 : 0}%` }
                ]} />
              </View>
            </View>
          )}
        </View>

        {/* Play Button */}
        <Pressable
          style={styles.playButton}
          onPress={(e) => {
            e.stopPropagation();
            if (isCurrentlyPlaying) {
              if (isPlaying) {
                pauseAudio();
              } else {
                resumeAudio();
              }
            } else {
              playAudio(item);
            }
          }}
        >
          {isLoadingAudio && playingUri === item.uri ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.playButtonText}>
              {isCurrentlyPlaying && isPlaying ? '⏸' : '▶'}
            </Text>
          )}
        </Pressable>
      </Pressable>
    );
  };

  // Settings Modal
  const SettingsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={settingsModalVisible}
      onRequestClose={() => setSettingsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Settings</Text>
            <Pressable onPress={() => setSettingsModalVisible(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Directory Management */}
            <View style={styles.settingCard}>
              <Text style={styles.settingCardTitle}>Directory Management</Text>
              
              {selectedPath ? (
                <>
                  <Text style={styles.settingLabel}>Current Directory</Text>
                  <View style={styles.pathDisplay}>
                    <Text style={styles.pathDisplayText} numberOfLines={2}>
                      {decodeURIComponent(selectedPath.split('/').pop().replace(/%2F/g, '/'))}
                    </Text>
                  </View>
                  
                  <View style={styles.buttonRow}>
                    <Pressable 
                      style={[styles.settingButton, styles.flexButton]} 
                      onPress={async () => {
                        setSettingsModalVisible(false);
                        await selectDirectory();
                      }}
                    >
                      <Text style={styles.settingButtonText}>Change Directory</Text>
                    </Pressable>
                    
                    <Pressable 
                      style={[styles.settingButton, styles.dangerButton, styles.flexButton]} 
                      onPress={clearSavedPath}
                    >
                      <Text style={styles.settingButtonText}>Clear</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.settingDescription}>
                    No directory selected. Browse to select your call recordings folder.
                  </Text>
                  <Pressable 
                    style={styles.settingButton} 
                    onPress={async () => {
                      setSettingsModalVisible(false);
                      await selectDirectory();
                    }}
                  >
                    <Text style={styles.settingButtonText}>📁 Browse Directory</Text>
                  </Pressable>
                </>
              )}
            </View>

            {/* API Configuration */}
            <View style={styles.settingCard}>
              <Text style={styles.settingCardTitle}>Server Configuration</Text>
              <Text style={styles.settingLabel}>API URL</Text>
              <TextInput
                style={styles.settingInput}
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="https://your-server.com"
                placeholderTextColor={COLORS.text.tertiary}
                autoCapitalize="none"
              />
              <Pressable style={styles.settingButton} onPress={() => saveApiUrl(apiUrl)}>
                <Text style={styles.settingButtonText}>Save API URL</Text>
              </Pressable>
            </View>

            {/* Statistics */}
            <View style={styles.settingCard}>
              <Text style={styles.settingCardTitle}>Statistics</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Recordings</Text>
                <Text style={styles.statValue}>{files.length}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Synced</Text>
                <Text style={[styles.statValue, { color: COLORS.success }]}>
                  {files.filter(f => f.synced).length}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Pending</Text>
                <Text style={[styles.statValue, { color: COLORS.warning }]}>
                  {files.filter(f => !f.synced).length}
                </Text>
              </View>
              {lastSync && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Last Sync</Text>
                  <Text style={styles.statValue}>{lastSync.toLocaleDateString()}</Text>
                </View>
              )}
            </View>

            {/* Danger Zone */}
            <View style={styles.settingCard}>
              <Text style={styles.settingCardTitle}>Danger Zone</Text>
              <Text style={styles.settingDescription}>
                Clear sync history will mark all recordings as unsynced
              </Text>
              <Pressable style={[styles.settingButton, styles.dangerButton]} onPress={clearSyncedData}>
                <Text style={styles.settingButtonText}>Clear Sync History</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Call Details Modal
  const CallDetailsModal = () => {
    if (!selectedCall) return null;

    const isCurrentlyPlaying = playingUri === selectedCall.uri;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Recording Details</Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Playback Control */}
              {/* <View style={styles.detailCard}>
                <View style={styles.playbackControlContainer}>
                  <Pressable
                    style={styles.playbackMainButton}
                    onPress={() => {
                      if (isCurrentlyPlaying) {
                        if (isPlaying) {
                          pauseAudio();
                        } else {
                          resumeAudio();
                        }
                      } else {
                        playAudio(selectedCall);
                      }
                    }}
                  >
                    {isLoadingAudio && isCurrentlyPlaying ? (
                      <ActivityIndicator size="large" color={COLORS.text.inverse} />
                    ) : (
                      <Text style={styles.playbackMainIcon}>
                        {isCurrentlyPlaying && isPlaying ? '⏸' : '▶'}
                      </Text>
                    )}
                  </Pressable>

                  {isCurrentlyPlaying && (
                    <Pressable
                      style={styles.playbackStopButton}
                      onPress={stopAudio}
                    >
                      <Text style={styles.playbackStopIcon}>⏹</Text>
                    </Pressable>
                  )}
                </View>

                {isCurrentlyPlaying && (
                  <AudioProgressBar
                    position={playbackPosition}
                    duration={playbackDuration}
                    onSeek={seekAudio}
                  />
                )}
              </View> */}

              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Contact Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone Number</Text>
                  <Text style={styles.detailValue}>{selectedCall.phoneNumber}</Text>
                </View>
                {selectedCall.rawPhoneNumber && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Raw Number</Text>
                    <Text style={styles.detailValueSmall}>{selectedCall.rawPhoneNumber}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Call Type</Text>
                  <View style={[styles.callTypePill, { backgroundColor: getCallTypeColor(selectedCall.callType) + '15' }]}>
                    <Text style={[styles.callTypePillText, { color: getCallTypeColor(selectedCall.callType) }]}>
                      {selectedCall.callType}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Recording Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{selectedCall.date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>{selectedCall.time}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{selectedCall.duration}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>File Size</Text>
                  <Text style={styles.detailValue}>{formatFileSize(selectedCall.size)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Sync Status</Text>
                  <Text style={[styles.detailValue, { color: selectedCall.synced ? COLORS.success : COLORS.danger }]}>
                    {selectedCall.synced ? '✓ Synced' : '✗ Not Synced'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>File Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Filename</Text>
                </View>
                <Text style={styles.filenameText}>{selectedCall.fileName}</Text>
              </View>
            </ScrollView>

            {/* <View style={styles.modalFooter}>
              <Pressable
                style={[styles.primaryButton, selectedCall.synced && styles.secondaryButton]}
                onPress={async () => {
                  setModalVisible(false);
                  const result = await uploadFileToServer(selectedCall);
                  if (result.success) {
                    await markFileAsSynced(selectedCall);
                    setFiles(prevFiles => 
                      prevFiles.map(f => 
                        f.uri === selectedCall.uri ? { ...f, synced: true } : f
                      )
                    );
                    Alert.alert('✓ Success', 'Recording uploaded successfully');
                  } else {
                    Alert.alert('✗ Error', `Upload failed: ${result.error}`);
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>
                  {selectedCall.synced ? '🔄 Re-upload Recording' : '📤 Upload Recording'}
                </Text>
              </Pressable>
            </View> */}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Call Recordings</Text>
            <Text style={styles.headerSubtitle}>
              {selectedPath ? `${files.length} recordings` : 'No directory selected'}
            </Text>
          </View>
          <Pressable onPress={() => setSettingsModalVisible(true)} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>⚙️</Text>
          </Pressable>
        </View>

        {/* Action Buttons */}
        {selectedPath && (
          <View style={styles.actionContainer}>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.secondaryButton, styles.flexButton, (loading || syncing) && styles.buttonDisabled]}
                onPress={() => loadDirectory(selectedPath)}
                disabled={loading || syncing}
              >
                <Text style={styles.secondaryButtonText}>
                  {loading ? '⏳ Loading...' : '🔄 Refresh'}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.accentButton, styles.flexButton, (files.length === 0 || syncing) && styles.buttonDisabled]}
                onPress={syncAllFiles}
                disabled={files.length === 0 || syncing}
              >
                <Text style={styles.accentButtonText}>
                  {syncing ? '⏳ Syncing' : `☁️ Sync (${files.filter(f => !f.synced).length})`}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Sync Progress */}
        {syncing && (
          <View style={styles.syncProgressContainer}>
            <View style={styles.syncProgressHeader}>
              <Text style={styles.syncProgressText}>Uploading recordings...</Text>
              <Text style={styles.syncProgressPercent}>{Math.round(syncProgress)}%</Text>
            </View>
            {currentSyncFile && (
              <Text style={styles.syncCurrentFile} numberOfLines={1}>
                {currentSyncFile}
              </Text>
            )}
            <CustomProgressBar progress={syncProgress} />
          </View>
        )}

        {/* Search Bar */}
        {files.length > 0 && (
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search recordings..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={COLORS.text.tertiary}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={styles.searchClear}>✕</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* File List */}
        <View style={styles.listContainer}>
          {files.length > 0 && (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>
                {filteredFiles.length} Recording{filteredFiles.length !== 1 ? 's' : ''}
              </Text>
              {files.filter(f => f.synced).length > 0 && (
                <Text style={styles.listHeaderSynced}>
                  {files.filter(f => f.synced).length} synced
                </Text>
              )}
            </View>
          )}

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.centerText}>Loading recordings...</Text>
            </View>
          ) : filteredFiles.length > 0 ? (
            <FlatList
              data={filteredFiles}
              renderItem={renderCallItem}
              keyExtractor={(item, index) => `${item.uri}-${index}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : files.length > 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.centerText}>No matching recordings</Text>
            </View>
          ) : (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyIcon}>📁</Text>
              <Text style={styles.centerText}>No directory selected</Text>
              <Text style={styles.centerSubtext}>
                Tap settings to select your recordings folder
              </Text>
              <Pressable 
                style={[styles.primaryButton, { marginTop: 20 }]} 
                onPress={() => setSettingsModalVisible(true)}
              >
                <Text style={styles.primaryButtonText}>Open Settings</Text>
              </Pressable>
            </View>
          )}
        </View>

        <CallDetailsModal />
        <SettingsModal />
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text.inverse,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.text.inverse,
    opacity: 0.8,
    marginTop: 2,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 20,
  },
  actionContainer: {
    padding: 16,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryButtonText: {
    color: COLORS.text.inverse,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border.medium,
  },
  secondaryButtonText: {
    color: COLORS.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  accentButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  accentButtonText: {
    color: COLORS.text.inverse,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  syncProgressContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  syncProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  syncProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  syncProgressPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  syncCurrentFile: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  customProgressBar: {
    height: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  customProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text.primary,
  },
  searchClear: {
    fontSize: 18,
    color: COLORS.text.tertiary,
    padding: 4,
  },
  listContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.surfaceAlt,
  },
  listHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  listHeaderSynced: {
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
  },
  callCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  callCardPressed: {
    opacity: 0.7,
  },
  callCardPlaying: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primary + '05',
  },
  callTypeIndicator: {
    width: 4,
  },
  callCardContent: {
    flex: 1,
    padding: 14,
  },
  callCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  callPhoneNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.primary,
    flex: 1,
  },
  callCardBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  syncedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncedBadgeText: {
    color: COLORS.text.inverse,
    fontSize: 12,
    fontWeight: '700',
  },
  callCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  callTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  callTypePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  callMetaText: {
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  callCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  callFooterText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
  miniProgressContainer: {
    marginTop: 8,
  },
  miniProgressBar: {
    height: 3,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  playButton: {
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border.light,
  },
  playButtonText: {
    fontSize: 20,
    color: COLORS.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  centerText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 12,
  },
  centerSubtext: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 20,
    color: COLORS.text.secondary,
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
  },
  settingCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  settingCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  settingDescription: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  settingInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  settingButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  settingButtonText: {
    color: COLORS.text.inverse,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  pathDisplay: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  pathDisplayText: {
    fontSize: 13,
    color: COLORS.text.primary,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  dangerButton: {
    backgroundColor: COLORS.danger,
  },
  detailCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  detailValueSmall: {
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  filenameText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  playbackControlContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  playbackMainButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  playbackMainIcon: {
    fontSize: 28,
    color: COLORS.text.inverse,
  },
  playbackStopButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackStopIcon: {
    fontSize: 20,
    color: COLORS.text.inverse,
  },
  audioProgressContainer: {
    marginTop: 8,
  },
  audioProgressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  audioProgressTime: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  audioProgressBar: {
    paddingVertical: 8,
  },
  audioProgressTrack: {
    height: 4,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
});

export default CallRecordingApp;