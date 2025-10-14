import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export default function PhoneBook() {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const scrollY = new Animated.Value(0);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        
        if (status === 'granted') {
          const { data } = await Contacts.getContactsAsync({
            fields: [
              Contacts.Fields.Name,
              Contacts.Fields.PhoneNumbers,
              Contacts.Fields.Image,
              Contacts.Fields.Emails
            ],
            sort: Contacts.SortTypes.FirstName
          });
          
          if (data.length > 0) {
            // Process contacts to have consistent format
            const processedContacts = data
              .filter(contact => contact.name && contact.phoneNumbers && contact.phoneNumbers.length > 0)
              .map(contact => ({
                id: contact.id,
                name: contact.name,
                phone: contact.phoneNumbers[0]?.number || '',
                avatar: contact.imageAvailable ? contact.image.uri : null,
                favorite: false // You could store favorites in AsyncStorage
              }));
            
            setContacts(processedContacts);
            setFilteredContacts(processedContacts);
          }
        } else {
          setPermissionDenied(true);
        }
      } catch (error) {
        console.error("Error fetching contacts:", error);
        Alert.alert("Error", "Failed to load contacts");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone.includes(searchQuery)
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const toggleFavorite = (id) => {
    setContacts(contacts.map(contact => 
      contact.id === id ? {...contact, favorite: !contact.favorite} : contact
    ));
  };

  const makeCall = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const sendMessage = (phoneNumber) => {
    Linking.openURL(`sms:${phoneNumber}`);
  };

  const openSettings = () => {
    Linking.openSettings();
  };

  // Create letter index for alphabetical jump list
  const getAlphabetIndex = () => {
    const alphabet = {};
    filteredContacts.forEach(contact => {
      const firstLetter = contact.name.charAt(0).toUpperCase();
      alphabet[firstLetter] = true;
    });
    return Object.keys(alphabet).sort();
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.contactItem}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>{item.phone}</Text>
        </View>
        <View style={styles.contactActions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => makeCall(item.phone)}
          >
            <Ionicons name="call-outline" size={22} color="#4CAF50" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => sendMessage(item.phone)}
          >
            <Ionicons name="chatbubble-outline" size={22} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => toggleFavorite(item.id)}
          >
            <Ionicons 
              name={item.favorite ? "star" : "star-outline"} 
              size={22} 
              color={item.favorite ? "#FFC107" : "#757575"} 
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ letter }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{letter}</Text>
    </View>
  );

  // Group and render contacts by first letter
  const renderContactList = () => {
    // Group contacts by first letter
    const contactsByLetter = {};
    filteredContacts.forEach(contact => {
      const firstLetter = contact.name.charAt(0).toUpperCase();
      if (!contactsByLetter[firstLetter]) {
        contactsByLetter[firstLetter] = [];
      }
      contactsByLetter[firstLetter].push(contact);
    });

    // Create a sorted list of sections
    const sections = Object.keys(contactsByLetter).sort();

    return (
      <>
        <FlatList
          data={filteredContacts}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={true}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="person-outline" size={64} color="#BDBDBD" />
              <Text style={styles.emptyText}>No contacts found</Text>
            </View>
          }
          ListHeaderComponent={<View style={styles.listHeader} />}
          stickyHeaderIndices={sections.map((_, index) => index * (contactsByLetter[sections[index]].length + 1))}
          sections={sections.map(letter => ({
            title: letter,
            data: contactsByLetter[letter]
          }))}
        />
      </>
    );
  };

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={styles.centeredContainer}>
        <Ionicons name="lock-closed-outline" size={64} color="#F44336" />
        <Text style={styles.permissionTitle}>Permission Required</Text>
        <Text style={styles.permissionText}>
          This app needs access to your contacts to show your phonebook.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={openSettings}>
          <Text style={styles.permissionButtonText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <Animated.View style={[
        styles.header,
        {
          shadowOpacity: scrollY.interpolate({
            inputRange: [0, 20],
            outputRange: [0, 0.9],
            extrapolate: 'clamp',
          }),
        }
      ]}>
        <Text style={styles.title}>Contacts</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#757575" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9E9E9E"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#757575" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {renderContactList()}
{/*       
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#616161',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212121',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomColor: '#F0F0F0',
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#212121',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#212121',
    padding: 0,
  },
  list: {
    paddingBottom: 80,
  },
  listHeader: {
    height: 10,
  },
  sectionHeader: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#616161',
  },
  contactItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
  },
  placeholderAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3F51B5',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#757575',
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9E9E9E',
    marginTop: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2196F3',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});