import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    AppState,
    FlatList,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
//import CallDetectorManager from 'react-native-call-detection';
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_CONFIG = {
  BASE_URL: "https://web.growthacademy.in",
  UPLOAD_ENDPOINT: "/upload-recording.php",
  ADMIN_API: "/admin_api.php",
};

const STORAGE_KEYS = {
  SAVED_PATH: "@call_recordings_path",
  LAST_SYNC: "@last_sync_timestamp",
  API_URL: "@api_base_url",
  SYNCED_FILES: "@synced_files_list",
  AUTO_REFRESH: "@auto_refresh_enabled",
  AUTO_SYNC: "@auto_sync_enabled",
};

// Professional Color Scheme
const COLORS = {
  primary: "#2563EB",
  primaryDark: "#1E40AF",
  secondary: "#10B981",
  accent: "#F59E0B",
  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
  info: "#3B82F6",

  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",

  text: {
    primary: "#1E293B",
    secondary: "#64748B",
    tertiary: "#94A3B8",
    inverse: "#FFFFFF",
  },

  border: {
    light: "#E2E8F0",
    medium: "#CBD5E1",
    dark: "#94A3B8",
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CallRecordingApp = () => {
  // File management state
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Sync state
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncedFilesList, setSyncedFilesList] = useState(new Set());
  const [currentSyncFile, setCurrentSyncFile] = useState("");

  // Settings state
  const [apiUrl, setApiUrl] = useState(API_CONFIG.BASE_URL);
  const [userId, setUserId] = useState(null);

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [lastCallTime, setLastCallTime] = useState(null);
  const [newRecordingsCount, setNewRecordingsCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Call log matching state
  const [callLogs, setCallLogs] = useState([]);
  const [matchingResults, setMatchingResults] = useState({});
  const [syncStats, setSyncStats] = useState({
    total: 0,
    matched: 0,
    unmatched: 0,
  });

  // Audio player state
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingUri, setPlayingUri] = useState(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Refs
  const appState = useRef(AppState.currentState);
  const callDetector = useRef(null);
  const refreshTimer = useRef(null);
  const previousFileCount = useRef(0);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    loadUserId();
    loadSavedSettings();
    setupCallDetection();
    setupAppStateListener();
    configureAudio();

    return () => {
      cleanupCallDetection();
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedPath && autoRefreshEnabled) {
      previousFileCount.current = files.length;
    }
  }, [selectedPath]);

  useEffect(() => {
    if (
      files.length > previousFileCount.current &&
      previousFileCount.current > 0
    ) {
      const newCount = files.length - previousFileCount.current;
      setNewRecordingsCount(newCount);

      if (newCount > 0) {
        handleNewRecordingsDetected(newCount);
      }
    }
    previousFileCount.current = files.length;
  }, [files.length]);

  const loadUserId = async () => {
    try {
      const id = await AsyncStorage.getItem("user_id");
      setUserId(id);
      console.log("📱 User ID loaded:", id);
    } catch (error) {
      console.error("Error loading user ID:", error);
    }
  };

  const configureAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error("Error configuring audio:", error);
    }
  };

  // ============================================================================
  // CALL DETECTION & AUTO-REFRESH
  // ============================================================================

  const setupCallDetection = () => {
    try {
      callDetector.current = new CallDetectorManager(
        (event, phoneNumber) => {
          console.log("📞 Call Event:", event, phoneNumber);

          if (event === "Disconnected") {
            console.log("📴 Call disconnected, scheduling refresh...");
            setLastCallTime(new Date());

            if (refreshTimer.current) {
              clearTimeout(refreshTimer.current);
            }

            refreshTimer.current = setTimeout(() => {
              if (selectedPath && autoRefreshEnabled) {
                console.log("🔄 Auto-refreshing after call disconnect...");
                refreshAfterCall();
              }
            }, 5000);
          }
        },
        false,
        () => console.log("✅ Call detector started"),
        (error) => console.error("❌ Call detector error:", error)
      );
    } catch (error) {
      console.error("❌ Error setting up call detection:", error);
    }
  };

  const cleanupCallDetection = () => {
    if (callDetector.current) {
      try {
        callDetector.current.dispose();
        console.log("🗑️ Call detector disposed");
      } catch (error) {
        console.error("❌ Error disposing call detector:", error);
      }
    }
  };

  const setupAppStateListener = () => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  };

  const handleAppStateChange = async (nextAppState) => {
    console.log("🔄 App state changed:", appState.current, "->", nextAppState);

    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      console.log("✅ App has come to foreground");

      if (lastCallTime) {
        const timeSinceCall = Date.now() - lastCallTime.getTime();
        if (timeSinceCall < 60000) {
          console.log("📞 Recent call detected, refreshing...");
          await refreshAfterCall();
          return;
        }
      }

      if (selectedPath && autoRefreshEnabled) {
        console.log("🔄 Auto-refreshing on app resume...");
        await refreshAfterCall();
      }
    }

    appState.current = nextAppState;
  };

  const handleNewRecordingsDetected = (count) => {
    Alert.alert(
      "🎙️ New Recording Detected",
      `${count} new recording${count > 1 ? "s" : ""} found!${
        autoSyncEnabled ? "\n\nAuto-sync to database?" : ""
      }`,
      autoSyncEnabled
        ? [
            {
              text: "Later",
              style: "cancel",
              onPress: () => setNewRecordingsCount(0),
            },
            {
              text: "Sync Now",
              onPress: () => {
                setNewRecordingsCount(0);
                syncNewRecordings();
              },
            },
          ]
        : [
            {
              text: "OK",
              onPress: () => setNewRecordingsCount(0),
            },
          ]
    );
  };

  const refreshAfterCall = async () => {
    try {
      if (isRefreshing) {
        console.log("⏭️ Refresh already in progress, skipping...");
        return;
      }

      setIsRefreshing(true);
      console.log("🔄 Starting refresh...");

      const syncedSet = await loadSyncedFilesList();
      await loadDirectory(selectedPath, syncedSet);

      console.log("✅ Refresh complete");
    } catch (error) {
      console.error("❌ Error refreshing after call:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ============================================================================
  // STORAGE MANAGEMENT
  // ============================================================================

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
      console.error("Error loading synced files:", error);
      return new Set();
    }
  };

  const saveSyncedFilesList = async (syncedSet) => {
    try {
      const syncedArray = Array.from(syncedSet);
      await AsyncStorage.setItem(
        STORAGE_KEYS.SYNCED_FILES,
        JSON.stringify(syncedArray)
      );
      console.log("Saved synced files:", syncedArray.length);
    } catch (error) {
      console.error("Error saving synced files:", error);
    }
  };

  const loadSavedSettings = async () => {
    try {
      const [
        savedPath,
        savedApiUrl,
        savedLastSync,
        autoRefreshPref,
        autoSyncPref,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SAVED_PATH),
        AsyncStorage.getItem(STORAGE_KEYS.API_URL),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_REFRESH),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_SYNC),
      ]);

      if (savedApiUrl) setApiUrl(savedApiUrl);
      if (savedLastSync) setLastSync(new Date(parseInt(savedLastSync)));
      if (autoRefreshPref !== null) {
        setAutoRefreshEnabled(JSON.parse(autoRefreshPref));
      }
      if (autoSyncPref !== null) {
        setAutoSyncEnabled(JSON.parse(autoSyncPref));
      }

      const syncedSet = await loadSyncedFilesList();

      if (savedPath) {
        setSelectedPath(savedPath);
        await loadDirectory(savedPath, syncedSet);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveApiUrl = async (url) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.API_URL, url);
      setApiUrl(url);
      Alert.alert("✓ Success", "API URL saved successfully");
    } catch (error) {
      Alert.alert("✗ Error", "Failed to save API URL");
    }
  };

  const toggleAutoRefresh = async () => {
    const newValue = !autoRefreshEnabled;
    setAutoRefreshEnabled(newValue);
    await AsyncStorage.setItem(
      STORAGE_KEYS.AUTO_REFRESH,
      JSON.stringify(newValue)
    );
    Alert.alert(
      "Auto-Refresh",
      `Auto-refresh has been ${newValue ? "enabled" : "disabled"}`
    );
  };

  const toggleAutoSync = async () => {
    const newValue = !autoSyncEnabled;
    setAutoSyncEnabled(newValue);
    await AsyncStorage.setItem(
      STORAGE_KEYS.AUTO_SYNC,
      JSON.stringify(newValue)
    );
    Alert.alert(
      "Auto-Sync",
      `Auto-sync has been ${newValue ? "enabled" : "disabled"}`
    );
  };

  const clearSyncedData = async () => {
    Alert.alert(
      "Clear Sync History",
      "This will reset all sync records. All recordings will be marked as unsynced. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEYS.SYNCED_FILES);
              await AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
              setSyncedFilesList(new Set());
              setLastSync(null);
              setMatchingResults({});

              setFiles((prevFiles) =>
                prevFiles.map((f) => ({
                  ...f,
                  synced: false,
                  matchedToCallLog: false,
                  callLogId: null,
                }))
              );

              Alert.alert("✓ Success", "Sync history cleared");
            } catch (error) {
              Alert.alert("✗ Error", "Failed to clear sync history");
            }
          },
        },
      ]
    );
  };

  const clearSavedPath = async () => {
    Alert.alert("Clear Saved Path", "Remove the saved directory path?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_PATH);
            setSelectedPath("");
            setFiles([]);
            previousFileCount.current = 0;
            Alert.alert("✓ Success", "Saved path cleared");
          } catch (error) {
            Alert.alert("✗ Error", "Failed to clear path");
          }
        },
      },
    ]);
  };

  // ============================================================================
  // CALL LOG MATCHING
  // ============================================================================

  const fetchCallLogs = async () => {
    if (!userId) {
      console.log("No user ID, skipping call log fetch");
      return [];
    }

    try {
      const response = await axios.post(
        `${apiUrl}${API_CONFIG.ADMIN_API}?task=get_call_logs_with_recordings`,
        {
          user_id: parseInt(userId),
          limit: 200,
          offset: 0,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "success") {
        setCallLogs(response.data.data);
        console.log("📋 Fetched call logs:", response.data.data.length);
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error("Error fetching call logs:", error);
      return [];
    }
  };

  const findMatchingCallLog = (recording, callLogsData) => {
    if (!recording.timestamp || !recording.rawPhoneNumber) {
      return null;
    }

    const cleanPhone = recording.rawPhoneNumber.replace(/[^0-9]/g, "");
    const recordingTime = new Date(recording.timestamp);

    // Find call logs within ±2 minutes
    const matches = callLogsData.filter((log) => {
      // Check if already has recording
      if (log.recordingurl && log.recordingurl !== "") {
        return false;
      }

      // Check phone number match
      const logPhone = (log.phonenumber || "").replace(/[^0-9]/g, "");
      const customerPhone = (log.customerid || "").replace(/[^0-9]/g, "");

      // Handle country code variations
      const cleanPhoneLast10 = cleanPhone.slice(-10);
      const logPhoneLast10 = logPhone.slice(-10);
      const customerPhoneLast10 = customerPhone.slice(-10);

      const phoneMatches =
        cleanPhoneLast10 === logPhoneLast10 ||
        cleanPhoneLast10 === customerPhoneLast10 ||
        logPhone.includes(cleanPhone) ||
        cleanPhone.includes(logPhone) ||
        customerPhone.includes(cleanPhone) ||
        cleanPhone.includes(customerPhone);

      if (!phoneMatches) return false;

      // Check time match (within 2 minutes)
      const logTime = new Date(log.starttime);
      const timeDiff = Math.abs(recordingTime - logTime) / 1000; // seconds

      return timeDiff <= 120; // 2 minutes
    });

    if (matches.length > 0) {
      // Return closest match
      matches.sort((a, b) => {
        const aTime = new Date(a.starttime);
        const bTime = new Date(b.starttime);
        const aDiff = Math.abs(recordingTime - aTime);
        const bDiff = Math.abs(recordingTime - bTime);
        return aDiff - bDiff;
      });

      return matches[0];
    }

    return null;
  };

  // ============================================================================
  // FILE PARSING & FORMATTING
  // ============================================================================

  const getFileIdentifier = (file) => {
    return `${file.fileName}_${file.size}_${file.timestamp}`;
  };

  const parseCallRecording = (filename) => {
    try {
      const nameWithoutExt = filename.replace(
        /\.(mp3|m4a|wav|amr|3gp|aac)$/i,
        ""
      );

      let phoneNumber = "";
      let rawPhoneNumber = "";
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
      let timeString = "";
      let dateString = "";
      let timestamp = "";

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

        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        dateString = `${day} ${monthNames[parseInt(month) - 1]} ${year}`;

        const hourNum = parseInt(hour);
        const ampm = hourNum >= 12 ? "PM" : "AM";
        const hour12 = hourNum % 12 || 12;
        timeString = `${hour12
          .toString()
          .padStart(2, "0")}:${minute}:${second} ${ampm}`;
        timestamp = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
      }

      let callType = "Recorded Call";
      const lowerName = filename.toLowerCase();

      if (lowerName.includes("incoming") || lowerName.includes("_in_")) {
        callType = "Incoming";
      } else if (
        lowerName.includes("outgoing") ||
        lowerName.includes("_out_")
      ) {
        callType = "Outgoing";
      } else if (lowerName.includes("missed")) {
        callType = "Missed";
      }

      return {
        phoneNumber: phoneNumber || "Unknown",
        rawPhoneNumber,
        date: dateString || "Unknown Date",
        time: timeString || "Unknown Time",
        timestamp,
        dateTime: dateObj,
        callType,
        fileName: filename,
      };
    } catch (error) {
      return {
        phoneNumber: "Unknown",
        rawPhoneNumber: "",
        date: "N/A",
        time: "N/A",
        timestamp: "",
        dateTime: null,
        callType: "Unknown",
        fileName: filename,
      };
    }
  };

  const formatPhoneNumber = (number) => {
    if (!number) return "Unknown";

    if (number.startsWith("0091")) {
      const main = number.substring(4);
      return main.length === 10
        ? `+91 ${main.substring(0, 5)} ${main.substring(5)}`
        : `+91 ${main}`;
    } else if (number.startsWith("91") && number.length === 12) {
      const main = number.substring(2);
      return `+91 ${main.substring(0, 5)} ${main.substring(5)}`;
    } else if (number.length === 10) {
      return `${number.substring(0, 5)} ${number.substring(5)}`;
    }

    return number;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (millis) => {
    if (!millis || millis === 0) return "0:00";
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

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
      console.error("Error getting duration:", error);
      return 0;
    }
  };

  // ============================================================================
  // DIRECTORY & FILE OPERATIONS
  // ============================================================================

  const loadDirectory = async (directoryUri, syncedSet = null) => {
    try {
      setLoading(true);
      const currentSyncedSet = syncedSet || (await loadSyncedFilesList());

      const fileUris =
        await FileSystem.StorageAccessFramework.readDirectoryAsync(
          directoryUri
        );

      const fileDetails = await Promise.all(
        fileUris.map(async (fileUri) => {
          try {
            const info = await FileSystem.getInfoAsync(fileUri, { size: true });
            const fileName = decodeURIComponent(
              fileUri.split("/").pop().split("%2F").pop()
            );

            if (/\.(mp3|m4a|wav|amr|3gp|aac)$/i.test(fileName)) {
              const callInfo = parseCallRecording(fileName);

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
                matchedToCallLog: false,
                callLogId: null,
              };

              const fileId = getFileIdentifier(fileData);
              fileData.synced = currentSyncedSet.has(fileId);

              // Check if matched in previous results
              if (matchingResults[fileName]) {
                fileData.matchedToCallLog = matchingResults[fileName].matched;
                fileData.callLogId = matchingResults[fileName].callLogId;
              }

              return fileData;
            }
            return null;
          } catch (err) {
            console.error("File error:", err);
            return null;
          }
        })
      );

      const validFiles = fileDetails
        .filter((f) => f !== null && f.exists)
        .sort((a, b) => {
          if (a.dateTime && b.dateTime) return b.dateTime - a.dateTime;
          return 0;
        });

      setFiles(validFiles);

      // Update stats
      updateSyncStats(validFiles);

      if (validFiles.length === 0 && !isRefreshing) {
        Alert.alert(
          "No Recordings",
          "No audio files found in selected directory"
        );
      }
    } catch (error) {
      console.error("Load error:", error);
      if (!isRefreshing) {
        Alert.alert("Error", `Failed to load directory: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateSyncStats = (filesList) => {
    const matched = filesList.filter((f) => f.matchedToCallLog).length;
    const synced = filesList.filter((f) => f.synced).length;

    setSyncStats({
      total: filesList.length,
      matched: matched,
      unmatched: synced - matched,
    });
  };

  const selectDirectory = async () => {
    try {
      setLoading(true);
      const permissions =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (!permissions.granted) {
        Alert.alert("Permission Denied", "Directory access required");
        return;
      }

      const directoryUri = permissions.directoryUri;
      setSelectedPath(directoryUri);
      await loadDirectory(directoryUri);

      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_PATH, directoryUri);
      Alert.alert("✓ Success", "Directory loaded and saved successfully");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // SYNC OPERATIONS
  // ============================================================================

  const uploadFileToServer = async (file) => {
    try {
      // Fetch latest call logs
      const callLogsData =
        callLogs.length > 0 ? callLogs : await fetchCallLogs();

      // Find matching call log
      const matchingLog = findMatchingCallLog(file, callLogsData);

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
        user_id: userId ? parseInt(userId) : null,
      };

      const response = await fetch(`${apiUrl}${API_CONFIG.UPLOAD_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uploadData),
      });

      const result = await response.json();

      if (result.success) {
        // Store matching result
        if (result.matched && result.call_log_id) {
          setMatchingResults((prev) => ({
            ...prev,
            [file.fileName]: {
              matched: true,
              callLogId: result.call_log_id,
              recordingUrl: result.file_url,
            },
          }));
        }

        return {
          success: true,
          data: result,
          matched: result.matched || false,
          callLogId: result.call_log_id || null,
        };
      } else {
        return { success: false, error: result.message || "Upload failed" };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const syncAllFiles = async () => {
    const unsyncedFiles = files.filter((f) => !f.synced);

    if (unsyncedFiles.length === 0) {
      Alert.alert("All Synced", "All recordings are already synced");
      return;
    }

    Alert.alert(
      "Sync Recordings",
      `Upload ${unsyncedFiles.length} recording${
        unsyncedFiles.length > 1 ? "s" : ""
      } and link to call logs?\n\n${
        files.filter((f) => f.synced).length
      } already synced`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upload & Link",
          onPress: async () => {
            setSyncing(true);
            setSyncProgress(0);

            let successCount = 0;
            let failCount = 0;
            let matchedCount = 0;

            const updatedSyncedSet = new Set(syncedFilesList);

            // Fetch call logs before starting
            await fetchCallLogs();

            for (let i = 0; i < unsyncedFiles.length; i++) {
              const file = unsyncedFiles[i];
              setCurrentSyncFile(file.phoneNumber);

              const result = await uploadFileToServer(file);

              if (result.success) {
                successCount++;
                if (result.matched) {
                  matchedCount++;
                }

                const fileId = getFileIdentifier(file);
                updatedSyncedSet.add(fileId);

                setFiles((prevFiles) =>
                  prevFiles.map((f) =>
                    f.uri === file.uri
                      ? {
                          ...f,
                          synced: true,
                          matchedToCallLog: result.matched,
                          callLogId: result.callLogId,
                        }
                      : f
                  )
                );
              } else {
                failCount++;
                console.error(
                  "Upload failed for:",
                  file.fileName,
                  result.error
                );
              }

              setSyncProgress(((i + 1) / unsyncedFiles.length) * 100);
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            setSyncedFilesList(updatedSyncedSet);
            await saveSyncedFilesList(updatedSyncedSet);

            setSyncing(false);
            setSyncProgress(0);
            setCurrentSyncFile("");

            const now = Date.now();
            await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, now.toString());
            setLastSync(new Date(now));

            await loadDirectory(selectedPath);

            Alert.alert(
              "Sync Complete",
              `✓ Uploaded: ${successCount}\n🔗 Linked to Call Logs: ${matchedCount}\n✗ Failed: ${failCount}\n\nTotal synced: ${updatedSyncedSet.size}/${files.length}`,
              [{ text: "OK" }]
            );
          },
        },
      ]
    );
  };

  const syncNewRecordings = async () => {
    const newFiles = files.filter((f) => !f.synced);

    if (newFiles.length === 0) {
      Alert.alert("No New Recordings", "All recordings are already synced");
      return;
    }

    setSyncing(true);
    setSyncProgress(0);
    setCurrentSyncFile("Syncing new recordings...");

    let successCount = 0;
    let matchedCount = 0;
    const updatedSyncedSet = new Set(syncedFilesList);

    // Fetch latest call logs
    await fetchCallLogs();

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      setCurrentSyncFile(file.phoneNumber);

      const result = await uploadFileToServer(file);

      if (result.success) {
        successCount++;
        if (result.matched) {
          matchedCount++;
        }

        const fileId = getFileIdentifier(file);
        updatedSyncedSet.add(fileId);

        setFiles((prevFiles) =>
          prevFiles.map((f) =>
            f.uri === file.uri
              ? {
                  ...f,
                  synced: true,
                  matchedToCallLog: result.matched,
                  callLogId: result.callLogId,
                }
              : f
          )
        );
      }

      setSyncProgress(((i + 1) / newFiles.length) * 100);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setSyncedFilesList(updatedSyncedSet);
    await saveSyncedFilesList(updatedSyncedSet);

    setSyncing(false);
    setSyncProgress(0);
    setCurrentSyncFile("");

    const now = Date.now();
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, now.toString());
    setLastSync(new Date(now));

    await loadDirectory(selectedPath);

    Alert.alert(
      "Auto-Sync Complete",
      `✓ Synced: ${successCount}\n🔗 Linked to Call Logs: ${matchedCount}`,
      [{ text: "OK" }]
    );
  };

  // ============================================================================
  // AUDIO PLAYBACK
  // ============================================================================

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

  const playAudio = async (file) => {
    try {
      setIsLoadingAudio(true);

      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
        setPlayingUri(null);
        setPlaybackPosition(0);
        setPlaybackDuration(0);
      }

      if (playingUri === file.uri) {
        setIsLoadingAudio(false);
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: file.uri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setPlayingUri(file.uri);
      setIsLoadingAudio(false);
    } catch (error) {
      console.error("Playback error:", error);
      setIsLoadingAudio(false);
      Alert.alert("Playback Error", "Could not play this recording");
    }
  };

  const pauseAudio = async () => {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  };

  const resumeAudio = async () => {
    if (sound) {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  // ============================================================================
  // UTILITIES
  // ============================================================================

  const getCallTypeColor = (callType) => {
    switch (callType.toLowerCase()) {
      case "incoming":
        return COLORS.success;
      case "outgoing":
        return COLORS.info;
      case "missed":
        return COLORS.danger;
      default:
        return COLORS.text.secondary;
    }
  };

  const filteredFiles = files.filter((file) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      file.phoneNumber.toLowerCase().includes(query) ||
      file.rawPhoneNumber.includes(query) ||
      file.date.toLowerCase().includes(query) ||
      file.callType.toLowerCase().includes(query)
    );
  });

  // ============================================================================
  // CUSTOM COMPONENTS
  // ============================================================================

  const CustomProgressBar = ({ progress }) => (
    <View style={styles.customProgressBar}>
      <View style={[styles.customProgressFill, { width: `${progress}%` }]} />
    </View>
  );

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

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
        <View
          style={[
            styles.callTypeIndicator,
            { backgroundColor: getCallTypeColor(item.callType) },
          ]}
        />

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
              {item.matchedToCallLog && (
                <View
                  style={[styles.syncedBadge, { backgroundColor: COLORS.info }]}
                >
                  <Text style={styles.syncedBadgeText}>🔗</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.callCardMeta}>
            <View
              style={[
                styles.callTypePill,
                { backgroundColor: getCallTypeColor(item.callType) + "15" },
              ]}
            >
              <Text
                style={[
                  styles.callTypePillText,
                  { color: getCallTypeColor(item.callType) },
                ]}
              >
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
            <Text style={styles.callFooterText}>
              {formatFileSize(item.size)}
            </Text>
          </View>

          {isCurrentlyPlaying && (
            <View style={styles.miniProgressContainer}>
              <View style={styles.miniProgressBar}>
                <View
                  style={[
                    styles.miniProgressFill,
                    {
                      width: `${
                        playbackDuration > 0
                          ? (playbackPosition / playbackDuration) * 100
                          : 0
                      }%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

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
              {isCurrentlyPlaying && isPlaying ? "⏸" : "▶"}
            </Text>
          )}
        </Pressable>
      </Pressable>
    );
  };

  // ============================================================================
  // MODALS
  // ============================================================================

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
            <Pressable
              onPress={() => setSettingsModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            {/* Auto Features */}
            <View style={styles.settingCard}>
              <Text style={styles.settingCardTitle}>⚡ Automation</Text>

              {/* Auto-Refresh */}
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Auto-Refresh</Text>
                  <Text style={styles.settingDescription}>
                    Automatically refresh recordings after calls
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.toggleButton,
                    autoRefreshEnabled && styles.toggleButtonActive,
                  ]}
                  onPress={toggleAutoRefresh}
                >
                  <View
                    style={[
                      styles.toggleCircle,
                      autoRefreshEnabled && styles.toggleCircleActive,
                    ]}
                  />
                </Pressable>
              </View>

              {/* Auto-Sync */}
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Auto-Sync</Text>
                  <Text style={styles.settingDescription}>
                    Auto-upload new recordings to server
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.toggleButton,
                    autoSyncEnabled && styles.toggleButtonActive,
                  ]}
                  onPress={toggleAutoSync}
                >
                  <View
                    style={[
                      styles.toggleCircle,
                      autoSyncEnabled && styles.toggleCircleActive,
                    ]}
                  />
                </Pressable>
              </View>

              {lastCallTime && (
                <View style={styles.lastCallInfo}>
                  <Text style={styles.lastCallLabel}>Last call detected:</Text>
                  <Text style={styles.lastCallTime}>
                    {lastCallTime.toLocaleTimeString()} -{" "}
                    {lastCallTime.toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>

            {/* Directory Management */}
            <View style={styles.settingCard}>
              <Text style={styles.settingCardTitle}>
                📁 Directory Management
              </Text>

              {selectedPath ? (
                <>
                  <Text style={styles.settingLabel}>Current Directory</Text>
                  <View style={styles.pathDisplay}>
                    <Text style={styles.pathDisplayText} numberOfLines={2}>
                      {decodeURIComponent(
                        selectedPath.split("/").pop().replace(/%2F/g, "/")
                      )}
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
                      <Text style={styles.settingButtonText}>Change</Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.settingButton,
                        styles.dangerButton,
                        styles.flexButton,
                      ]}
                      onPress={clearSavedPath}
                    >
                      <Text style={styles.settingButtonText}>Clear</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.settingDescription}>
                    No directory selected. Browse to select your call recordings
                    folder.
                  </Text>
                  <Pressable
                    style={styles.settingButton}
                    onPress={async () => {
                      setSettingsModalVisible(false);
                      await selectDirectory();
                    }}
                  >
                    <Text style={styles.settingButtonText}>
                      📁 Browse Directory
                    </Text>
                  </Pressable>
                </>
              )}
            </View>

            {/* API Configuration */}
            <View style={styles.settingCard}>
              <Text style={styles.settingCardTitle}>
                🌐 Server Configuration
              </Text>
              <Text style={styles.settingLabel}>User ID</Text>
              <View style={styles.pathDisplay}>
                <Text style={styles.pathDisplayText}>
                  {userId || "Not logged in"}
                </Text>
              </View>

              <Text style={styles.settingLabel}>API URL</Text>
              <TextInput
                style={styles.settingInput}
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="https://your-server.com"
                placeholderTextColor={COLORS.text.tertiary}
                autoCapitalize="none"
              />
              <Pressable
                style={styles.settingButton}
                onPress={() => saveApiUrl(apiUrl)}
              >
                <Text style={styles.settingButtonText}>Save API URL</Text>
              </Pressable>
            </View>

            {/* Statistics */}
            <View style={styles.settingCard}>
              <Text style={styles.settingCardTitle}>📊 Statistics</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Recordings</Text>
                <Text style={styles.statValue}>{files.length}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Synced</Text>
                <Text style={[styles.statValue, { color: COLORS.success }]}>
                  {files.filter((f) => f.synced).length}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Linked to Call Logs</Text>
                <Text style={[styles.statValue, { color: COLORS.info }]}>
                  {syncStats.matched}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Pending</Text>
                <Text style={[styles.statValue, { color: COLORS.warning }]}>
                  {files.filter((f) => !f.synced).length}
                </Text>
              </View>
              {lastSync && (
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Last Sync</Text>
                  <Text style={styles.statValue}>
                    {lastSync.toLocaleDateString()}{" "}
                    {lastSync.toLocaleTimeString()}
                  </Text>
                </View>
              )}
            </View>

            {/* Danger Zone */}
            <View style={styles.settingCard}>
              <Text style={styles.settingCardTitle}>⚠️ Danger Zone</Text>
              <Text style={styles.settingDescription}>
                Clear sync history will mark all recordings as unsynced
              </Text>
              <Pressable
                style={[styles.settingButton, styles.dangerButton]}
                onPress={clearSyncedData}
              >
                <Text style={styles.settingButtonText}>Clear Sync History</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

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
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Contact Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone Number</Text>
                  <Text style={styles.detailValue}>
                    {selectedCall.phoneNumber}
                  </Text>
                </View>
                {selectedCall.rawPhoneNumber && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Raw Number</Text>
                    <Text style={styles.detailValueSmall}>
                      {selectedCall.rawPhoneNumber}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Call Type</Text>
                  <View
                    style={[
                      styles.callTypePill,
                      {
                        backgroundColor:
                          getCallTypeColor(selectedCall.callType) + "15",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.callTypePillText,
                        { color: getCallTypeColor(selectedCall.callType) },
                      ]}
                    >
                      {selectedCall.callType}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>
                  Recording Information
                </Text>
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
                  <Text style={styles.detailValue}>
                    {selectedCall.duration}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>File Size</Text>
                  <Text style={styles.detailValue}>
                    {formatFileSize(selectedCall.size)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Sync Status</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      {
                        color: selectedCall.synced
                          ? COLORS.success
                          : COLORS.danger,
                      },
                    ]}
                  >
                    {selectedCall.synced ? "✓ Synced" : "✗ Not Synced"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Call Log Match</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      {
                        color: selectedCall.matchedToCallLog
                          ? COLORS.info
                          : COLORS.text.secondary,
                      },
                    ]}
                  >
                    {selectedCall.matchedToCallLog
                      ? "🔗 Linked"
                      : "✗ Not Linked"}
                  </Text>
                </View>
                {selectedCall.callLogId && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Call Log ID</Text>
                    <Text style={styles.detailValue}>
                      #{selectedCall.callLogId}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>File Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Filename</Text>
                </View>
                <Text style={styles.filenameText}>{selectedCall.fileName}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Call Recordings</Text>
            <Text style={styles.headerSubtitle}>
              {selectedPath
                ? `${files.length} recordings`
                : "No directory selected"}
              {autoRefreshEnabled && " • Auto-refresh"}
              {autoSyncEnabled && " • Auto-sync"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {newRecordingsCount > 0 && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>+{newRecordingsCount}</Text>
              </View>
            )}
            {isRefreshing && (
              <ActivityIndicator size="small" color={COLORS.text.inverse} />
            )}
            <Pressable
              onPress={() => setSettingsModalVisible(true)}
              style={styles.headerButton}
            >
              <Text style={styles.headerButtonText}>⚙️</Text>
            </Pressable>
          </View>
        </View>

        {/* Action Buttons */}
        {selectedPath && (
          <View style={styles.actionContainer}>
            <View style={styles.actionRow}>
              <Pressable
                style={[
                  styles.secondaryButton,
                  styles.flexButton,
                  (loading || syncing) && styles.buttonDisabled,
                ]}
                onPress={() => loadDirectory(selectedPath)}
                disabled={loading || syncing}
              >
                <Text style={styles.secondaryButtonText}>
                  {loading ? "⏳ Loading..." : "🔄 Refresh"}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.accentButton,
                  styles.flexButton,
                  (files.length === 0 || syncing) && styles.buttonDisabled,
                ]}
                onPress={syncAllFiles}
                disabled={files.length === 0 || syncing}
              >
                <Text style={styles.accentButtonText}>
                  {syncing
                    ? "⏳ Syncing"
                    : `☁️ Sync (${files.filter((f) => !f.synced).length})`}
                </Text>
              </Pressable>
            </View>

            {/* Sync Stats */}
            {files.length > 0 && (
              <View style={styles.syncStatsRow}>
                <View style={styles.syncStat}>
                  <Text style={styles.syncStatValue}>{syncStats.matched}</Text>
                  <Text style={styles.syncStatLabel}>Linked</Text>
                </View>
                <View style={styles.syncStat}>
                  <Text
                    style={[styles.syncStatValue, { color: COLORS.success }]}
                  >
                    {files.filter((f) => f.synced).length}
                  </Text>
                  <Text style={styles.syncStatLabel}>Synced</Text>
                </View>
                <View style={styles.syncStat}>
                  <Text
                    style={[styles.syncStatValue, { color: COLORS.warning }]}
                  >
                    {files.filter((f) => !f.synced).length}
                  </Text>
                  <Text style={styles.syncStatLabel}>Pending</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Sync Progress */}
        {syncing && (
          <View style={styles.syncProgressContainer}>
            <View style={styles.syncProgressHeader}>
              <Text style={styles.syncProgressText}>
                Uploading & linking to call logs...
              </Text>
              <Text style={styles.syncProgressPercent}>
                {Math.round(syncProgress)}%
              </Text>
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
              <Pressable onPress={() => setSearchQuery("")}>
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
                {filteredFiles.length} Recording
                {filteredFiles.length !== 1 ? "s" : ""}
              </Text>
              {files.filter((f) => f.synced).length > 0 && (
                <Text style={styles.listHeaderSynced}>
                  {files.filter((f) => f.matchedToCallLog).length} linked
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

export default CallRecordingApp;
// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    fontWeight: "700",
    color: COLORS.text.inverse,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.text.inverse,
    opacity: 0.8,
    marginTop: 2,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerButtonText: {
    fontSize: 20,
  },
  newBadge: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  newBadgeText: {
    color: COLORS.text.inverse,
    fontSize: 12,
    fontWeight: "700",
  },
  actionContainer: {
    padding: 16,
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  syncStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  syncStat: {
    alignItems: "center",
  },
  syncStatValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.info,
  },
  syncStatLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  flexButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: COLORS.text.inverse,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border.medium,
  },
  secondaryButtonText: {
    color: COLORS.text.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  accentButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  accentButtonText: {
    color: COLORS.text.inverse,
    fontSize: 15,
    fontWeight: "600",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  syncProgressText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  syncProgressPercent: {
    fontSize: 14,
    fontWeight: "700",
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
    overflow: "hidden",
  },
  customProgressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
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
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.surfaceAlt,
  },
  listHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  listHeaderSynced: {
    fontSize: 13,
    color: COLORS.info,
    fontWeight: "600",
  },
  listContent: {
    padding: 12,
  },
  callCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  callCardPressed: {
    opacity: 0.7,
  },
  callCardPlaying: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primary + "05",
  },
  callTypeIndicator: {
    width: 4,
  },
  callCardContent: {
    flex: 1,
    padding: 14,
  },
  callCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  callPhoneNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text.primary,
    flex: 1,
  },
  callCardBadges: {
    flexDirection: "row",
    gap: 6,
  },
  syncedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.success,
    justifyContent: "center",
    alignItems: "center",
  },
  syncedBadgeText: {
    color: COLORS.text.inverse,
    fontSize: 12,
    fontWeight: "700",
  },
  callCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  callTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  callTypePillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  callMetaText: {
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  callCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
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
    overflow: "hidden",
  },
  miniProgressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  playButton: {
    width: 48,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primary + "10",
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border.light,
  },
  playButtonText: {
    fontSize: 20,
    color: COLORS.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  centerText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text.secondary,
    textAlign: "center",
    marginTop: 12,
  },
  centerSubtext: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    textAlign: "center",
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 20,
    color: COLORS.text.secondary,
  },
  modalBody: {
    padding: 20,
  },
  settingCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  settingCardTitle: {
    fontSize: 16,
    fontWeight: "700",
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
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
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
    alignItems: "center",
  },
  settingButtonText: {
    color: COLORS.text.inverse,
    fontSize: 15,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
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
  toggleButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border.medium,
    padding: 2,
    justifyContent: "center",
  },
  toggleButtonActive: {
    backgroundColor: COLORS.success,
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleCircleActive: {
    transform: [{ translateX: 22 }],
  },
  lastCallInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
  },
  lastCallLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  lastCallTime: {
    fontSize: 13,
    color: COLORS.text.primary,
    fontWeight: "600",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    fontWeight: "700",
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
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  detailValueSmall: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text.primary,
    maxWidth: "60%",
  },
  filenameText: {
    fontSize: 13,
    color: COLORS.text.primary,
    marginTop: 8,
  },
});
