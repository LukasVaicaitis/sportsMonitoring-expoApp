import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, ActivityIndicator, StyleSheet, Pressable, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter, Link } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';

import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, signInWithGoogleCallback } = useAuth();
    const router = useRouter();

    useEffect(() => {
        GoogleSignin.configure({
            webClientId: '882053158713-vea5jb4ajo77bbpeef7nog4j90p1gnee.apps.googleusercontent.com',
            offlineAccess: false,
            scopes: [
                'profile',
                'email',
                'openid',
                'https://www.googleapis.com/auth/fitness.body.read',
                'https://www.googleapis.com/auth/fitness.activity.read',
                'https://www.googleapis.com/auth/fitness.location.read',
                'https://www.googleapis.com/auth/fitness.heart_rate.read',
            ],
        });
    }, []);

    const handleGoogleSignInPress = async () => {
        setLoading(true);
        setError('');
        try {
            await GoogleSignin.signOut();
        } catch (e) {
            console.warn(e);
        }

        try {
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            const userInfo = await GoogleSignin.signIn();

            const idToken = userInfo?.data?.idToken;
            const userEmail = userInfo?.data?.user?.email;

            if (idToken) {
                await signInWithGoogleCallback({ idToken: idToken });
            } else {
                throw new Error("Google Sign-In successful but idToken is missing.");
            }

        } catch (error) {
            Alert.alert('Google Sign-In Error', error.message || 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
          setError('Please enter both email and password.');
          return;
        }
        setError('');
        setLoading(true);
        try {
          await login(email, password);
        } catch (e) {
          const message = 'Invalid email or password, or server error.';
          setError(message);
        } finally {
          setLoading(false);
        }
      };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Login</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TextInput
                style={styles.input}
                placeholder="Email Address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
            />

            {loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : (
                <Button title="Login" onPress={handleLogin} disabled={loading} color="#007AFF" />
            )}

            <Pressable onPress={() => router.push('/loginScreen/RequestReset')} disabled={loading} style={styles.switchButton}>
                <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
            </Pressable>


            <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
            </View>

            <Pressable
                style={[styles.button, styles.googleButton]}
                disabled={loading}
                onPress={handleGoogleSignInPress}
            >
                <AntDesign name="google" size={18} color="#DB4437" />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </Pressable>

            <Pressable onPress={() => router.push('/registerScreen')} disabled={loading} style={styles.switchButton}>
                <Text style={styles.switchButtonText}>Don't have an account? Register</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24 },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: '#333' },
    input: { height: 45, borderColor: '#ccc', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8, fontSize: 16, backgroundColor: '#f9f9f9' },
    errorText: { color: 'red', textAlign: 'center', marginBottom: 12, fontSize: 14 },
    loader: { marginVertical: 20 },
    switchButton: { marginTop: 20, alignItems: 'center' },
    switchButtonText: { color: '#007AFF', fontSize: 15 },
    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 25 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#e0e0e0' },
    dividerText: { width: 50, textAlign: 'center', color: '#888' },
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, width: '100%', elevation: 2, marginBottom: 10 },
    googleButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc' },
    googleButtonText: { color: '#555', fontSize: 16, fontWeight: '500', marginLeft: 10 },
    forgotPasswordLink: { marginTop: 15, textAlign: 'center', textDecorationLine: 'underline' },
});