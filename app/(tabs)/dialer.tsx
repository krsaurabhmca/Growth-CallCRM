import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';

// For direct calling
const RNPhoneCall = require('react-native-phone-call').default;

export default function DialerScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Add digit to phone number
  const addDigit = (digit) => {
    if (phoneNumber.length < 15) {
      setPhoneNumber(prevNumber => prevNumber + digit);
      
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Vibration.vibrate(10);
      }
    }
  };

  // Delete last digit
  const deleteDigit = () => {
    if (phoneNumber.length > 0) {
      setPhoneNumber(prevNumber => prevNumber.slice(0, -1));
      
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Vibration.vibrate(15);
      }
    }
  };

  // Clear entire phone number
  const clearNumber = () => {
    setPhoneNumber('');
    
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Vibration.vibrate(30);
    }
  };

  // Make direct phone call
  const makeCall = () => {
    if (phoneNumber.length > 0) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Vibration.vibrate([0, 30, 60, 30]);
      }
      
      const args = {
        number: phoneNumber,
        prompt: false, // Set to false for direct call (Android only)
        skipCanOpen: true
      };

      RNPhoneCall(args).catch((error) => {
        Alert.alert('Error', 'Unable to make call: ' + error.message);
      });
    } else {
      Alert.alert('Error', 'Please enter a phone number');
    }
  };

  // Format phone number for display
  const formatPhoneNumber = (number) => {
    if (!number) return '';
    
    if (number.length <= 3) {
      return number;
    } else if (number.length <= 6) {
      return `${number.slice(0, 3)}-${number.slice(3)}`;
    } else if (number.length <= 10) {
      return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`;
    } else {
      return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6, 10)}${number.slice(10)}`;
    }
  };

  // Render keypad button
  const renderDialButton = (digit, letters = '') => (
    <TouchableOpacity 
      style={styles.dialButton} 
      onPress={() => addDigit(digit)}
      activeOpacity={0.7}
    >
      <View style={styles.buttonContent}>
        <Text style={styles.dialButtonNumber}>{digit}</Text>
        {letters && <Text style={styles.dialButtonLetters}>{letters}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
     {/* Header with gradient */}
      <LinearGradient
        colors={['#1565C0', '#1976D2', '#1E88E5']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Ionicons name="keypad" size={24} color="#fff" />
          <Text style={styles.headerTitle}>Dialer</Text>
        </View>
      </LinearGradient>

      {/* Phone number display */}
      <View style={styles.numberContainer}>
        <View style={styles.numberDisplay}>
          <Text 
            style={[
              styles.phoneNumber,
              phoneNumber.length === 0 && styles.phoneNumberPlaceholder
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {phoneNumber ? formatPhoneNumber(phoneNumber) : 'Enter number'}
          </Text>
        </View>
        
        {phoneNumber.length > 0 && (
          <TouchableOpacity 
            onPress={clearNumber} 
            style={styles.clearButton}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={28} color="#EF5350" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Dial pad */}
      <View style={styles.dialPad}>
        <View style={styles.dialRow}>
          {renderDialButton('1', '')}
          {renderDialButton('2', 'ABC')}
          {renderDialButton('3', 'DEF')}
        </View>
        
        <View style={styles.dialRow}>
          {renderDialButton('4', 'GHI')}
          {renderDialButton('5', 'JKL')}
          {renderDialButton('6', 'MNO')}
        </View>
        
        <View style={styles.dialRow}>
          {renderDialButton('7', 'PQRS')}
          {renderDialButton('8', 'TUV')}
          {renderDialButton('9', 'WXYZ')}
        </View>
        
        <View style={styles.dialRow}>
          {renderDialButton('*', '')}
          {renderDialButton('0', '+')}
          {renderDialButton('#', '')}
        </View>
      </View>
      
      {/* Call and delete buttons */}
      <View style={styles.actionRow}>
        <View style={styles.actionButton}>
          {phoneNumber.length > 0 && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={deleteDigit}
              onLongPress={clearNumber}
              delayLongPress={500}
              activeOpacity={0.7}
            >
              <Ionicons name="backspace-outline" size={28} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={[
            styles.callButton,
            phoneNumber.length === 0 && styles.callButtonDisabled
          ]}
          onPress={makeCall}
          activeOpacity={0.8}
          disabled={phoneNumber.length === 0}
        >
          <LinearGradient
            colors={
              phoneNumber.length > 0 
                ? ['#4CAF50', '#45a049'] 
                : ['#BDBDBD', '#9E9E9E']
            }
            style={styles.callButtonGradient}
          >
            <Ionicons name="call" size={32} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.actionButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  numberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    minHeight: 100,
  },
  numberDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  phoneNumber: {
    fontSize: 36,
    color: '#212121',
    letterSpacing: 2,
    fontWeight: '400',
  },
  phoneNumberPlaceholder: {
    color: '#BDBDBD',
    fontSize: 24,
  },
  clearButton: {
    marginLeft: 10,
    padding: 8,
  },
  dialPad: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  dialRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 16,
  },
  dialButton: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonContent: {
    alignItems: 'center',
  },
  dialButtonNumber: {
    fontSize: 28,
    fontWeight: '500',
    color: '#212121',
  },
  dialButtonLetters: {
    fontSize: 10,
    color: '#757575',
    marginTop: 2,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
    marginBottom: 20,
  },
  actionButton: {
    width: 70,
    alignItems: 'center',
  },
  deleteButton: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  callButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButtonDisabled: {
    shadowColor: '#9E9E9E',
    shadowOpacity: 0.2,
  },
});