import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import TrainScreen from '../screens/TrainScreen';
import HabitsScreen from '../screens/HabitsScreen';
import FoodScreen from '../screens/FoodScreen';
import CoachScreen from '../screens/CoachScreen';
import FeedScreen from '../screens/FeedScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CheckinScreen from '../screens/CheckinScreen';
import GroupsScreen from '../screens/GroupsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabIcons = {
  Train: { focused: 'barbell', unfocused: 'barbell-outline' },
  Coach: { focused: 'chatbubble-ellipses', unfocused: 'chatbubble-ellipses-outline' },
  Feed: { focused: 'people', unfocused: 'people-outline' },
  Habits: { focused: 'checkmark-circle', unfocused: 'checkmark-circle-outline' },
  Food: { focused: 'restaurant', unfocused: 'restaurant-outline' },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, size }) => {
          const iconName = focused
            ? tabIcons[route.name].focused
            : tabIcons[route.name].unfocused;
          return (
            <Ionicons
              name={iconName}
              size={size}
              color={focused ? colors.primary : colors.textMuted}
            />
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Train" component={TrainScreen} />
      <Tab.Screen name="Coach" component={CoachScreen} />
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Habits" component={HabitsScreen} />
      <Tab.Screen name="Food" component={FoodScreen} />
    </Tab.Navigator>
  );
}

export default function Navigation({ session, onboardingComplete, onOnboardingComplete }) {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.card,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.primary,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !onboardingComplete ? (
          <Stack.Screen name="Onboarding">
            {(props) => <OnboardingScreen {...props} onComplete={onOnboardingComplete} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.textPrimary,
                headerTitle: 'Profile',
              }}
            />
            <Stack.Screen
              name="Checkin"
              component={CheckinScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.textPrimary,
                headerTitle: 'Check In',
              }}
            />
            <Stack.Screen
              name="Groups"
              component={GroupsScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.textPrimary,
                headerTitle: 'Groups',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
