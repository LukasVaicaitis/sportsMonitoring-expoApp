import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import axios from 'axios';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function ResetPasswordScreen() {
    const { token } = useLocalSearchParams();
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleResetPassword = async () => {
        if (!password || !confirmPassword) {
            setError('Please enter and confirm your new password.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 6) { 
             setError('Password must be at least 6 characters.');
             return;
        }
        if (!token) {
            setError('Invalid or missing reset token.');
            return;
        }

        setIsLoading(true);
        setError('');
        setMessage('');

        try {
            const response = await axios.put(`${API_BASE_URL}/api/auth/reset-password/${token}`, { password });
            setMessage(response.data.msg || 'Password reset successfully!');
            Toast.show({ type: 'success', text1: 'Password Reset!', text2: 'You can now log in.' });
            setTimeout(() => {
                router.replace('/login');
            }, 2000);

        } catch (err) {
            const errorMsg = err.response?.data?.msg || 'Failed to reset password. The link may be invalid or expired.';
            setError(errorMsg);
            Toast.show({ type: 'error', text1: 'Reset Failed', text2: errorMsg });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ title: 'Set New Password' }} />
            <Text style={styles.title}>Set Your New Password</Text>

            {!token && <Text style={styles.errorText}>Invalid password reset link.</Text>}

            {message ? <Text style={styles.successText}>{message}</Text> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TextInput
                style={styles.input}
                placeholder="Enter new password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!isLoading && !!token}
            />
            <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!isLoading && !!token}
            />

            {isLoading ? (
                <ActivityIndicator size="large" color="#007AFF" />
            ) : (
                <Button
                    title="Reset Password"
                    onPress={handleResetPassword}
                    disabled={!token || isLoading}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
    input: { height: 45, borderColor: '#ccc', borderWidth: 1, marginBottom: 20, paddingHorizontal: 15, borderRadius: 8, fontSize: 16 },
    errorText: { color: 'red', textAlign: 'center', marginBottom: 15 },
    successText: { color: 'green', textAlign: 'center', marginBottom: 15 },
});