import { Ionicons } from "@expo/vector-icons"; // ✅ Modern, widely used icons
import { Tabs } from "expo-router";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#007AFF", // iOS blue accent
          tabBarInactiveTintColor: "#888",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopWidth: 0.5,
            borderTopColor: "#ddd",
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "500",
          },
        }}
      >
        {/* 📞 Calls Tab */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Recordings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="save-outline" size={size} color={color} />
            ),
          }}
        />

        {/* ☎️ Dialer Tab */}
        <Tabs.Screen
          name="dialer"
          options={{
            title: "Dialer",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="keypad-outline" size={size} color={color} />
            ),
          }}
        />

        {/* 📇 Phonebook Tab */}
        <Tabs.Screen
          name="phonebook"
          options={{
            title: "Contacts",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />
      
      <Tabs.Screen
          name="calllog"
          options={{
            title: "Call Logs",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="call-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
