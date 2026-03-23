import * as Linking from 'expo-linking';

const prefix = Linking.createURL('/');

export const linking = {
  prefixes: [prefix, 'arctivate://'],
  config: {
    screens: {
      Auth: 'auth',
      Onboarding: 'onboarding',
      Main: {
        screens: {
          Train: 'train',
          Coach: 'coach',
          Feed: 'feed',
          Habits: 'habits',
          Food: 'food',
        },
      },
      Profile: 'profile',
      Checkin: 'checkin',
      Groups: 'groups',
    },
  },
};

export function handleDeepLink(url, supabase) {
  if (!url) return;

  // Handle Supabase auth magic link callback
  if (url.includes('access_token') || url.includes('#access_token')) {
    const params = new URLSearchParams(
      url.includes('#') ? url.split('#')[1] : url.split('?')[1]
    );
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  }
}
