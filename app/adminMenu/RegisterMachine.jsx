import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, TextInput, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Toast from 'react-native-toast-message';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const exerciseTypeOptions = [
    { label: 'Select Type', value: '' },
    { label: 'Strength', value: 'Strength' },
    { label: 'Cardio', value: 'Cardio' },
    { label: 'Flexibility', value: 'Flexibility' },
    { label: 'Functional', value: 'Functional' },
    { label: 'Other', value: 'Other' },
];

const muscleGroupOptions = [
    { label: 'Select Muscle Group', value: '' },
    { label: 'Legs', value: 'Legs' },
    { label: 'Chest', value: 'Chest' },
    { label: 'Back', value: 'Back' },
    { label: 'Shoulders', value: 'Shoulders' },
    { label: 'Biceps', value: 'Biceps' },
    { label: 'Triceps', value: 'Triceps' },
    { label: 'Abs', value: 'Abs' },
    { label: 'Full Body', value: 'Full Body' },
    { label: 'Other', value: 'Other' },
];

export default function RegisterMachineScreen() {
    const { token } = useAuth();

    const [isRewritingTag, setIsRewritingTag] = useState(false);
    const [existingMachineData, setExistingMachineData] = useState(null);

    const [nfcSupported, setNfcSupported] = useState(true);
    const [isNfcEnabled, setIsNfcEnabled] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [scannedTagId, setScannedTagId] = useState(null);

    const [isFormVisible, setIsFormVisible] = useState(false);
    const [exerciseType, setExerciseType] = useState('');
    const [exerciseName, setExerciseName] = useState('');
    const [instructionsLink, setInstructionsLink] = useState('');
    const [trainedMuscle, setTrainedMuscle] = useState('');

    const [gyms, setGyms] = useState([]);
    const [gymsLoading, setGymsLoading] = useState(true);
    const [selectedGymId, setSelectedGymId] = useState('');
    const [fetchGymsError, setFetchGymsError] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkNfc = async () => {
            try {
                const supported = await NfcManager.isSupported();
                setNfcSupported(supported);
                if (supported) {
                    await NfcManager.start();
                    const enabled = await NfcManager.isEnabled();
                    setIsNfcEnabled(enabled);
                }
            } catch (ex) {
                setNfcSupported(false);
                setError('NFC check failed.');
            }
        };
        checkNfc();
    }, []);

    useFocusEffect(
        useCallback(() => {
            const fetchGyms = async () => {
                if (!token) return;
                setGymsLoading(true);
                setFetchGymsError('');
                try {
                    const response = await axios.get(`${API_BASE_URL}/api/gyms`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setGyms(response.data || []);
                } catch (err) {
                    setFetchGymsError("Could not load gym list.");
                } finally {
                    setGymsLoading(false);
                }
            };
            fetchGyms();
        }, [token])
    );

    const writeToTagAndLock = async (tagObject) => {
        if (!tagObject || !tagObject.isWritable) {
            return;
        }
        try {
            const bytes = Ndef.encodeMessage([Ndef.textRecord('sports-monitoring-app-tag')]);
            if (bytes) {
                await NfcManager.ndefHandler.writeNdefMessage(bytes);
            }
            await NfcManager.ndefHandler.makeReadOnly();
        } catch (writeError) {
            setError(`Failed to write message to tag: ${writeError.message}`);
        }
    };

    const processScannedTag = async (tagObject) => {
        const extractedId = tagObject.id;
        try {
            const response = await axios.get(`${API_BASE_URL}/api/machines/byTag/${extractedId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const machine = response.data;
            setExistingMachineData(machine);
            setIsRewritingTag(true);

            Alert.alert(
                "Tag Already Registered",
                `This tag is currently registered to:
                \nMachine: ${machine.exerciseName || 'N/A'}
                \nType: ${machine.exerciseType || 'N/A'}
                \nGym: ${machine.gymId?.name || machine.gymId || 'Unknown Gym'}
                \n\nDo you want to update its registration details?`,
                [
                    {
                        text: "No, Cancel", style: "cancel",
                        onPress: () => {
                            setScannedTagId(null);
                            setIsFormVisible(false);
                            setIsRewritingTag(false);
                            setExistingMachineData(null);
                            setError('Update cancelled.');
                        }
                    },
                    {
                        text: "Yes, Update Details",
                        onPress: async () => {
                            setScannedTagId(extractedId);
                            setExerciseName(machine.exerciseName || '');
                            setExerciseType(machine.exerciseType || '');
                            setTrainedMuscle(machine.trainedMuscle || '');
                            setSelectedGymId(machine.gymId?._id || machine.gymId || '');
                            setInstructionsLink(machine.instructionsLink || '');
                            await writeToTagAndLock(tagObject);
                            setIsFormVisible(true);
                            Toast.show({ type: 'info', text1: 'Ready to Update', text2: `Tag ID: ${extractedId}` });
                        }
                    }
                ]
            );
        } catch (checkError) {
            if (checkError.response && checkError.response.status === 404) {
                setIsRewritingTag(false);
                setExistingMachineData(null);
                setScannedTagId(extractedId);
                setExerciseName('');
                setExerciseType('');
                setTrainedMuscle('');
                setSelectedGymId('');
                setInstructionsLink('');
                await writeToTagAndLock(tagObject);
                setIsFormVisible(true);
                Toast.show({ type: 'success', text1: 'New Tag Scanned!', text2: `ID: ${extractedId}` });
            } else {
                setError(`Error checking tag status: ${checkError.response?.data?.msg || checkError.message}`);
                setScannedTagId(null);
                setIsFormVisible(false);
                setIsRewritingTag(false);
            }
        }
    };

    const handleScanPress = async () => {
        if (isScanning || !nfcSupported || !isNfcEnabled) {
            if (!nfcSupported) Alert.alert('NFC Error', 'NFC is not supported on this device.');
            if (!isNfcEnabled) Alert.alert('NFC Error', 'Please enable NFC in your device settings.');
            return;
        }

        setIsScanning(true);
        setScannedTagId(null);
        setIsFormVisible(false);
        setError('');
        setIsRewritingTag(false);
        setExistingMachineData(null);
        setExerciseName(''); setExerciseType(''); setTrainedMuscle(''); setSelectedGymId(''); setInstructionsLink('');

        let technologyRequested = false;
        try {
            await NfcManager.requestTechnology(NfcTech.Ndef);
            technologyRequested = true;
            const tag = await NfcManager.getTag();

            if (tag && tag.id) {
                await processScannedTag(tag);
            } else {
                throw new Error("Failed to retrieve valid tag information or ID.");
            }
        } catch (ex) {
            setError(`NFC Operation Failed: ${ex.message || 'Unknown error during scan/process'}`);
            setIsFormVisible(false);
            setScannedTagId(null);
        } finally {
            if (technologyRequested) {
                await NfcManager.cancelTechnologyRequest();
            }
            setIsScanning(false);
        }
    };

    const handleRegisterSubmit = async () => {
        if (!scannedTagId || !exerciseType || !exerciseName || !trainedMuscle || !selectedGymId) {
            Alert.alert('Missing Information', 'Please fill out all required fields (Type, Name, Muscle).');
            return;
        }
        if (!token) {
            Alert.alert('Error', 'You must be logged in to register a machine.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        const machineData = {
            tagId: scannedTagId,
            exerciseType,
            exerciseName,
            instructionsLink: instructionsLink || undefined,
            trainedMuscle,
            gymId: selectedGymId,
            allowRewrite: isRewritingTag
        };

        try {
            await axios.post(`${API_BASE_URL}/api/machines/register`, machineData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            Toast.show({ type: 'success', text1: 'Machine Registered!', text2: `${exerciseName} linked to tag.` });
            setScannedTagId(null);
            setIsFormVisible(false);
            setExerciseType('');
            setExerciseName('');
            setInstructionsLink('');
            setTrainedMuscle('');
            setSelectedGymId('');
            setIsRewritingTag(false);
            setExistingMachineData(null);

        } catch (err) {
            const errorMsg = err.response?.data?.errors?.[0]?.msg || 'Failed to register machine. Please try again.';
            setError(errorMsg);
            Alert.alert('Registration Failed', errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
            <Stack.Screen options={{ title: 'Register NFC Machine' }} />
            <Text style={styles.title}>Register New Machine/Exercise</Text>

            {!nfcSupported && <Text style={styles.errorText}>NFC is not supported on this device.</Text>}
            {nfcSupported && !isNfcEnabled && <Text style={styles.errorText}>Please enable NFC in your device settings.</Text>}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.section}>
                <Button
                    title={isScanning ? 'Scanning... Waiting for Tag' : 'Scan an NFC Tag'}
                    onPress={handleScanPress}
                    disabled={isScanning || !nfcSupported || !isNfcEnabled}
                />
                {isScanning && <ActivityIndicator style={styles.spacerTop} />}
            </View>

            {isFormVisible && scannedTagId && (
                <View style={[styles.section, styles.form]}>
                    <Text style={styles.label}>Scanned Tag ID:</Text>
                    <Text style={styles.tagIdText}>{scannedTagId}</Text>

                    <Text style={styles.label}>Exercise Type*:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={exerciseType}
                            onValueChange={(itemValue) => setExerciseType(itemValue)}
                            style={styles.picker}
                        >
                            {exerciseTypeOptions.map(opt => <Picker.Item key={opt.value} label={opt.label} value={opt.value} />)}
                        </Picker>
                    </View>

                    <Text style={styles.label}>Exercise/Machine Name*:</Text>
                    <TextInput style={styles.input} value={exerciseName} onChangeText={setExerciseName} placeholder="e.g., Leg Press Machine #2" />

                    <Text style={styles.label}>Trained Muscle Group*:</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={trainedMuscle}
                            onValueChange={(itemValue) => setTrainedMuscle(itemValue)}
                            style={styles.picker}
                        >
                            {muscleGroupOptions.map(opt => <Picker.Item key={opt.value} label={opt.label} value={opt.value} />)}
                        </Picker>
                    </View>

                    <Text style={styles.label}>Assign to Gym*:</Text>
                    <View style={styles.pickerContainer}>
                        {gymsLoading ? (
                            <ActivityIndicator />
                        ) : fetchGymsError ? (
                            <Text style={styles.errorText}>{fetchGymsError}</Text>
                        ) : (
                            <Picker
                                selectedValue={selectedGymId}
                                onValueChange={(itemValue) => setSelectedGymId(itemValue)}
                                style={styles.picker}
                                enabled={gyms.length > 0}
                            >
                                <Picker.Item label="Select Gym..." value="" />
                                {gyms.map(gym => (
                                    <Picker.Item key={gym._id} label={gym.name} value={gym._id} />
                                ))}
                            </Picker>
                        )}
                    </View>

                    <Text style={styles.label}>Instructions Link (Optional):</Text>
                    <TextInput style={styles.input} value={instructionsLink} onChangeText={setInstructionsLink} placeholder="https://example.com/video" keyboardType="url" />

                    <View style={styles.spacerTop}>
                        <Button
                            title={isSubmitting ? 'Registering...' : 'Register This Machine'}
                            onPress={handleRegisterSubmit}
                            disabled={isSubmitting || !selectedGymId}
                            color="#007AFF"
                        />
                        {isSubmitting && <ActivityIndicator style={styles.spacerTop} />}
                    </View>
                </View>
            )}
            <Toast />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollView: { flex: 1 },
    container: { padding: 20 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, marginTop: 25, textAlign: 'center' },
    section: { marginBottom: 25 },
    form: { marginTop: 15, padding: 15, borderWidth: 1, borderColor: '#eee', borderRadius: 8 },
    label: { fontSize: 16, fontWeight: '500', marginBottom: 5 },
    input: { height: 45, borderColor: '#ccc', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8, fontSize: 16, backgroundColor: '#f9f9f9' },
    pickerContainer: { borderColor: '#ccc', borderWidth: 1, borderRadius: 8, marginBottom: 15, backgroundColor: '#f9f9f9' },
    tagIdText: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#555' },
    errorText: { color: 'red', textAlign: 'center', marginVertical: 10 },
    spacerTop: { marginTop: 10 },
});