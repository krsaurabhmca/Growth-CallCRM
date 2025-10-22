import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#007AFF", // iOS blue accent
          tabBarInactiveTintColor: "#999",
          tabBarHideOnKeyboard: true, // hides tab bar when keyboard is open
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopWidth: 0.4,
            borderTopColor: "#ccc",
            height: 60,
            paddingBottom: 6,
            paddingTop: 6,
            elevation: 3, // subtle Android shadow
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "500",
            marginTop: -2,
          },
        }}
      >

        {/* 📞 Call Logs Tab */}
        <Tabs.Screen
          name="calllog"
          options={{
            title: "Call Logs",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "people" : "people-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />
        
        {/* ☎️ Dialer Tab */}
        <Tabs.Screen
          name="dialer"
          options={{
            title: "Dialer",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "keypad" : "keypad-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />

    
        {/* 🏠 Recordings Tab */}
        <Tabs.Screen
          name="home"
          options={{
            title: "Recordings",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "save" : "save-outline"}
                size={size}
                color={color}
              />
            ),
          }}
        />   

        
      </Tabs>
    </SafeAreaView>
  );
}
