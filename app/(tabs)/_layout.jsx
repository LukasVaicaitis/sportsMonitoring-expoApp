import { Tabs } from 'expo-router';
import React from 'react';

import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';

import { Colors } from '@/constants/Colors';

export default function TabLayout() {
  const colorScheme = 'light';
  const lightOrDark = colorScheme ?? 'light';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[lightOrDark].tabIconSelected,
        tabBarInactiveTintColor: Colors[lightOrDark].tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors[lightOrDark].background,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="extra"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <Feather size={28} name="more-horizontal" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <FontAwesome size={28} name="history" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'NFC',
          tabBarIcon: ({ color }) => <AntDesign size={28} name="scan1" color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) => <MaterialIcons size={28} name="sports-gymnastics" color={color} />,
        }}
      />
    </Tabs>
  );
}