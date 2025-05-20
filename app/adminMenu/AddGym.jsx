import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function AddGymScreen() {
    const { token } = useAuth();
    const router = useRouter();

    const [gymName, setGymName] = useState('');
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSaveGym = async () => {
        if (!gymName.trim()) {
            Alert.alert('Validation Error', 'Gym name is required.');
            return;
        }
        if (!token) {
            Alert.alert('Error', 'Authentication token not found.');
            return;
        }

        setIsLoading(true);
        setError('');

        const gymData = {
            name: gymName.trim(),
            address: {
                street: street.trim() || undefined,
                city: city.trim() || undefined,
                postalCode: postalCode.trim() || undefined,
                country: country.trim() || undefined,
            }
        };
        if (!gymData.address.street && !gymData.address.city && !gymData.address.postalCode && !gymData.address.country) {
            delete gymData.address;
        }


        try {
            await axios.post(`${API_BASE_URL}/api/gyms`, gymData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            Toast.show({ type: 'success', text1: 'Gym Created!', text2: `${gymName} added successfully.` });
            setGymName(''); setStreet(''); setCity(''); setPostalCode(''); setCountry('');

        } catch (err) {
            console.error("Failed to create gym:", err.response?.data || err.message);
            const errorMsg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.msg || 'Failed to create gym.';
            setError(errorMsg);
            Alert.alert('Error Saving Gym', errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ title: 'Add New Gym' }} />
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Register a New Gym</Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Text style={styles.label}>Gym Name*:</Text>
                <TextInput style={styles.input} value={gymName} onChangeText={setGymName} placeholder="e.g. Sporto klubas " />

                <Text style={styles.label}>Street Address:</Text>
                <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="e.g. Pramones pr." />

                <Text style={styles.label}>City:</Text>
                <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Kaunas" />

                <Text style={styles.label}>Postal Code:</Text>
                <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="e.g. 12345" />

                <Text style={styles.label}>Country:</Text>
                <TextInput style={styles.input} value={country} onChangeText={setCountry} placeholder="e.g. Lithuania" />

                <View style={styles.buttonContainer}>
                    {isLoading ? (
                        <ActivityIndicator size="large" />
                    ) : (
                        <Button title="Save Gym" onPress={handleSaveGym} />
                    )}
                    <View style={{ marginTop: 10 }} />
                    <Button title="Cancel / Back" onPress={() => router.back()} color="grey" />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { padding: 20, paddingBottom: 40 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', marginTop: 30 },
    label: { fontSize: 16, fontWeight: '500', marginBottom: 5 },
    input: { height: 45, borderColor: '#ccc', borderWidth: 1, marginBottom: 15, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#f9f9f9' },
    errorText: { color: 'red', textAlign: 'center', marginBottom: 10 },
    buttonContainer: { marginTop: 30 }
});