import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Alert, Platform, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import * as Notifications from 'expo-notifications';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const AuthContext = createContext(null);

Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const appState = useRef(AppState.currentState);

    const performLogout = async (notify = false) => {
        delete axios.defaults.headers.common['Authorization'];
        try {
            await SecureStore.deleteItemAsync('authToken');
        } catch (e) {
            console.error('[Error deleting token:', e);
        }
        setToken(null);
        setUser(null);
        if (notify) {
            Alert.alert("Session Expired", "You have been logged out.");
        }
    };

    useEffect(() => {
        let subscription = null;
        if (token && user) {
             const handleAppStateChange = (nextAppState) => {
                if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                    cancelInactivityNotification();
                } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
                    scheduleInactivityNotification();
                }
                appState.current = nextAppState;
            };
            subscription = AppState.addEventListener('change', handleAppStateChange);
             cancelInactivityNotification();
             return () => {
                subscription?.remove();
             };
        } else {
             subscription?.remove();
             cancelInactivityNotification();
        }
    }, [token, user]);

    const cancelInactivityNotification = async () => {
        try {
            await Notifications.cancelAllScheduledNotificationsAsync();
        } catch (e) { }
    };

    const scheduleInactivityNotification = async () => {
        const reminderMinutes = user?.remindertime;
        if (!reminderMinutes || reminderMinutes <= 0) return;
        const triggerSeconds = reminderMinutes * 60;
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "Workout Reminder!",
                    body: `It's been a while! Time to hit the gym and log your progress?`,
                    sound: 'default',
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: triggerSeconds,
                    repeats: false,
                },
            });
        } catch (e) {}
    };

    async function registerForPushNotificationsAsync() {
        let permissionGranted = false;
        if (Platform.OS === 'android') {
            try {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                });
            } catch (e) { }
        }
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync({
                    ios: { allowAlert: true, allowBadge: true, allowSound: true },
                });
                finalStatus = status;
            }
            permissionGranted = finalStatus === 'granted';
        } catch (e) {
             permissionGranted = false;
        }
        return permissionGranted;
    }

    useEffect(() => {
        const loadAuthState = async () => {
            setIsLoading(true);
            let storedToken = null;
            try {
                storedToken = await SecureStore.getItemAsync('authToken');
                if (storedToken) {
                    const decodedToken = jwtDecode(storedToken);
                    const currentTime = Date.now() / 1000;
                    if (decodedToken.exp < currentTime) {
                        await performLogout();
                    } else {
                        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                        try {
                            const profileResponse = await axios.get(`${API_BASE_URL}/api/profile/me`);
                            if (profileResponse.data) {
                                setToken(storedToken);
                                setUser(profileResponse.data);
                            } else {
                                await performLogout();
                            }
                        } catch (profileError) {
                            await performLogout();
                        }
                    }
                } else {
                    await performLogout();
                }
            } catch (e) {
                await performLogout();
            } finally {
                setIsLoading(false);
            }
        };
        loadAuthState();
    }, []); 

    useEffect(() => {
        const responseInterceptor = axios.interceptors.response.use(
            response => response,
            async (error) => {
                if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
                    const originalRequestConfig = error.config;
                    if (!originalRequestConfig?.url?.endsWith('/login')) {
                        await performLogout(true);
                    }
                }
                return Promise.reject(error);
            }
        );
        return () => {
            axios.interceptors.response.eject(responseInterceptor);
        };
    }, []);

    const login = async (email, password) => {
        setIsLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
            const receivedToken = response.data?.token;
            const loggedInUser = response.data?.user;
            if (!receivedToken || !loggedInUser) {
                throw new Error('Invalid login response: Missing token or user.');
            }
            axios.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
            await SecureStore.setItemAsync('authToken', receivedToken);
            await registerForPushNotificationsAsync();
    
            setToken(receivedToken);
            setUser(loggedInUser);
    
            return true;
        } catch (error) {
            await performLogout();
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (name, email, password) => {
        setIsLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/register`, { name, email, password });
            const { token: receivedToken } = response.data;
            if (!receivedToken) throw new Error("No token received post-registration.");
            setToken(receivedToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${receivedToken}`;
            await SecureStore.setItemAsync('authToken', receivedToken);
            try {
                const profileResponse = await axios.get(`${API_BASE_URL}/api/profile/me`);
                setUser(profileResponse.data);
            } catch (profileError) {
                setUser(null);
            }
            await registerForPushNotificationsAsync();
            return true;
        } catch (error) {
            await performLogout();
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const signInWithGoogleCallback = async (googleToken) => {
        if (!googleToken?.idToken) return false;
        setIsLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/google`, { idToken: googleToken.idToken });
            const { token: appToken, user: loggedInUser } = response.data;
            setToken(appToken);
            setUser(loggedInUser);
            axios.defaults.headers.common['Authorization'] = `Bearer ${appToken}`;
            await SecureStore.setItemAsync('authToken', appToken);
            return true;
        } catch (error) {
            await performLogout();
            Alert.alert("Sign-In Error", error.response?.data?.msg || "Failed to sign in with Google.");
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const refreshUserProfile = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const profileResponse = await axios.get(`${API_BASE_URL}/api/profile/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (profileResponse.data) {
                setUser(profileResponse.data);
            }
        } catch (error) {
            console.error('Error refreshing user profile:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        await performLogout();
        setIsLoading(false);
    };

    const value = {
        user, token, isLoggedIn: !!token, isLoading,
        login, register, logout, signInWithGoogleCallback, refreshUserProfile
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
