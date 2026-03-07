import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import { supabase } from './src/lib/supabase';
import { colors } from './src/theme';

export default function App() {
  const [session, setSession] = useState(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkOnboarding(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkOnboarding(session.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
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
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Navigation
        session={session}
        onboardingComplete={onboardingComplete}
        onOnboardingComplete={handleOnboardingComplete}
      />
    </SafeAreaProvider>
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
