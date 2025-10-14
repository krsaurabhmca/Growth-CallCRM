// import {
//   Ionicons,
//   MaterialCommunityIcons,
//   MaterialIcons,
// } from "@expo/vector-icons";
// import { format, isThisWeek, isThisYear, isToday, isYesterday } from "date-fns";
// import React, { useEffect, useState } from "react";
// import {
//   ActivityIndicator,
//   Image,
//   Linking,
//   Platform,
//   SectionList,
//   StatusBar,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from "react-native";

// import CallLogs from "react-native-call-log";

// export default function CallLogScreen() {
//   const [callLogs, setCallLogs] = useState([]);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [filteredLogs, setFilteredLogs] = useState([]);
//   const [activeFilter, setActiveFilter] = useState("all");
//   const [loading, setLoading] = useState(true);
//   const [showPermissionButton, setShowPermissionButton] = useState(false);

//   // Load mock data on initial render with no permissions check
//   useEffect(() => {
//     // Start with mock data without any permission checks
//     const mockData = generateMockCallLogs();
//     setCallLogs(mockData);
//     setFilteredLogs(mockData);
//     setLoading(false);

//     if (Platform.OS === "android") {
//       setShowPermissionButton(true);
//     }
//   }, []);

//   // Inside your component:
//   const loadRealCallLogs = async () => {
//     try {
//       // This must be called after permissions are granted
//       const logs = await CallLogs.loadAll();
//       console.log("Real call logs:", logs);

//       // Process the logs into your app format
//       const processedLogs = logs.map((log) => ({
//         id: log.callId || log.timestamp.toString(),
//         phoneNumber: log.phoneNumber,
//         name: log.name || "Unknown",
//         callType:
//           log.type === "INCOMING"
//             ? "incoming"
//             : log.type === "OUTGOING"
//             ? "outgoing"
//             : "missed",
//         duration: formatDuration(log.duration),
//         timestamp: log.timestamp,
//         missed: log.type === "MISSED",
//         avatar: null,
//       }));

//       setCallLogs(processedLogs);
//     } catch (error) {
//       console.error("Error fetching real logs:", error);
//     }
//   };

//   // Format duration from seconds to MM:SS
//   const formatDuration = (seconds) => {
//     if (!seconds || seconds === 0) return "0:00";
//     const minutes = Math.floor(seconds / 60);
//     const remainingSeconds = seconds % 60;
//     return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
//   };

//   // Separate function to request permissions that will only be called
//   // when a button is pressed, ensuring we have an attached activity
//   const handleRequestPermissions = async () => {
//     if (Platform.OS !== "android") return;

//     // Only request permissions in response to user action
//     const granted = await PermissionsAndroid.request(
//       PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
//       {
//         title: "Call Log Permission",
//         message:
//           "This app needs access to your call log to display your call history.",
//         buttonNeutral: "Ask Me Later",
//         buttonNegative: "Cancel",
//         buttonPositive: "OK",
//       }
//     );

//     if (granted === PermissionsAndroid.RESULTS.GRANTED) {
//       // Now we can load the real call logs
//       loadRealCallLogs();
//     }
//   };

//   // Filter call logs based on search query and active filter
//   useEffect(() => {
//     let filtered = callLogs;

//     // Apply call type filter
//     if (activeFilter !== "all") {
//       if (activeFilter === "missed") {
//         filtered = filtered.filter((log) => log.missed);
//       } else {
//         filtered = filtered.filter(
//           (log) => log.callType === activeFilter && !log.missed
//         );
//       }
//     }

//     // Apply search query filter
//     if (searchQuery) {
//       const query = searchQuery.toLowerCase();
//       filtered = filtered.filter(
//         (log) =>
//           (log.name && log.name.toLowerCase().includes(query)) ||
//           (log.phoneNumber && log.phoneNumber.toLowerCase().includes(query))
//       );
//     }

//     // Sort by timestamp (newest first)
//     filtered = [...filtered].sort((a, b) => b.timestamp - a.timestamp);

//     setFilteredLogs(filtered);
//   }, [callLogs, searchQuery, activeFilter]);

//   // Group call logs by date
//   const groupedLogs = () => {
//     const sections = {};

//     filteredLogs.forEach((log) => {
//       const date = new Date(log.timestamp);
//       let title = "";

//       if (isToday(date)) {
//         title = "Today";
//       } else if (isYesterday(date)) {
//         title = "Yesterday";
//       } else if (isThisWeek(date)) {
//         title = format(date, "EEEE"); // Day name (e.g., Monday)
//       } else if (isThisYear(date)) {
//         title = format(date, "MMMM d"); // Month and day (e.g., January 15)
//       } else {
//         title = format(date, "MMMM d, yyyy"); // Full date (e.g., January 15, 2023)
//       }

//       if (!sections[title]) {
//         sections[title] = [];
//       }

//       sections[title].push(log);
//     });

//     return Object.keys(sections).map((title) => ({
//       title,
//       data: sections[title],
//     }));
//   };

//   // Format call time
//   const formatCallTime = (timestamp) => {
//     const date = new Date(timestamp);
//     return format(date, "h:mm a"); // e.g., 2:30 PM
//   };

//   // Handle call back
//   const handleCallBack = (phoneNumber) => {
//     Linking.openURL(`tel:${phoneNumber}`);
//   };

//   // Handle message
//   const handleMessage = (phoneNumber) => {
//     Linking.openURL(`sms:${phoneNumber}`);
//   };

//   // Handle delete call log
//   const handleDeleteLog = (id) => {
//     setCallLogs(callLogs.filter((log) => log.id !== id));
//   };

//   // Generate mock call logs
//   const generateMockCallLogs = () => {
//     const now = new Date();

//     // Create timestamps for different days
//     const todayTimestamp = now.getTime();
//     const yesterdayTimestamp = now.getTime() - 86400000; // 24 hours ago
//     const twoDaysAgoTimestamp = now.getTime() - 172800000; // 48 hours ago
//     const lastWeekTimestamp = now.getTime() - 518400000; // 6 days ago
//     const lastMonthTimestamp = now.getTime() - 2592000000; // 30 days ago

//     return [
//       {
//         id: "1",
//         name: "John Smith",
//         phoneNumber: "+1 (555) 123-4567",
//         callType: "incoming",
//         duration: "3:42",
//         timestamp: todayTimestamp,
//         missed: false,
//         avatar: "https://randomuser.me/api/portraits/men/1.jpg",
//       },
//       {
//         id: "2",
//         name: "Sarah Johnson",
//         phoneNumber: "+1 (555) 987-6543",
//         callType: "outgoing",
//         duration: "1:15",
//         timestamp: todayTimestamp - 7200000, // 2 hours ago
//         missed: false,
//         avatar: "https://randomuser.me/api/portraits/women/1.jpg",
//       },
//       {
//         id: "3",
//         name: "Unknown",
//         phoneNumber: "+1 (555) 432-1098",
//         callType: "incoming",
//         duration: "0:00",
//         timestamp: yesterdayTimestamp,
//         missed: true,
//         avatar: null,
//       },
//       {
//         id: "4",
//         name: "Mom",
//         phoneNumber: "+1 (555) 789-0123",
//         callType: "outgoing",
//         duration: "7:21",
//         timestamp: yesterdayTimestamp - 3600000, // 1 hour later
//         missed: false,
//         avatar: "https://randomuser.me/api/portraits/women/2.jpg",
//       },
//       {
//         id: "5",
//         name: "Dad",
//         phoneNumber: "+1 (555) 234-5678",
//         callType: "incoming",
//         duration: "2:45",
//         timestamp: twoDaysAgoTimestamp,
//         missed: false,
//         avatar: "https://randomuser.me/api/portraits/men/2.jpg",
//       },
//     ];
//   };

//   // Render header
//   const renderHeader = () => (
//     <View style={styles.header}>
//       <Text style={styles.headerTitle}>Call History</Text>

//       <TouchableOpacity onPress={() => {}}>
//         <MaterialIcons name="info-outline" size={24} color="#007AFF" />
//       </TouchableOpacity>
//     </View>
//   );

//   // Render search bar
//   const renderSearchBar = () => (
//     <View style={styles.searchContainer}>
//       <Ionicons
//         name="search"
//         size={18}
//         color="#8E8E93"
//         style={styles.searchIcon}
//       />
//       <TextInput
//         style={styles.searchInput}
//         placeholder="Search calls"
//         value={searchQuery}
//         onChangeText={setSearchQuery}
//         clearButtonMode="while-editing"
//       />
//     </View>
//   );

//   // Render filter tabs
//   const renderFilterTabs = () => (
//     <View style={styles.filterTabs}>
//       <TouchableOpacity
//         style={[
//           styles.filterTab,
//           activeFilter === "all" && styles.activeFilterTab,
//         ]}
//         onPress={() => setActiveFilter("all")}
//       >
//         <Text
//           style={[
//             styles.filterText,
//             activeFilter === "all" && styles.activeFilterText,
//           ]}
//         >
//           All
//         </Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={[
//           styles.filterTab,
//           activeFilter === "missed" && styles.activeFilterTab,
//         ]}
//         onPress={() => setActiveFilter("missed")}
//       >
//         <Text
//           style={[
//             styles.filterText,
//             activeFilter === "missed" && styles.activeFilterText,
//           ]}
//         >
//           Missed
//         </Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={[
//           styles.filterTab,
//           activeFilter === "incoming" && styles.activeFilterTab,
//         ]}
//         onPress={() => setActiveFilter("incoming")}
//       >
//         <Text
//           style={[
//             styles.filterText,
//             activeFilter === "incoming" && styles.activeFilterText,
//           ]}
//         >
//           Incoming
//         </Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={[
//           styles.filterTab,
//           activeFilter === "outgoing" && styles.activeFilterTab,
//         ]}
//         onPress={() => setActiveFilter("outgoing")}
//       >
//         <Text
//           style={[
//             styles.filterText,
//             activeFilter === "outgoing" && styles.activeFilterText,
//           ]}
//         >
//           Outgoing
//         </Text>
//       </TouchableOpacity>
//     </View>
//   );

//   // Render call log item
//   const renderItem = ({ item }) => (
//     <TouchableOpacity
//       style={styles.callLogItem}
//       activeOpacity={0.7}
//       delayLongPress={800}
//       onLongPress={() => handleDeleteLog(item.id)}
//     >
//       <View style={styles.callLogMain}>
//         {/* Avatar */}
//         <View style={styles.avatarContainer}>
//           {item.avatar ? (
//             <Image source={{ uri: item.avatar }} style={styles.avatar} />
//           ) : (
//             <View
//               style={[
//                 styles.avatarPlaceholder,
//                 { backgroundColor: item.missed ? "#FF3B30" : "#34C759" },
//               ]}
//             >
//               <Text style={styles.avatarLetter}>{item.name.charAt(0)}</Text>
//             </View>
//           )}

//           {/* Call type indicator - with MaterialCommunityIcons */}
//           <View
//             style={[
//               styles.callTypeIndicator,
//               item.missed
//                 ? styles.missedCallIndicator
//                 : item.callType === "incoming"
//                 ? styles.incomingCallIndicator
//                 : styles.outgoingCallIndicator,
//             ]}
//           >
//             <MaterialCommunityIcons
//               name={
//                 item.missed
//                   ? "phone-missed"
//                   : item.callType === "incoming"
//                   ? "phone-incoming"
//                   : "phone-outgoing"
//               }
//               size={12}
//               color="white"
//             />
//           </View>
//         </View>

//         {/* Call info */}
//         <View style={styles.callInfo}>
//           <Text
//             style={[styles.callerName, item.missed && styles.missedCallText]}
//           >
//             {item.name}
//           </Text>

//           <View style={styles.callDetails}>
//             {/* Using MaterialCommunityIcons instead of Ionicons */}
//             <MaterialCommunityIcons
//               name={
//                 item.callType === "incoming"
//                   ? "phone-incoming"
//                   : "phone-outgoing"
//               }
//               size={14}
//               color="#8E8E93"
//             />
//             <Text style={styles.phoneNumber}>{item.phoneNumber}</Text>
//           </View>
//         </View>

//         {/* Call time and actions */}
//         <View style={styles.callTimeActions}>
//           <Text style={styles.callTime}>{formatCallTime(item.timestamp)}</Text>

//           {!item.missed && (
//             <Text style={styles.callDuration}>{item.duration}</Text>
//           )}

//           <View style={styles.callActions}>
//             <TouchableOpacity
//               style={styles.callAction}
//               onPress={() => handleCallBack(item.phoneNumber)}
//             >
//               <MaterialCommunityIcons name="phone" size={20} color="#007AFF" />
//             </TouchableOpacity>

//             <TouchableOpacity
//               style={styles.callAction}
//               onPress={() => handleMessage(item.phoneNumber)}
//             >
//               <MaterialCommunityIcons
//                 name="message-text-outline"
//                 size={18}
//                 color="#007AFF"
//               />
//             </TouchableOpacity>

//             <TouchableOpacity
//               style={styles.callAction}
//               onPress={() => handleDeleteLog(item.id)}
//             >
//               <MaterialCommunityIcons
//                 name="delete-outline"
//                 size={20}
//                 color="#FF3B30"
//               />
//             </TouchableOpacity>
//           </View>
//         </View>
//       </View>
//     </TouchableOpacity>
//   );

//   // Render section header
//   const renderSectionHeader = ({ section: { title } }) => (
//     <View style={styles.sectionHeader}>
//       <Text style={styles.sectionHeaderText}>{title}</Text>
//     </View>
//   );

//   // Loading view
//   if (loading) {
//     return (
//       <View style={styles.loadingContainer}>
//         <ActivityIndicator size="large" color="#007AFF" />
//         <Text style={styles.loadingText}>Loading call history...</Text>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor="#F2F2F7" />

//       {renderHeader()}
//       {renderSearchBar()}
//       {renderFilterTabs()}

//       {showPermissionButton && (
//         <TouchableOpacity
//           style={styles.permissionBanner}
//           onPress={handleRequestPermissions}
//         >
//           <MaterialCommunityIcons
//             name="shield-alert-outline"
//             size={24}
//             color="#FF9500"
//           />
//           <Text style={styles.permissionBannerText}>
//             Tap to access actual call logs from your device
//           </Text>
//           <MaterialIcons name="arrow-forward-ios" size={16} color="#8E8E93" />
//         </TouchableOpacity>
//       )}

//       <SectionList
//         sections={groupedLogs()}
//         keyExtractor={(item) => item.id}
//         renderItem={renderItem}
//         renderSectionHeader={renderSectionHeader}
//         stickySectionHeadersEnabled={true}
//         contentContainerStyle={styles.callLogList}
//         ListEmptyComponent={
//           <View style={styles.emptyContainer}>
//             <MaterialCommunityIcons
//               name="phone-outline"
//               size={64}
//               color="#C7C7CC"
//             />
//             <Text style={styles.emptyText}>No call logs found</Text>
//           </View>
//         }
//       />

//       <TouchableOpacity
//         style={styles.deleteAllButton}
//         onPress={() => setCallLogs([])}
//       >
//         <MaterialIcons name="delete-sweep" size={20} color="#FF3B30" />
//         <Text style={styles.deleteAllText}>Delete All Logs</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#F2F2F7",
//   },
//   permissionBanner: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#FFF9EB",
//     padding: 12,
//     margin: 10,
//     borderRadius: 10,
//     borderLeftWidth: 4,
//     borderLeftColor: "#FF9500",
//   },
//   permissionBannerText: {
//     flex: 1,
//     fontSize: 14,
//     color: "#000",
//     marginLeft: 10,
//     marginRight: 10,
//   },
//   header: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     paddingHorizontal: 16,
//     paddingTop: 50,
//     paddingBottom: 10,
//     backgroundColor: "white",
//   },
//   headerTitle: {
//     fontSize: 22,
//     fontWeight: "600",
//     color: "#000",
//   },
//   searchContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     backgroundColor: "#E9E9EB",
//     marginHorizontal: 16,
//     marginVertical: 10,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     borderRadius: 10,
//   },
//   searchIcon: {
//     marginRight: 8,
//   },
//   searchInput: {
//     flex: 1,
//     fontSize: 16,
//     color: "#000",
//   },
//   filterTabs: {
//     flexDirection: "row",
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     backgroundColor: "white",
//     borderBottomWidth: 1,
//     borderBottomColor: "#E9E9EB",
//   },
//   filterTab: {
//     paddingHorizontal: 14,
//     paddingVertical: 6,
//     borderRadius: 16,
//     marginHorizontal: 4,
//   },
//   activeFilterTab: {
//     backgroundColor: "#007AFF",
//   },
//   filterText: {
//     fontSize: 14,
//     fontWeight: "500",
//     color: "#8E8E93",
//   },
//   activeFilterText: {
//     color: "white",
//   },
//   callLogList: {
//     paddingBottom: 60,
//   },
//   sectionHeader: {
//     backgroundColor: "#F2F2F7",
//     paddingHorizontal: 16,
//     paddingVertical: 6,
//     borderBottomWidth: 1,
//     borderBottomColor: "#E9E9EB",
//   },
//   sectionHeaderText: {
//     fontSize: 14,
//     fontWeight: "600",
//     color: "#8E8E93",
//   },
//   callLogItem: {
//     backgroundColor: "white",
//     borderBottomWidth: 1,
//     borderBottomColor: "#E9E9EB",
//   },
//   callLogMain: {
//     flexDirection: "row",
//     padding: 12,
//   },
//   avatarContainer: {
//     position: "relative",
//     marginRight: 12,
//   },
//   avatar: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//   },
//   avatarPlaceholder: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//     backgroundColor: "#34C759",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   avatarLetter: {
//     fontSize: 18,
//     fontWeight: "600",
//     color: "white",
//   },
//   callTypeIndicator: {
//     position: "absolute",
//     bottom: 0,
//     right: 0,
//     width: 20,
//     height: 20,
//     borderRadius: 10,
//     backgroundColor: "#34C759",
//     alignItems: "center",
//     justifyContent: "center",
//     borderWidth: 2,
//     borderColor: "white",
//   },
//   missedCallIndicator: {
//     backgroundColor: "#FF3B30",
//   },
//   incomingCallIndicator: {
//     backgroundColor: "#34C759",
//   },
//   outgoingCallIndicator: {
//     backgroundColor: "#007AFF",
//   },
//   callInfo: {
//     flex: 1,
//     justifyContent: "center",
//   },
//   callerName: {
//     fontSize: 16,
//     fontWeight: "500",
//     color: "#000",
//     marginBottom: 4,
//   },
//   missedCallText: {
//     color: "#FF3B30",
//   },
//   callDetails: {
//     flexDirection: "row",
//     alignItems: "center",
//   },
//   phoneNumber: {
//     fontSize: 14,
//     color: "#8E8E93",
//     marginLeft: 4,
//   },
//   callTimeActions: {
//     alignItems: "flex-end",
//     justifyContent: "center",
//   },
//   callTime: {
//     fontSize: 14,
//     color: "#8E8E93",
//     marginBottom: 4,
//   },
//   callDuration: {
//     fontSize: 13,
//     color: "#8E8E93",
//     marginBottom: 8,
//   },
//   callActions: {
//     flexDirection: "row",
//   },
//   callAction: {
//     marginLeft: 12,
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     paddingTop: 100,
//   },
//   emptyText: {
//     fontSize: 16,
//     color: "#8E8E93",
//     marginTop: 16,
//   },
//   deleteAllButton: {
//     position: "absolute",
//     bottom: 16,
//     right: 16,
//     backgroundColor: "white",
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     borderRadius: 20,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//     elevation: 4,
//   },
//   deleteAllText: {
//     fontSize: 14,
//     fontWeight: "500",
//     color: "#FF3B30",
//     marginLeft: 6,
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     backgroundColor: "#F2F2F7",
//   },
//   loadingText: {
//     fontSize: 16,
//     color: "#8E8E93",
//     marginTop: 16,
//   },
// });
