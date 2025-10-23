import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import CallLogs from 'react-native-call-log';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1E40AF',
  success: '#10B981',
  danger: '#EF4444',
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
  },
};

const API_URL = 'https://web.growthacademy.in/admin_api.php';

const LiveCallLogsScreen = () => {
  const [callLogs, setCallLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncedLogsModalVisible, setSyncedLogsModalVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [filterType, setFilterType] = useState('ALL');

  // Sync States
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncedCallIds, setSyncedCallIds] = useState(new Set());
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [autoSync, setAutoSync] = useState(false);
  const [userId, setUserId] = useState(null);
  const [syncedCallLogs, setSyncedCallLogs] = useState([]);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    incoming: 0,
    outgoing: 0,
    missed: 0,
    rejected: 0,
    synced: 0,
    pending: 0,
  });

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initializeScreen();
    setupAppStateListener();
    startPulseAnimation();

    return () => {
      // Cleanup
    };
  }, []);

  useEffect(() => {
    filterCallLogs();
  }, [searchQuery, callLogs, filterType]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadCallLogs(true);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    if (autoSync && !syncing) {
      const interval = setInterval(() => {
        syncCallLogsToDatabase(true);
      }, 60000); // Auto sync every minute

      return () => clearInterval(interval);
    }
  }, [autoSync, syncing]);

  // ============================================
  // INITIALIZATION
  // ============================================

  const initializeScreen = async () => {
    await loadUserId();
    await requestPermissions();
    await loadSettings();
    await loadSyncedCallIds();
    await loadCallLogs();
  };

  const loadUserId = async () => {
    try {
      const id = await AsyncStorage.getItem('user_id');
      setUserId(id);
    } catch (error) {
      console.error('Error loading user ID:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedAutoRefresh = await AsyncStorage.getItem('live_calls_auto_refresh');
      const savedAutoSync = await AsyncStorage.getItem('live_calls_auto_sync');
      const savedLastSyncTime = await AsyncStorage.getItem('live_calls_last_sync');

      if (savedAutoRefresh !== null) {
        setAutoRefresh(JSON.parse(savedAutoRefresh));
      }
      if (savedAutoSync !== null) {
        setAutoSync(JSON.parse(savedAutoSync));
      }
      if (savedLastSyncTime !== null) {
        setLastSyncTime(new Date(savedLastSyncTime));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadSyncedCallIds = async () => {
    try {
      const syncedIds = await AsyncStorage.getItem('synced_call_ids');
      if (syncedIds) {
        setSyncedCallIds(new Set(JSON.parse(syncedIds)));
      }
    } catch (error) {
      console.error('Error loading synced IDs:', error);
    }
  };

  const saveSyncedCallIds = async (ids) => {
    try {
      await AsyncStorage.setItem('synced_call_ids', JSON.stringify(Array.from(ids)));
    } catch (error) {
      console.error('Error saving synced IDs:', error);
    }
  };

  const setupAppStateListener = () => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  const handleAppStateChange = async (nextAppState) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      console.log('App came to foreground, refreshing call logs...');
      await loadCallLogs(true);
    }
    appState.current = nextAppState;
  };

  // ============================================
  // PERMISSIONS
  // ============================================

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        ]);

        const allGranted = Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Permissions Required',
            'Call log access is needed to display call information',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return false;
        }
        return true;
      } catch (error) {
        console.error('Permission error:', error);
        return false;
      }
    }
    return true;
  };

  // ============================================
  // LOAD CALL LOGS
  // ============================================

  const loadCallLogs = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setLoading(false);
        return;
      }

      const logs = await CallLogs.load(100);

      const processedLogs = logs.map((log) => {
        const timestamp = parseInt(log.timestamp) || parseInt(log.dateTime) || Date.now();
        const callId = `CALL_${timestamp}_${log.phoneNumber.replace(/\D/g, '')}`;

        return {
          ...log,
          callId: callId,
          phoneNumber: formatPhoneNumber(log.phoneNumber),
          rawPhoneNumber: log.phoneNumber,
          formattedDuration: formatDuration(parseInt(log.duration) || 0),
          formattedDate: formatDate(timestamp),
          formattedTime: formatTime(timestamp),
          callTypeLabel: getCallTypeLabel(log.type),
          callTypeColor: getCallTypeColor(log.type),
          timestamp: timestamp,
          isSynced: syncedCallIds.has(callId),
        };
      });

      processedLogs.sort((a, b) => b.timestamp - a.timestamp);

      setCallLogs(processedLogs);
      setFilteredLogs(processedLogs);
      setLastUpdateTime(new Date());
      calculateStats(processedLogs);
    } catch (error) {
      console.error('Error loading call logs:', error);
      Alert.alert('Error', 'Failed to load call logs: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStats = (logs) => {
    const statsData = {
      total: logs.length,
      incoming: logs.filter(
        (l) => l.type === '1' || l.type === 1 || l.type === 'INCOMING'
      ).length,
      outgoing: logs.filter(
        (l) => l.type === '2' || l.type === 2 || l.type === 'OUTGOING'
      ).length,
      missed: logs.filter(
        (l) => l.type === '3' || l.type === 3 || l.type === 'MISSED'
      ).length,
      rejected: logs.filter(
        (l) => l.type === '5' || l.type === 5 || l.type === 'REJECTED'
      ).length,
      synced: logs.filter((l) => l.isSynced).length,
      pending: logs.filter((l) => !l.isSynced).length,
    };
    setStats(statsData);
  };

  // ============================================
  // SYNC TO DATABASE
  // ============================================

  const syncCallLogsToDatabase = async (silent = false) => {
    if (!userId) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    if (syncing) {
      if (!silent) Alert.alert('Info', 'Sync already in progress');
      return;
    }

    try {
      setSyncing(true);
      if (!silent) setSyncModalVisible(true);

      const unsyncedLogs = callLogs.filter((log) => !log.isSynced);

      if (unsyncedLogs.length === 0) {
        if (!silent) {
          Alert.alert('Success', 'All calls are already synced');
        }
        setSyncing(false);
        setSyncModalVisible(false);
        return;
      }

      setSyncProgress({ current: 0, total: unsyncedLogs.length });

      let successCount = 0;
      let failCount = 0;
      const newSyncedIds = new Set(syncedCallIds);

      // Sync in batches of 10
      const batchSize = 10;
      for (let i = 0; i < unsyncedLogs.length; i += batchSize) {
        const batch = unsyncedLogs.slice(i, i + batchSize);

        const promises = batch.map(async (log) => {
          try {
            const syncData = prepareCallLogData(log);
            console.log('Syncing call with data:', syncData);
            const response = await axios.post(
              `${API_URL}?task=sync_call_log`,
              syncData,
              {
                headers: {
                  'Content-Type': 'application/json',
                },
                timeout: 10000,
              }
            );

            if (response.data.status === 'success') {
              newSyncedIds.add(log.callId);
              successCount++;
              return { success: true, callId: log.callId };
            } else {
              failCount++;
              console.error('Sync failed:', response.data.message);
              return { success: false, callId: log.callId };
            }
          } catch (error) {
            console.error('Error syncing call:', error);
            failCount++;
            return { success: false, callId: log.callId };
          }
        });

        await Promise.all(promises);
        setSyncProgress({
          current: Math.min(i + batchSize, unsyncedLogs.length),
          total: unsyncedLogs.length,
        });
      }

      // Update synced IDs
      setSyncedCallIds(newSyncedIds);
      await saveSyncedCallIds(newSyncedIds);

      // Update last sync time
      const now = new Date();
      setLastSyncTime(now);
      await AsyncStorage.setItem('live_calls_last_sync', now.toISOString());

      // Refresh call logs to update sync status
      await loadCallLogs(true);

      if (!silent) {
        setSyncModalVisible(false);
        Alert.alert(
          'Sync Complete',
          `Successfully synced: ${successCount}\nFailed: ${failCount}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error syncing call logs:', error);
      if (!silent) {
        Alert.alert('Error', 'Failed to sync call logs: ' + error.message);
      }
    } finally {
      setSyncing(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  const prepareCallLogData = (log) => {
    console.log('Preparing call log for sync:', log);
    // Generate unique call ID
    const callid = log.callId;

    // Determine caller/called based on call type
    const isOutgoing = log.type === '2' || log.type === 2 || log.type === 'OUTGOING';
    const callerid = isOutgoing ? userId : log.rawPhoneNumber;
    const calledby = isOutgoing ? log.rawPhoneNumber : userId;

    //Format start time for database
    const starttime = new Date(log.timestamp)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' '); 

    // Get duration in seconds
    const durationInSeconds = parseDurationToSeconds(log.formattedDuration);

    // Determine call type
    const callType = getCallTypeForDB(log.type);

    return {
      user_id: parseInt(userId),
      callid: callid,
      callerid: callerid,
      calledby: calledby,
      name: log.name || '',
      customerid: log.rawPhoneNumber.replace(/\D/g, ''),
      phonenumber: log.phoneNumber,
      starttime: starttime,
      duration: durationInSeconds,
      type: callType,
      tag: log.simDisplayName || 'mobile',
      recordingurl: '',
    };
  };

  const parseDurationToSeconds = (durationStr) => {
    if (!durationStr) return 0;

    let seconds = 0;
    const parts = durationStr.match(/(\d+)h|(\d+)m|(\d+)s/g);

    if (parts) {
      parts.forEach((part) => {
        if (part.includes('h')) {
          seconds += parseInt(part) * 3600;
        } else if (part.includes('m')) {
          seconds += parseInt(part) * 60;
        } else if (part.includes('s')) {
          seconds += parseInt(part);
        }
      });
    }

    return seconds;
  };

  const getCallTypeForDB = (type) => {
    const typeStr = String(type);

    switch (typeStr) {
      case '1':
      case 'INCOMING':
        return 'INCOMING';
      case '2':
      case 'OUTGOING':
        return 'OUTGOING';
      case '3':
      case 'MISSED':
        return 'MISSED';
      case '5':
      case 'REJECTED':
        return 'REJECTED';
      case '6':
      case 'BLOCKED':
        return 'BLOCKED';
      case '4':
      case 'VOICEMAIL':
        return 'VOICEMAIL';
      default:
        return 'UNKNOWN';
    }
  };

  const syncSingleCall = async (call) => {
    if (!userId) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    try {
      const syncData = prepareCallLogData(call);
      console.log('Syncing single call with data:', syncData);
      const response = await axios.post(
        `${API_URL}?task=sync_call_log`,
        syncData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status === 'success') {
        const newSyncedIds = new Set(syncedCallIds);
        newSyncedIds.add(call.callId);
        setSyncedCallIds(newSyncedIds);
        await saveSyncedCallIds(newSyncedIds);
        await loadCallLogs(true);
        Alert.alert('Success', 'Call synced successfully');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to sync call');
      }
    } catch (error) {
      console.error('Error syncing call:', error);
      Alert.alert('Error', 'Failed to sync call: ' + error.message);
    }
  };

  const fetchSyncedCallLogs = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}?task=get_call_logs`,
        {
          user_id: parseInt(userId),
          limit: 100,
          offset: 0,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status === 'success') {
        setSyncedCallLogs(response.data.data);
        setSyncedLogsModalVisible(true);
      } else {
        Alert.alert('Error', 'Failed to fetch synced call logs');
      }
    } catch (error) {
      console.error('Error fetching synced logs:', error);
      Alert.alert('Error', 'Failed to fetch synced call logs');
    }
  };

  const clearSyncedData = async () => {
    Alert.alert(
      'Clear Sync Data',
      'This will mark all calls as unsynced. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setSyncedCallIds(new Set());
            await AsyncStorage.removeItem('synced_call_ids');
            await AsyncStorage.removeItem('live_calls_last_sync');
            setLastSyncTime(null);
            await loadCallLogs(true);
            Alert.alert('Success', 'Sync data cleared');
          },
        },
      ]
    );
  };

  const toggleAutoSync = async () => {
    const newValue = !autoSync;
    setAutoSync(newValue);
    await AsyncStorage.setItem('live_calls_auto_sync', JSON.stringify(newValue));
    Alert.alert('Auto-Sync', `Auto-sync ${newValue ? 'enabled' : 'disabled'}`);
  };

  // ============================================
  // FILTERING
  // ============================================

  const filterCallLogs = () => {
    let filtered = callLogs;

    // Filter by type
    if (filterType !== 'ALL') {
      if (filterType === 'SYNCED') {
        filtered = filtered.filter((log) => log.isSynced);
      } else if (filterType === 'PENDING') {
        filtered = filtered.filter((log) => !log.isSynced);
      } else {
        filtered = filtered.filter((log) => {
          const type = String(log.type);
          switch (filterType) {
            case 'INCOMING':
              return type === '1' || type === 'INCOMING';
            case 'OUTGOING':
              return type === '2' || type === 'OUTGOING';
            case 'MISSED':
              return type === '3' || type === 'MISSED';
            case 'REJECTED':
              return type === '5' || type === 'REJECTED';
            default:
              return true;
          }
        });
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.phoneNumber.toLowerCase().includes(query) ||
          log.rawPhoneNumber.includes(query) ||
          (log.name && log.name.toLowerCase().includes(query))
      );
    }

    setFilteredLogs(filtered);
  };

  // ============================================
  // FORMATTING FUNCTIONS
  // ============================================

  const formatPhoneNumber = (number) => {
    if (!number || number === '-1') return 'Unknown';

    const cleaned = number.replace(/\D/g, '');

    if (cleaned.startsWith('91') && cleaned.length === 12) {
      const main = cleaned.substring(2);
      return `+91 ${main.substring(0, 5)} ${main.substring(5)}`;
    } else if (cleaned.length === 10) {
      return `${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
    }

    return number;
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(
      yesterday.getFullYear(),
      yesterday.getMonth(),
      yesterday.getDate()
    );

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday';
    }

    const day = date.getDate().toString().padStart(2, '0');
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';

    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString() .padStart(2, '0')}:${seconds.toString()
      .padStart(2, '0')} ${ampm}`;
  };

  const getCallTypeLabel = (type) => {
    const typeStr = String(type);

    switch (typeStr) {
      case '1':
      case 'INCOMING':
        return 'Incoming';
      case '2':
      case 'OUTGOING':
        return 'Outgoing';
      case '3':
      case 'MISSED':
        return 'Missed';
      case '5':
      case 'REJECTED':
        return 'Rejected';
      case '6':
      case 'BLOCKED':
        return 'Blocked';
      case '4':
      case 'VOICEMAIL':
        return 'Voicemail';
      default:
        return 'Unknown';
    }
  };

  const getCallTypeColor = (type) => {
    const typeStr = String(type);

    switch (typeStr) {
      case '1':
      case 'INCOMING':
        return COLORS.success;
      case '2':
      case 'OUTGOING':
        return COLORS.info;
      case '3':
      case 'MISSED':
        return COLORS.danger;
      case '5':
      case 'REJECTED':
        return COLORS.warning;
      default:
        return COLORS.text.secondary;
    }
  };

  const getCallTypeIcon = (type) => {
    const typeStr = String(type);

    switch (typeStr) {
      case '1':
      case 'INCOMING':
        return 'arrow-down';
      case '2':
      case 'OUTGOING':
        return 'arrow-up';
      case '3':
      case 'MISSED':
        return 'close-circle';
      case '5':
      case 'REJECTED':
        return 'hand-left';
      default:
        return 'help-circle';
    }
  };

  // ============================================
  // ACTIONS
  // ============================================

  const makeCall = (phoneNumber) => {
    Alert.alert('Make Call', `Call ${phoneNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call',
        onPress: () => {
          Linking.openURL(`tel:${phoneNumber.replace(/\s/g, '')}`);
        },
      },
    ]);
  };

  const toggleAutoRefresh = async () => {
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    await AsyncStorage.setItem('live_calls_auto_refresh', JSON.stringify(newValue));
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCallLogs();
  }, []);

  // ============================================
  // ANIMATIONS
  // ============================================

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  const renderFilterChip = (label, type, count) => (
    <TouchableOpacity
      style={[styles.filterChip, filterType === type && styles.filterChipActive]}
      onPress={() => setFilterType(type)}
    >
      <Text
        style={[
          styles.filterChipText,
          filterType === type && styles.filterChipTextActive,
        ]}
      >
        {label}
      </Text>
      {count > 0 && (
        <View
          style={[
            styles.filterChipBadge,
            filterType === type && styles.filterChipBadgeActive,
          ]}
        >
          <Text
            style={[
              styles.filterChipBadgeText,
              filterType === type && styles.filterChipBadgeTextActive,
            ]}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderCallItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.callCard}
      onPress={() => {
        setSelectedCall(item);
        setModalVisible(true);
      }}
      activeOpacity={0.7}
    >
      <View
        style={[styles.callTypeIndicator, { backgroundColor: item.callTypeColor }]}
      />

      <View style={styles.callCardContent}>
        <View style={styles.callCardHeader}>
          <View style={styles.callCardLeft}>
            <View
              style={[
                styles.callIconContainer,
                { backgroundColor: item.callTypeColor + '15' },
              ]}
            >
              <Ionicons
                name={getCallTypeIcon(item.type)}
                size={20}
                color={item.callTypeColor}
              />
            </View>
            <View style={styles.callInfoContainer}>
              <Text style={styles.callName} numberOfLines={1}>
                {item.name || item.phoneNumber}
              </Text>
              {item.name && (
                <Text style={styles.callNumber} numberOfLines={1}>
                  {item.phoneNumber}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.callCardActions}>
            {item.isSynced ? (
              <View style={styles.syncedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.syncButton}
                onPress={(e) => {
                  e.stopPropagation();
                  syncSingleCall(item);
                }}
              >
                <Ionicons name="cloud-upload-outline" size={16} color={COLORS.warning} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.callButton}
              onPress={(e) => {
                e.stopPropagation();
                makeCall(item.rawPhoneNumber);
              }}
            >
              <Ionicons name="call" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.callCardFooter}>
          <View
            style={[
              styles.callTypeBadge,
              { backgroundColor: item.callTypeColor + '15' },
            ]}
          >
            <Text style={[styles.callTypeBadgeText, { color: item.callTypeColor }]}>
              {item.callTypeLabel}
            </Text>
          </View>
          <View style={styles.callDetailItem}>
            <Ionicons name="calendar-outline" size={12} color={COLORS.text.secondary} />
            <Text style={styles.callDetailText}>{item.formattedDate}</Text>
          </View>
          <View style={styles.callDetailItem}>
            <Ionicons name="time-outline" size={12} color={COLORS.text.secondary} />
            <Text style={styles.callDetailText}>{item.formattedTime}</Text>
          </View>
          {parseInt(item.duration) > 0 && (
            <View style={styles.callDetailItem}>
              <Ionicons name="timer-outline" size={12} color={COLORS.text.secondary} />
              <Text style={styles.callDetailText}>{item.formattedDuration}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="call-outline" size={80} color={COLORS.text.tertiary} />
      <Text style={styles.emptyText}>No call logs found</Text>
      <Text style={styles.emptySubtext}>
        {searchQuery ? 'Try different search terms' : 'Your call history will appear here'}
      </Text>
    </View>
  );

  // ============================================
  // MODALS
  // ============================================

  const SyncModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={syncModalVisible}
      onRequestClose={() => !syncing && setSyncModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Syncing Call Logs</Text>
          </View>

          <View style={styles.modalBody}>
            <View style={styles.syncProgressContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.syncProgressText}>
                Syncing {syncProgress.current} of {syncProgress.total} calls...
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  const CallDetailsModal = () => {
    if (!selectedCall) return null;

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
              <Text style={styles.modalHeaderTitle}>Call Details</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.detailCard}>
                <View
                  style={[
                    styles.detailIconContainer,
                    { backgroundColor: selectedCall.callTypeColor + '15' },
                  ]}
                >
                  <Ionicons name="person" size={32} color={selectedCall.callTypeColor} />
                </View>
                <Text style={styles.detailContactName}>
                  {selectedCall.name || 'Unknown'}
                </Text>
                <Text style={styles.detailPhoneNumber}>{selectedCall.phoneNumber}</Text>
                <View
                  style={[
                    styles.detailCallTypeBadge,
                    { backgroundColor: selectedCall.callTypeColor },
                  ]}
                >
                  <Text style={styles.detailCallTypeBadgeText}>
                    {selectedCall.callTypeLabel}
                  </Text>
                </View>
                {selectedCall.isSynced && (
                  <View style={styles.detailSyncedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    <Text style={styles.detailSyncedText}>Synced to Database</Text>
                  </View>
                )}
              </View>

              <View style={styles.detailInfoCard}>
                <View style={styles.detailInfoRow}>
                  <Ionicons name="calendar" size={20} color={COLORS.text.secondary} />
                  <View style={styles.detailInfoTextContainer}>
                    <Text style={styles.detailInfoLabel}>Date</Text>
                    <Text style={styles.detailInfoValue}>
                      {selectedCall.formattedDate}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailInfoRow}>
                  <Ionicons name="time" size={20} color={COLORS.text.secondary} />
                  <View style={styles.detailInfoTextContainer}>
                    <Text style={styles.detailInfoLabel}>Time</Text>
                    <Text style={styles.detailInfoValue}>
                      {selectedCall.formattedTime}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailInfoRow}>
                  <Ionicons name="timer" size={20} color={COLORS.text.secondary} />
                  <View style={styles.detailInfoTextContainer}>
                    <Text style={styles.detailInfoLabel}>Duration</Text>
                    <Text style={styles.detailInfoValue}>
                      {selectedCall.formattedDuration || 'Not answered'}
                    </Text>
                  </View>
                </View>

                {selectedCall.simDisplayName && (
                  <View style={styles.detailInfoRow}>
                    <Ionicons name="card" size={20} color={COLORS.text.secondary} />
                    <View style={styles.detailInfoTextContainer}>
                      <Text style={styles.detailInfoLabel}>SIM</Text>
                      <Text style={styles.detailInfoValue}>
                        {selectedCall.simDisplayName}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.detailActions}>
                {!selectedCall.isSynced && (
                  <TouchableOpacity
                    style={styles.detailSyncButton}
                    onPress={() => {
                      setModalVisible(false);
                      syncSingleCall(selectedCall);
                    }}
                  >
                    <Ionicons name="cloud-upload" size={20} color={COLORS.text.inverse} />
                    <Text style={styles.detailSyncButtonText}>Sync to Database</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.detailCallButton}
                  onPress={() => {
                    setModalVisible(false);
                    makeCall(selectedCall.rawPhoneNumber);
                  }}
                >
                  <Ionicons name="call" size={20} color={COLORS.text.inverse} />
                  <Text style={styles.detailCallButtonText}>Call Back</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const StatsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={statsModalVisible}
      onRequestClose={() => setStatsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Call Statistics</Text>
            <TouchableOpacity
              onPress={() => setStatsModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: COLORS.primary + '15' }]}>
                <Ionicons name="call" size={32} color={COLORS.primary} />
                <Text style={styles.statNumber}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total Calls</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.success + '15' }]}>
                <Ionicons name="arrow-down" size={32} color={COLORS.success} />
                <Text style={styles.statNumber}>{stats.incoming}</Text>
                <Text style={styles.statLabel}>Incoming</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.info + '15' }]}>
                <Ionicons name="arrow-up" size={32} color={COLORS.info} />
                <Text style={styles.statNumber}>{stats.outgoing}</Text>
                <Text style={styles.statLabel}>Outgoing</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.danger + '15' }]}>
                <Ionicons name="close-circle" size={32} color={COLORS.danger} />
                <Text style={styles.statNumber}>{stats.missed}</Text>
                <Text style={styles.statLabel}>Missed</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.success + '15' }]}>
                <Ionicons name="cloud-done" size={32} color={COLORS.success} />
                <Text style={styles.statNumber}>{stats.synced}</Text>
                <Text style={styles.statLabel}>Synced</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.warning + '15' }]}>
                <Ionicons name="cloud-upload" size={32} color={COLORS.warning} />
                <Text style={styles.statNumber}>{stats.pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>

            {lastSyncTime && (
              <View style={styles.lastSyncContainer}>
                <Ionicons name="time-outline" size={16} color={COLORS.text.secondary} />
                <Text style={styles.lastSyncText}>
                  Last synced: {lastSyncTime.toLocaleString()}
                </Text>
              </View>
            )}

            {lastUpdateTime && (
              <View style={styles.lastUpdateContainer}>
                <Ionicons name="refresh-outline" size={16} color={COLORS.text.secondary} />
                <Text style={styles.lastUpdateText}>
                  Last updated: {lastUpdateTime.toLocaleTimeString()}
                </Text>
              </View>
            )}

            <View style={styles.syncControls}>
              <TouchableOpacity style={styles.syncControlItem} onPress={toggleAutoSync}>
                <View style={styles.syncControlLeft}>
                  <Ionicons name="sync" size={24} color={COLORS.primary} />
                  <View style={styles.syncControlTextContainer}>
                    <Text style={styles.syncControlTitle}>Auto-Sync</Text>
                    <Text style={styles.syncControlSubtitle}>Sync every minute</Text>
                  </View>
                </View>
                <View style={[styles.toggle, autoSync && styles.toggleActive]}>
                  <View
                    style={[styles.toggleThumb, autoSync && styles.toggleThumbActive]}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.dangerButton} onPress={clearSyncedData}>
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
                <Text style={styles.dangerButtonText}>Clear Sync Data</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const SyncedLogsModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={syncedLogsModalVisible}
      onRequestClose={() => setSyncedLogsModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Synced Call Logs</Text>
            <TouchableOpacity
              onPress={() => setSyncedLogsModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {syncedCallLogs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="cloud-offline-outline" size={60} color={COLORS.text.tertiary} />
                <Text style={styles.emptyText}>No synced logs</Text>
              </View>
            ) : (
              syncedCallLogs.map((log, index) => (
                <View key={index} style={styles.syncedLogItem}>
                  <View style={styles.syncedLogHeader}>
                    <Text style={styles.syncedLogName}>{log.name || log.phonenumber}</Text>
                    <View
                      style={[
                        styles.syncedLogTypeBadge,
                        { backgroundColor: getCallTypeColor(log.type) + '15' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.syncedLogTypeText,
                          { color: getCallTypeColor(log.type) },
                        ]}
                      >
                        {log.type}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.syncedLogPhone}>{log.phonenumber}</Text>
                  <View style={styles.syncedLogFooter}>
                    <Text style={styles.syncedLogDetail}>
                      {new Date(log.starttime).toLocaleString()}
                    </Text>
                    <Text style={styles.syncedLogDetail}>
                      Duration: {formatDuration(log.duration)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Live Call Logs</Text>
            {autoRefresh && (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </Animated.View>
            )}
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerButton, syncing && styles.headerButtonDisabled]}
              onPress={() => !syncing && syncCallLogsToDatabase()}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={COLORS.text.inverse} />
              ) : (
                <Ionicons name="cloud-upload" size={22} color={COLORS.text.inverse} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={fetchSyncedCallLogs}>
              <Ionicons name="cloud-done" size={22} color={COLORS.text.inverse} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setStatsModalVisible(true)}
            >
              <Ionicons name="stats-chart" size={22} color={COLORS.text.inverse} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={toggleAutoRefresh}>
              <Ionicons
                name={autoRefresh ? 'pause' : 'play'}
                size={22}
                color={COLORS.text.inverse}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or number..."
            placeholderTextColor={COLORS.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {renderFilterChip('All', 'ALL', stats.total)}
          {renderFilterChip('Incoming', 'INCOMING', stats.incoming)}
          {renderFilterChip('Outgoing', 'OUTGOING', stats.outgoing)}
          {renderFilterChip('Missed', 'MISSED', stats.missed)}
          {renderFilterChip('Synced', 'SYNCED', stats.synced)}
          {renderFilterChip('Pending', 'PENDING', stats.pending)}
        </ScrollView>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading call logs...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          renderItem={renderCallItem}
          keyExtractor={(item, index) => `${item.callId}-${index}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <CallDetailsModal />
      <StatsModal />
      <SyncModal />
      <SyncedLogsModal />
    </SafeAreaView>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text.inverse,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
    marginRight: 6,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.inverse,
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonDisabled: {
    opacity: 0.6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.text.primary,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: COLORS.surface,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.inverse,
  },
  filterChipTextActive: {
    color: COLORS.primary,
  },
  filterChipBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterChipBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text.inverse,
  },
  filterChipBadgeTextActive: {
    color: COLORS.text.inverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  listContent: {
    padding: 16,
  },
  callCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  callTypeIndicator: {
    width: 4,
  },
  callCardContent: {
    flex: 1,
    padding: 16,
  },
  callCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  callCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  callIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  callInfoContainer: {
    flex: 1,
  },
  callName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  callNumber: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  callCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.warning + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callCardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  callTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  callTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  callDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  callDetailText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.text.tertiary,
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
    maxHeight: '80%',
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
  modalBody: {
    padding: 20,
  },
  syncProgressContainer: {
    alignItems: 'center',
    padding: 40,
  },
  syncProgressText: {
    fontSize: 16,
    color: COLORS.text.primary,
    marginTop: 20,
    marginBottom: 20,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  detailCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    marginBottom: 20,
  },
  detailIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailContactName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  detailPhoneNumber: {
    fontSize: 18,
    color: COLORS.text.secondary,
    marginBottom: 12,
  },
  detailCallTypeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  detailCallTypeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.inverse,
  },
  detailSyncedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.success + '15',
    borderRadius: 16,
  },
  detailSyncedText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  detailInfoCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 16,
  },
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailInfoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  detailInfoLabel: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginBottom: 2,
  },
  detailInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  detailActions: {
    gap: 12,
  },
  detailSyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.warning,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  detailSyncButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.inverse,
  },
  detailCallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  detailCallButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.inverse,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  lastSyncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    marginBottom: 12,
  },
  lastSyncText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  lastUpdateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    marginBottom: 20,
  },
  lastUpdateText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  syncControls: {
    gap: 12,
  },
  syncControlItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
  },
  syncControlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncControlTextContainer: {
    flex: 1,
  },
  syncControlTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  syncControlSubtitle: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border.medium,
    padding: 2,
  },
  toggleActive: {
    backgroundColor: COLORS.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: COLORS.danger + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger,
  },
  syncedLogItem: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  syncedLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  syncedLogName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 1,
  },
  syncedLogTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncedLogTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  syncedLogPhone: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  syncedLogFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  syncedLogDetail: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
});

export default LiveCallLogsScreen;