import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View
} from 'react-native';

export default function DialerScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Add digit to phone number
  const addDigit = (digit) => {
    // Don't allow too many digits (typical phone number length limit)
    if (phoneNumber.length < 15) {
      setPhoneNumber(prevNumber => prevNumber + digit);
      
      // Provide haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Vibration.vibrate(10);
      }
      
      // Button press animation
      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: 0.95,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        })
      ]).start();
    }
  };

  // Delete last digit
  const deleteDigit = () => {
    if (phoneNumber.length > 0) {
      setPhoneNumber(prevNumber => prevNumber.slice(0, -1));
      
      // Provide haptic feedback
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
    
    // Provide haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Vibration.vibrate(30);
    }
  };

  // Make phone call
  const makeCall = () => {
    if (phoneNumber.length > 0) {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Vibration.vibrate([0, 30, 60, 30]);
      }
      
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  // Format phone number for display
  const formatPhoneNumber = (number) => {
    if (!number) return '';
    
    // Simple US-style formatting - modify as needed for other regions
    if (number.length <= 3) {
      return number;
    } else if (number.length <= 6) {
      return `${number.slice(0, 3)}-${number.slice(3)}`;
    } else {
      return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6, 10)}${number.length > 10 ? number.slice(10) : ''}`;
    }
  };

  // Render keypad button
  const renderDialButton = (digit, letters = '') => (
    <TouchableOpacity 
      style={styles.dialButton} 
      onPress={() => addDigit(digit)}
      activeOpacity={0.7}
    >
      <Text style={styles.dialButtonNumber}>{digit}</Text>
      {letters && <Text style={styles.dialButtonLetters}>{letters}</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Phone number display */}
      <View style={styles.numberContainer}>
        <Text style={styles.phoneNumber}>
          {phoneNumber ? formatPhoneNumber(phoneNumber) : 'Enter number'}
        </Text>
        
        {phoneNumber.length > 0 && (
          <TouchableOpacity onPress={clearNumber} style={styles.clearButton}>
            <Ionicons name="close-circle" size={24} color="#888" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Dial pad */}
      <View style={styles.dialPad}>
        <View style={styles.dialRow}>
          {renderDialButton('1')}
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
          {renderDialButton('*')}
          {renderDialButton('0', '+')}
          {renderDialButton('#')}
        </View>
      </View>
      
      {/* Call and delete buttons */}
      <View style={styles.actionRow}>
        {phoneNumber.length > 0 ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={deleteDigit}
            onLongPress={clearNumber}
            delayLongPress={500}
          >
            <Ionicons name="backspace-outline" size={24} color="#555" />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholderButton} />
        )}
        
        <TouchableOpacity
          style={[
            styles.callButton,
            phoneNumber.length > 0 ? styles.callButtonActive : styles.callButtonInactive
          ]}
          onPress={makeCall}
          activeOpacity={0.8}
          disabled={phoneNumber.length === 0}
        >
          <Ionicons name="call-outline" size={28} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.placeholderButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 40,
  },
  numberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  phoneNumber: {
    fontSize: 32,
    color: '#212121',
    letterSpacing: 1,
    fontWeight: '300',
  },
  clearButton: {
    marginLeft: 10,
    padding: 5,
  },
  dialPad: {
    padding: 15,
  },
  dialRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  dialButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  dialButtonNumber: {
    fontSize: 28,
    fontWeight: '400',
    color: '#212121',
  },
  dialButtonLetters: {
    fontSize: 12,
    color: '#757575',
    marginTop: 3,
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginTop: 10,
    alignItems: 'center',
  },
  deleteButton: {
    padding: 15,
    borderRadius: 30,
  },
  callButton: {
    width: 65,
    height: 65,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  callButtonActive: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
  },
  callButtonInactive: {
    backgroundColor: '#9E9E9E',
    shadowColor: '#9E9E9E',
  },
  placeholderButton: {
    width: 50,
  }
});