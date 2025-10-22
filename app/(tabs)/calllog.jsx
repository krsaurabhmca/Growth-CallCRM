import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CallLogScreen = () => {
  const [callLogs, setCallLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCalls, setTotalCalls] = useState(0);

  useEffect(() => {
    fetchCallLogs();
  }, []);

  useEffect(() => {
    filterCallLogs();
  }, [searchQuery, callLogs]);

  const fetchCallLogs = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('user_id');

      if (!userId) {
        Alert.alert('Error', 'User not logged in');
        router.replace('/login');
        return;
      }

      const response = await axios.post(
        'https://web.growthacademy.in/admin_api.php?task=call_log',
        {
          user_id: parseInt(userId),
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status === 'success') {
        setCallLogs(response.data.data);
        setFilteredLogs(response.data.data);

        // Calculate total calls
        const total = response.data.data.reduce(
          (sum, log) => sum + parseInt(log.call_count),
          0
        );
        setTotalCalls(total);
      } else {
        Alert.alert('Error', 'Failed to fetch call logs');
      }
    } catch (error) {
      console.error('Error fetching call logs:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterCallLogs = () => {
    if (!searchQuery.trim()) {
      setFilteredLogs(callLogs);
      return;
    }

    const filtered = callLogs.filter((log) => {
      const query = searchQuery.toLowerCase();
      const phoneMatch = log.phone_number.toLowerCase().includes(query);
      const nameMatch = log.name
        ? log.name.toLowerCase().includes(query)
        : false;
      return phoneMatch || nameMatch;
    });

    setFilteredLogs(filtered);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCallLogs();
  }, []);

  const navigateToHistory = (item) => {
    if (item.phone_number === 'Unknown') {
      Alert.alert('Error', 'Cannot view history for unknown numbers');
      return;
    }

    router.push({
      pathname: '/CallHistoryScreen',
      params: {
        phoneNumber: item.phone_number,
        contactName: item.name || '',
      },
    });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    if (!name) return '#BDBDBD';
    
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788'
    ];
    
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const renderCallLogItem = ({ item, index }) => {
    const isUnknown = item.phone_number === 'Unknown';
    const hasName = item.name !== null && item.name !== undefined;
    const avatarColor = getAvatarColor(item.name);

    return (
      <TouchableOpacity
        style={styles.logItem}
        onPress={() => navigateToHistory(item)}
        disabled={isUnknown}
        activeOpacity={0.7}
      >
        <View style={styles.logItemLeft}>
          <View
            style={[
              styles.avatarContainer,
              isUnknown && styles.avatarUnknown,
              hasName && { backgroundColor: avatarColor }
            ]}
          >
            {hasName ? (
              <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
            ) : (
              <Ionicons
                name={isUnknown ? 'help' : 'call'}
                size={24}
                color={isUnknown ? '#999' : '#fff'}
              />
            )}
          </View>

          <View style={styles.logItemInfo}>
            {hasName ? (
              <>
                <Text style={styles.contactName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.phoneNumber} numberOfLines={1}>
                  {item.phone_number}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.contactName} numberOfLines={1}>
                  {isUnknown ? 'Unknown Number' : item.phone_number}
                </Text>
                {!isUnknown && (
                  <Text style={styles.noContactLabel}>No name available</Text>
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.logItemRight}>
          <View style={styles.callCountBadge}>
            <Ionicons name="call" size={14} color="#fff" style={styles.callIcon} />
            <Text style={styles.callCountText}>{item.call_count}</Text>
          </View>
          {!isUnknown && (
            <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerStats}>
      <LinearGradient
        colors={['#2196F3', '#1976D2']}
        style={styles.statCard}
      >
        <View style={styles.statIconContainer}>
          <Ionicons name="people" size={28} color="#fff" />
        </View>
        <Text style={styles.statNumber}>{callLogs.length}</Text>
        <Text style={styles.statLabel}>Contacts</Text>
      </LinearGradient>

      <LinearGradient
        colors={['#4CAF50', '#388E3C']}
        style={styles.statCard}
      >
        <View style={styles.statIconContainer}>
          <Ionicons name="call" size={28} color="#fff" />
        </View>
        <Text style={styles.statNumber}>{totalCalls}</Text>
        <Text style={styles.statLabel}>Total Calls</Text>
      </LinearGradient>
    </View>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="call-outline" size={80} color="#BDBDBD" />
      </View>
      <Text style={styles.emptyText}>No call logs found</Text>
      <Text style={styles.emptySubText}>
        {searchQuery 
          ? 'Try different search terms' 
          : 'Your call history will appear here'}
      </Text>
      {!searchQuery && (
        <TouchableOpacity style={styles.refreshButtonEmpty} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#2196F3" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading call logs...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
     
      {/* Header */}
      <LinearGradient colors={['#1565C0', '#1976D2']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Call Logs</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#999"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or number..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Call Logs List */}
      <FlatList
        data={filteredLogs}
        renderItem={renderCallLogItem}
        keyExtractor={(item, index) => `${item.phone_number}-${index}`}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  listContent: {
    padding: 20,
    paddingTop: 15,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#fff',
    marginTop: 5,
    opacity: 0.9,
    fontWeight: '500',
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  logItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarUnknown: {
    backgroundColor: '#F5F5F5',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  logItemInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#666',
  },
  noContactLabel: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  logItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 50,
    justifyContent: 'center',
  },
  callIcon: {
    marginRight: 4,
  },
  callCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    color: '#333',
    marginTop: 15,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  refreshButtonEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  refreshButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default CallLogScreen;