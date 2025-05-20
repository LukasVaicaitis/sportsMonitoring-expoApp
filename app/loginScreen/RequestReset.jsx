import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import axios from 'axios';
import { Stack } from 'expo-router';
import Toast from 'react-native-toast-message';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function RequestPasswordResetScreen() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleRequestReset = async () => {
        if (!email) {
            setError('Please enter your email address.');
            return;
        }
        setIsLoading(true);
        setError('');
        setMessage('');
        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/request-password-reset`, { email });
            setMessage(response.data.msg || 'Password reset email sent if account exists.');
            Toast.show({ type: 'success', text1: 'Request Sent', text2: 'Check your email for the reset link.' });
            setEmail('');
        } catch (err) {
            const errorMsg = err.response?.data?.msg || 'An error occurred. Please try again.';
            setError(errorMsg);
            Toast.show({ type: 'error', text1: 'Request Failed', text2: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Reset Password' }} />
            <Text style={styles.title}>Forgot Your Password?</Text>
            <Text style={styles.subtitle}>Enter your email address below, and we'll send you a link to reset your password.</Text>

            {message ? <Text style={styles.successText}>{message}</Text> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
            />

            {isLoading ? (
                <ActivityIndicator size="large" color="#007AFF" />
            ) : (
                <Button title="Send Reset Link" onPress={handleRequestReset} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
    subtitle: { fontSize: 16, textAlign: 'center', color: '#666', marginBottom: 30 },
    input: { height: 45, borderColor: '#ccc', borderWidth: 1, marginBottom: 20, paddingHorizontal: 15, borderRadius: 8, fontSize: 16 },
    errorText: { color: 'red', textAlign: 'center', marginBottom: 15 },
    successText: { color: 'green', textAlign: 'center', marginBottom: 15 },
});