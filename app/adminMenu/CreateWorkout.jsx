import React, { useState, useEffect, useCallback } from 'react';
import {View, Text, TextInput, Button, StyleSheet, FlatList, ActivityIndicator, Alert, Platform, SafeAreaView, Pressable} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function AssignWorkoutScreen() {
    const { token, user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [clientEmail, setClientEmail] = useState('');
    const [planDate, setPlanDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [machineListItems, setMachineListItems] = useState([]);

    const [machinesLoading, setMachinesLoading] = useState(true);
    const [machinesError, setMachinesError] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [error, setError] = useState('');

    const fetchMachinesForTrainerGym = useCallback(async () => {
        const trainerActiveGymId = user?.activeGymId;
        if (!token || !trainerActiveGymId) {
            setMachinesError("Set active gym in profile"); setAvailableMachines([]); return;
        }
        setMachinesLoading(true); setMachinesError('');
        try {
            const response = await axios.get(`${API_BASE_URL}/api/machines`, {
                headers: { Authorization: `Bearer ${token}` }, params: { gymId: trainerActiveGymId }
            });
            setMachineListItems((response.data || []).map(machine => ({
                machine: machine,
                isSelected: false,
                targetReps: ''
            })));
        } catch (err) {
            console.error("Failed fetch machines:", err); setMachinesError("Could not load machines."); setMachineListItems([]);
        } finally { setMachinesLoading(false); }
    }, [token, user?.activeGymId]);

    useEffect(() => { fetchMachinesForTrainerGym(); }, [fetchMachinesForTrainerGym]);

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || planDate;
        setShowDatePicker(Platform.OS === 'ios');
        setPlanDate(currentDate);
    };

    const toggleExerciseSelection = (machineId) => {
        setMachineListItems(currentItems =>
            currentItems.map(item => {
                if (item.machine._id === machineId) {
                    const newSelectedState = !item.isSelected;
                    return { ...item, isSelected: newSelectedState, targetReps: newSelectedState ? item.targetReps : '' };
                }
                return item;
            })
        );
    };

    const updateTargetReps = (machineId, repsText) => {
        setMachineListItems(currentItems =>
            currentItems.map(item =>
                item.machine._id === machineId ? { ...item, targetReps: repsText } : item
            )
        );
    };

    const handleAssignPlan = async () => {
        setError('');
        if (!clientEmail.trim() || !/\S+@\S+\.\S+/.test(clientEmail)) { Alert.alert('Validation Error', 'Valid client email required.'); return; }
        if (!planDate) { Alert.alert('Validation Error', 'Please select a date.'); return; }

        const selectedExercisesPayload = machineListItems
            .filter(item => item.isSelected)
            .map(item => {
                const parsedReps = item.targetReps ? parseInt(item.targetReps, 10) : undefined;
                return {
                    machineId: item.machine._id,
                    exerciseName: item.machine.exerciseName,
                    exerciseType: item.machine.exerciseType,
                    trainedMuscle: item.machine.trainedMuscle,
                    ...(Number.isInteger(parsedReps) && parsedReps >= 0 && { repetitions: parsedReps }),
                    weightUnit: 'kg'
                };
            });

        if (!token) { Alert.alert('Error', 'Auth error.'); return; }

        setIsAssigning(true);
        const planDateString = planDate.toLocaleDateString('sv-SE');

        try {
            await axios.post(`${API_BASE_URL}/api/workouts/assignPlan`,
                { clientEmail: clientEmail.trim(), planDate: planDateString, exercises: selectedExercisesPayload },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Toast.show({ type: 'success', text1: 'Plan Assigned!', text2: `Workout assigned to ${clientEmail} for ${planDateString}` });
            setClientEmail(''); setPlanDate(new Date());
            setMachineListItems(currentItems => currentItems.map(item => ({ ...item, isSelected: false, targetReps: '' })));
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to assign plan.');
            Alert.alert('Assignment Failed', error);
        } finally { setIsAssigning(false); }
    };

    const MachineListItem = ({ item }) => (
        <View style={styles.listItem}>
            <View style={styles.itemTextContainer}>
                <Text style={styles.itemName}>{item.machine.exerciseName}</Text>
                <Text style={styles.itemDetail}>Type: {item.machine.exerciseType} | Muscle: {item.machine.trainedMuscle}</Text>
                {item.isSelected && item.machine.exerciseType === 'Strength' && (
                    <View style={styles.repsInputContainer}>
                        <Text style={styles.labelSmall}>Target Reps:</Text>
                        <TextInput
                            style={styles.inputSmall}
                            value={item.targetReps}
                            onChangeText={(text) => updateTargetReps(item.machine._id, text)}
                            keyboardType="numeric"
                            placeholder="e.g., 10"
                            maxLength={3}
                        />
                    </View>
                )}
            </View>
            <Button
                title={item.isSelected ? "Remove" : "Add"}
                onPress={() => toggleExerciseSelection(item.machine._id)}
                color={item.isSelected ? "orange" : "#007AFF"}
            />
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <Stack.Screen options={{ title: 'Assign Workout Plan' }} />
            <FlatList
                ListHeaderComponent={
                    <>
                        <Text style={styles.title}>Assign Plan to User</Text>
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        <View style={styles.inputSection}>
                            <Text style={styles.label}>Client Email:</Text>
                            <TextInput style={styles.input} value={clientEmail} onChangeText={setClientEmail} keyboardType="email-address" autoCapitalize="none" placeholder="user@example.com" />

                            <Text style={styles.label}>Date:</Text>
                            <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
                                <Text style={styles.dateButtonText}>{planDate.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) || "Select Date"}</Text>
                            </Pressable>
                            {showDatePicker && (<DateTimePicker value={planDate} mode="date" display="default" onChange={onDateChange} minimumDate={new Date()} />)}

                            <Text style={styles.sectionTitle}>Select Machines/Exercises from Your Gym</Text>
                            {machinesLoading && <ActivityIndicator />}
                            {machinesError ? <Text style={styles.errorText}>{machinesError}</Text> : null}
                            {!machinesLoading && machineListItems.length === 0 && !machinesError && <Text style={styles.infoText}>No machines found.</Text>}
                        </View>
                    </>
                }
                data={machineListItems}
                renderItem={MachineListItem}
                keyExtractor={(item) => item.machine._id}
                contentContainerStyle={[styles.listContentContainer, { paddingBottom: insets.bottom + 80 }]}
                ListEmptyComponent={
                    !machinesLoading && machineListItems.length === 0 ? (
                        <Text style={styles.infoText}>No available machines to list.</Text>
                    ) : null
                }
            />
            {machineListItems.length > 0 && (
                <View style={[styles.buttonContainer, { paddingBottom: insets.bottom || 10 }]}>
                    {isAssigning ? (
                        <ActivityIndicator size="large" color="#007AFF" />
                    ) : (
                        <Button
                            title="Assign Plan to User"
                            onPress={handleAssignPlan}
                            disabled={isAssigning || !machineListItems.some(item => item.isSelected)}
                            color="#34C759"
                        />
                    )}
                </View>
            )}

            <Toast />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    listContentContainer: { padding: 15, paddingBottom: 20 },
    inputSection: { marginBottom: 15 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, marginTop: 20, textAlign: 'center' },
    label: { fontSize: 16, fontWeight: '500', marginTop: 10, marginBottom: 5 },
    labelSmall: { fontSize: 14, fontWeight: 'normal', marginRight: 5 },
    input: { height: 45, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 15, backgroundColor: '#fff', fontSize: 16 },
    inputSmall: { height: 35, width: 60, borderColor: '#ccc', borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 5, backgroundColor: '#fff', fontSize: 14 },
    dateButton: { height: 45, justifyContent: 'center', borderColor: '#ccc', borderWidth: 1, marginBottom: 15, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#fff' },
    dateButtonText: { fontSize: 16 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
    listLoader: { marginVertical: 20 },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
    itemTextContainer: { flex: 1, marginRight: 10 },
    itemName: { fontSize: 15, fontWeight: '500' },
    itemDetail: { fontSize: 12, color: 'grey', marginTop: 2 },
    repsInputContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    removeButton: { padding: 5 },
    removeButtonText: { color: 'orange', fontSize: 18, fontWeight: 'bold' },
    errorText: { color: 'red', textAlign: 'center', marginVertical: 10, padding: 10 },
    infoText: { textAlign: 'center', fontStyle: 'italic', color: 'grey', paddingVertical: 15 },
    buttonContainer: { padding: 15, paddingTop: 10, backgroundColor: '#f8f8f8', borderTopWidth: 1, borderTopColor: '#ccc' },
});