import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, SafeAreaView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter, Stack } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

import Toast from 'react-native-toast-message';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const experienceOptions = [{ label: 'Select...', value: null }];
for (let i = 0; i <= 20; i += 0.5) {
    const label = i === 1 ? `${i} year` : `${i} years`;
    experienceOptions.push({ label: label, value: i });
}

const reminderOptions = [
    { label: 'No Reminder', value: null },
    { label: '2 minutes (Test)', value: 2 },
    { label: '2 days', value: 2 * 24 * 60 },
    { label: '3 days', value: 3 * 24 * 60 },
    { label: '4 days', value: 4 * 24 * 60 },
    { label: '5 days', value: 5 * 24 * 60 },
    { label: '6 days', value: 6 * 24 * 60 },
    { label: '7 days', value: 7 * 24 * 60 },
];

export default function ProfileScreen() {
    const { user, token } = useAuth();
    const router = useRouter();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState(new Date());
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');

    const [experienceValue, setExperienceValue] = useState(null);
    const [reminderTimeValue, setReminderTimeValue] = useState(null);

    const [gyms, setGyms] = useState([]);
    const [gymsLoading, setGymsLoading] = useState(true);
    const [gymsError, setGymsError] = useState('');
    const [selectedGymId, setSelectedGymId] = useState(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);

    const fetchProfile = async () => {
        if (!token) return;
        setIsLoading(true);
        setGymsLoading(true);
        setError('');
        setGymsError('');
        try {
            const [profileResponse, gymsResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/profile/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_BASE_URL}/api/gyms`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            const profile = profileResponse.data;
            if (profile) {
                setName(profile.name || '');
                setEmail(profile.email || '');
                setDateOfBirth(profile.dateOfBirth ? new Date(profile.dateOfBirth) : new Date());
                setHeight(profile.height?.toString() || '');
                setWeight(profile.weight?.toString() || '');
                setExperienceValue(profile.experience === undefined ? null : profile.experience);
                setReminderTimeValue(profile.remindertime === undefined ? null : profile.remindertime);
                setSelectedGymId(profile.activeGymId || null);
            } else {
                setError('Could not load profile data.');
            }

            setGyms(gymsResponse.data || []);

        } catch (err) {
            setError('Failed to load profile data.');
        } finally {
            setIsLoading(false);
            setGymsLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [token])
    );

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || dateOfBirth;
        setShowDatePicker(Platform.OS === 'ios');
        setDateOfBirth(currentDate);
    };

    const handleUpdateProfile = async () => {
        if (!token) return;
        setIsSaving(true);
        setError('');

        const updatedData = {
            name: name || undefined,
            dateOfBirth: dateOfBirth.toISOString().split('T')[0],
            height: height ? parseFloat(height) : undefined,
            weight: weight ? parseFloat(weight) : undefined,
            experience: experienceValue,
            remindertime: reminderTimeValue,
            activeGymId: selectedGymId
        };

        Object.keys(updatedData).forEach(key => (updatedData[key] === undefined || updatedData[key] === null) && delete updatedData[key]);

        try {
            await axios.put(`${API_BASE_URL}/api/profile/me`, updatedData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Toast.show({ type: 'success', text1: 'Profile Updated!' });

            setIsSaving(false);

            if (router.canGoBack()) {
                router.back();
            }

        } catch (err) {
            const errorMsg = err.response?.data?.errors?.[0]?.msg || 'Failed to update profile. Please check your input.';
            setError(errorMsg);
            Alert.alert('Update Failed', errorMsg);
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <View style={styles.container}><ActivityIndicator size="large" /></View>;
    }

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <Text style={styles.title}>Your Profile</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Text style={styles.label}>Name:</Text>
            <TextInput style={styles.input} value={name} editable={false} onChangeText={setName} />

            <Text style={styles.label}>Email:</Text>
            <TextInput style={styles.input} value={email} editable={false} selectTextOnFocus={false} />

            <Text style={styles.label}>Date of Birth:</Text>
            <Button title={dateOfBirth.toLocaleDateString() || "Select Date"} onPress={() => setShowDatePicker(true)} />
            {showDatePicker && (
                <DateTimePicker
                    testID="datePicker" value={dateOfBirth} mode="date" display="default"
                    onChange={onDateChange} maximumDate={new Date()}
                />
            )}

            <Text style={styles.label}>Experience:</Text>
            <View style={styles.pickerContainer}>
                <Picker
                    selectedValue={experienceValue}
                    onValueChange={(itemValue, itemIndex) => setExperienceValue(itemValue)}
                    style={styles.picker}
                    prompt="Select Experience Level"
                >
                    {experienceOptions.map((option) => (
                        <Picker.Item key={option.value ?? '___null___'} label={option.label} value={option.value} />
                    ))}
                </Picker>
            </View>

            <Text style={styles.label}>Active Gym:</Text>
            <View style={styles.pickerContainer}>
                {gymsLoading ? (
                    <ActivityIndicator />
                ) : gymsError ? (
                    <Text style={styles.errorText}>{gymsError}</Text>
                ) : (
                    <Picker
                        selectedValue={selectedGymId}
                        onValueChange={(itemValue) => setSelectedGymId(itemValue)}
                        style={styles.picker}
                        enabled={!isSaving}
                    >
                        <Picker.Item label="-- Select Your Gym --" value={null} />
                        {gyms.map(gym => (
                            <Picker.Item key={gym._id} label={gym.name} value={gym._id} />
                        ))}
                    </Picker>
                )}
            </View>

            <Text style={styles.label}>Reminder Interval:</Text>
            <View style={styles.pickerContainer}>
                <Picker
                    selectedValue={reminderTimeValue}
                    onValueChange={(itemValue, itemIndex) => setReminderTimeValue(itemValue)}
                    style={styles.picker}
                    prompt="Select Reminder Interval"
                >
                    {reminderOptions.map((option) => (
                        <Picker.Item key={option.value ?? '___null___'} label={option.label} value={option.value} />
                    ))}
                </Picker>
            </View>

            <View style={styles.buttonContainer}>
                {isSaving ? (
                    <ActivityIndicator size="large" />
                ) : (
                    <Button title="Update Profile" onPress={handleUpdateProfile} />
                )}
            </View>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { padding: 20, paddingBottom: 40 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    label: { fontSize: 16, fontWeight: '500', marginTop: 15, marginBottom: 5 },
    input: { height: 45, borderColor: '#ccc', borderWidth: 1, marginBottom: 10, paddingHorizontal: 15, borderRadius: 8, fontSize: 16, backgroundColor: '#f9f9f9' },
    pickerContainer: { height: 50, justifyContent: 'center', borderColor: '#ccc', borderWidth: 1, borderRadius: 8, backgroundColor: '#f9f9f9', marginBottom: 10 },
    picker: { height: 50 },
    dateButton: { height: 45, justifyContent: 'center', borderColor: '#ccc', borderWidth: 1, marginBottom: 10, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#f9f9f9' },
    dateButtonText: { fontSize: 16 },
    errorText: { color: 'red', textAlign: 'center', marginVertical: 10 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    buttonContainer: { marginTop: 30 }
});