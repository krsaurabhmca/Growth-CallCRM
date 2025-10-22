import { Stack } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

const _layout = () => {
  return (
    <SafeAreaProvider>
    <SafeAreaView style={{ flex: 1 }} edges={['right', 'bottom', 'left'] }>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="CallHistoryScreen" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaView>
    </SafeAreaProvider>
  );
};

export default _layout;

const styles = StyleSheet.create({});
