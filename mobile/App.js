import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/ErrorBoundary';
import { supabase } from './src/lib/supabase';
import { handleDeepLink } from './src/lib/linking';
import { useNotifications } from './src/hooks/useNotifications';
import { colors } from './src/theme';

export default function App() {
  const [session, setSession] = useState(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useNotifications();

  useEffect(() => {
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url, supabase);
    });

    Linking.getInitialURL()
      .then((url) => {
        if (url) handleDeepLink(url, supabase);
      })
      .catch((err) => console.warn('Initial URL error:', err));

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        if (session) checkOnboarding(session.user.id);
        else setLoading(false);
      })
      .catch((err) => {
        console.warn('Session retrieval error:', err);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkOnboarding(session.user.id);
      else setLoading(false);
    });

    return () => {
      linkSub.remove();
      subscription.unsubscribe();
    };
  }, []);

  async function checkOnboarding(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('completed_onboarding')
        .eq('id', userId)
        .maybeSingle();
      if (error) console.warn('Onboarding check failed:', error.message);
      setOnboardingComplete(data?.completed_onboarding ?? false);
    } catch (err) {
      console.warn('Onboarding check error:', err);
      setOnboardingComplete(false);
    }
    setLoading(false);
  }

  function handleOnboardingComplete() {
    setOnboardingComplete(true);
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Navigation
          session={session}
          onboardingComplete={onboardingComplete}
          onOnboardingComplete={handleOnboardingComplete}
        />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
