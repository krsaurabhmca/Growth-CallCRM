import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import axios from 'axios';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const CallHistoryScreen = () => {
  const params = useLocalSearchParams();
  const { phoneNumber, contactName } = params;

  const [callHistory, setCallHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [sound, setSound] = useState(null);
  const [playbackStatus, setPlaybackStatus] = useState({});
  const [currentPosition, setCurrentPosition] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, today, week, month
  const [sortBy, setSortBy] = useState('date'); // date, duration

  // Statistics
  const [stats, setStats] = useState({
    totalCalls: 0,
    totalDuration: 0,
    thisMonth: 0,
    avgDuration: 0,
    totalSize: 0,
    longestCall: 0,
    shortestCall: 0,
  });

  useEffect(() => {
    fetchCallHistory();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, filterType, sortBy, callHistory]);

  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        'https://web.growthacademy.in/admin_api.php?task=call_history',
        {
          phone_number: phoneNumber,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status === 'success') {
        const data = response.data.data;
        setCallHistory(data);
        calculateStatistics(data);
      } else {
        Alert.alert('Error', 'Failed to fetch call history');
      }
    } catch (error) {
      console.error('Error fetching call history:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStatistics = (data) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalDurationSeconds = 0;
    let thisMonthCalls = 0;
    let totalSize = 0;
    let durations = [];

    data.forEach((call) => {
      // Parse duration (format: "0:07" or "1:23")
      const [min, sec] = call.duration.split(':').map(Number);
      const durationInSeconds = min * 60 + sec;
      totalDurationSeconds += durationInSeconds;
      durations.push(durationInSeconds);

      // Count this month calls
      const callDate = new Date(call.call_timestamp);
      if (
        callDate.getMonth() === currentMonth &&
        callDate.getFullYear() === currentYear
      ) {
        thisMonthCalls++;
      }

      // Total file size
      totalSize += parseInt(call.file_size);
    });

    setStats({
      totalCalls: data.length,
      totalDuration: totalDurationSeconds,
      thisMonth: thisMonthCalls,
      avgDuration: data.length > 0 ? totalDurationSeconds / data.length : 0,
      totalSize: totalSize,
      longestCall: Math.max(...durations, 0),
      shortestCall: Math.min(...durations, 0),
    });
  };

  const applyFilters = () => {
    let filtered = [...callHistory];

    // Apply search
    if (searchQuery.trim()) {
      filtered = filtered.filter((call) => {
        const searchLower = searchQuery.toLowerCase();
        return (
          call.call_date.toLowerCase().includes(searchLower) ||
          call.call_time.toLowerCase().includes(searchLower) ||
          call.duration.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply date filter
    const now = new Date();
    if (filterType === 'today') {
      filtered = filtered.filter((call) => {
        const callDate = new Date(call.call_timestamp);
        return callDate.toDateString() === now.toDateString();
      });
    } else if (filterType === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((call) => {
        const callDate = new Date(call.call_timestamp);
        return callDate >= weekAgo;
      });
    } else if (filterType === 'month') {
      filtered = filtered.filter((call) => {
        const callDate = new Date(call.call_timestamp);
        return (
          callDate.getMonth() === now.getMonth() &&
          callDate.getFullYear() === now.getFullYear()
        );
      });
    }

    // Apply sorting
    if (sortBy === 'duration') {
      filtered.sort((a, b) => {
        const aDur = a.duration.split(':').reduce((acc, val) => acc * 60 + parseInt(val), 0);
        const bDur = b.duration.split(':').reduce((acc, val) => acc * 60 + parseInt(val), 0);
        return bDur - aDur;
      });
    } else {
      filtered.sort((a, b) => new Date(b.call_timestamp) - new Date(a.call_timestamp));
    }

    setFilteredHistory(filtered);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCallHistory();
  }, []);

  const formatFileSize = (bytes) => {
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    }
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const formatDuration = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const playAudio = async (item) => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      if (playingId === item.id) {
        setPlayingId(null);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const audioUrl = `https://web.growthacademy.in/recordings/${item.stored_file_name}`;

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setPlayingId(item.id);
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio recording');
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    setPlaybackStatus(status);
    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis);
      setCurrentDuration(status.durationMillis);

      if (status.didJustFinish) {
        setPlayingId(null);
        setCurrentPosition(0);
      }
    }
  };

  const pauseAudio = async () => {
    if (sound) {
      await sound.pauseAsync();
    }
  };

  const resumeAudio = async () => {
    if (sound) {
      await sound.playAsync();
    }
  };

  const seekAudio = async (value) => {
    if (sound) {
      await sound.setPositionAsync(value);
    }
  };

  const FilterModal = () => (
    <Modal
      visible={showFilter}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFilter(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter & Sort</Text>
            <TouchableOpacity onPress={() => setShowFilter(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Time Period</Text>
            <View style={styles.filterOptions}>
              {['all', 'today', 'week', 'month'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterOption,
                    filterType === type && styles.filterOptionActive,
                  ]}
                  onPress={() => setFilterType(type)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterType === type && styles.filterOptionTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Sort By</Text>
            <View style={styles.filterOptions}>
              {[
                { value: 'date', label: 'Date', icon: 'calendar' },
                { value: 'duration', label: 'Duration', icon: 'time' },
              ].map((sort) => (
                <TouchableOpacity
                  key={sort.value}
                  style={[
                    styles.filterOption,
                    sortBy === sort.value && styles.filterOptionActive,
                  ]}
                  onPress={() => setSortBy(sort.value)}
                >
                  <Ionicons
                    name={sort.icon}
                    size={16}
                    color={sortBy === sort.value ? '#fff' : '#2196F3'}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      sortBy === sort.value && styles.filterOptionTextActive,
                    ]}
                  >
                    {sort.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => setShowFilter(false)}
          >
            <LinearGradient
              colors={['#2196F3', '#1976D2']}
              style={styles.applyButtonGradient}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderStatCard = (icon, label, value, color, gradient) => (
    <LinearGradient colors={gradient} style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </LinearGradient>
  );

  const renderTimelineItem = ({ item, index }) => {
    const isPlaying = playingId === item.id && playbackStatus.isPlaying;
    const isPaused = playingId === item.id && !playbackStatus.isPlaying;
    const isActive = playingId === item.id;

    return (
      <View style={styles.timelineContainer}>
        {index !== filteredHistory.length - 1 && (
          <View style={styles.timelineLine} />
        )}

        <View
          style={[styles.timelineDot, isActive && styles.timelineDotActive]}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={10}
            color="#fff"
          />
        </View>

        <View style={[styles.callCard, isActive && styles.callCardActive]}>
          <View style={styles.callCardContent}>
            <View style={styles.callCardLeft}>
              <View style={styles.dateTimeRow}>
                <View style={styles.dateContainer}>
                  <Ionicons name="calendar-outline" size={14} color="#2196F3" />
                  <Text style={styles.callDate}>{item.call_date}</Text>
                </View>
                <View style={styles.timeChip}>
                  <Ionicons name="time-outline" size={12} color="#666" />
                  <Text style={styles.callTime}>{item.call_time}</Text>
                </View>
              </View>

              <View style={styles.durationRow}>
                <Ionicons name="hourglass-outline" size={14} color="#FF9800" />
                <Text style={styles.duration}>{item.duration}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.playButtonSmall}
              onPress={() => {
                if (isPlaying) {
                  pauseAudio();
                } else if (isPaused) {
                  resumeAudio();
                } else {
                  playAudio(item);
                }
              }}
            >
              <LinearGradient
                colors={['#2196F3', '#1976D2']}
                style={styles.playButtonSmallGradient}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={20}
                  color="#fff"
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {isActive && (
            <View style={styles.playerExpanded}>
              <View style={styles.progressRow}>
                <Text style={styles.progressTime}>
                  {formatDuration(currentPosition)}
                </Text>
                <Slider
                  style={styles.sliderSmall}
                  minimumValue={0}
                  maximumValue={currentDuration}
                  value={currentPosition}
                  onSlidingComplete={seekAudio}
                  minimumTrackTintColor="#2196F3"
                  maximumTrackTintColor="#E0E0E0"
                  thumbTintColor="#2196F3"
                />
                <Text style={styles.progressTime}>
                  {formatDuration(currentDuration)}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Contact Info */}
      <View style={styles.contactHeader}>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>
            {contactName || phoneNumber}
          </Text>
          {contactName && (
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
          )}
        </View>
        <View style={styles.totalCallsBadge}>
          <Text style={styles.totalCallsText}>
            {filteredHistory.length} {filteredHistory.length === 1 ? 'Call' : 'Calls'}
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search calls..."
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
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilter(true)}
        >
          <LinearGradient
            colors={['#2196F3', '#1976D2']}
            style={styles.filterButtonGradient}
          >
            <Ionicons name="filter" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Statistics Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          {renderStatCard(
            'call',
            'Total Calls',
            stats.totalCalls,
            '#2196F3',
            ['#E3F2FD', '#fff']
          )}
          {renderStatCard(
            'calendar',
            'This Month',
            stats.thisMonth,
            '#4CAF50',
            ['#E8F5E9', '#fff']
          )}
        </View>
        <View style={styles.statsRow}>
          {renderStatCard(
            'time',
            'Total Time',
            formatTime(stats.totalDuration),
            '#FF9800',
            ['#FFF3E0', '#fff']
          )}
          {renderStatCard(
            'speedometer',
            'Avg Duration',
            formatTime(Math.floor(stats.avgDuration)),
            '#9C27B0',
            ['#F3E5F5', '#fff']
          )}
        </View>
        <View style={styles.statsRow}>
          {renderStatCard(
            'trending-up',
            'Longest',
            formatTime(stats.longestCall),
            '#F44336',
            ['#FFEBEE', '#fff']
          )}
          {renderStatCard(
            'document',
            'Total Size',
            formatFileSize(stats.totalSize),
            '#00BCD4',
            ['#E0F7FA', '#fff']
          )}
        </View>
      </View>

      {/* Active Filters Display */}
      {(filterType !== 'all' || sortBy !== 'date') && (
        <View style={styles.activeFilters}>
          <Text style={styles.activeFiltersText}>Active filters: </Text>
          {filterType !== 'all' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Text>
              <TouchableOpacity onPress={() => setFilterType('all')}>
                <Ionicons name="close" size={14} color="#2196F3" />
              </TouchableOpacity>
            </View>
          )}
          {sortBy !== 'date' && (
            <View style={styles.filterChip}>
              <Text style={styles.filterChipText}>Sort by {sortBy}</Text>
              <TouchableOpacity onPress={() => setSortBy('date')}>
                <Ionicons name="close" size={14} color="#2196F3" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Call Timeline</Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={60} color="#CCC" />
      <Text style={styles.emptyText}>
        {searchQuery ? 'No calls found' : 'No call history'}
      </Text>
      <Text style={styles.emptySubText}>
        {searchQuery ? 'Try different search terms' : 'Pull down to refresh'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading call history...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1976D2', '#2196F3']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (sound) {
                sound.unloadAsync();
              }
              router.back();
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Call History</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={filteredHistory}
        renderItem={renderTimelineItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
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

      <FilterModal />
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
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 5,
  },
  listContent: {
    padding: 16,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#666',
  },
  totalCallsBadge: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  totalCallsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchSection: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    marginLeft: 8,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  activeFiltersText: {
    fontSize: 13,
    color: '#666',
    marginRight: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  filterChipText: {
    fontSize: 12,
    color: '#2196F3',
    marginRight: 6,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  timelineContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 16,
    top: 32,
    bottom: -16,
    width: 2,
    backgroundColor: '#E0E0E0',
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  timelineDotActive: {
    backgroundColor: '#1976D2',
    transform: [{ scale: 1.1 }],
  },
  callCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  callCardActive: {
    borderWidth: 1.5,
    borderColor: '#2196F3',
    shadowOpacity: 0.15,
  },
  callCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  callCardLeft: {
    flex: 1,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 6,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  callTime: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duration: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF9800',
    marginLeft: 6,
  },
  playButtonSmall: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  playButtonSmallGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTime: {
    fontSize: 11,
    color: '#666',
    width: 36,
  },
  sliderSmall: {
    flex: 1,
    marginHorizontal: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterOptionActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#fff',
  },
  applyButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  applyButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CallHistoryScreen;