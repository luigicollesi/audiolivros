import React from 'react';
import { Stack } from 'expo-router';

export default function PrivateLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Stack.Screen name="(home)" />
      <Stack.Screen name="book" />
    </Stack>
  );
}
