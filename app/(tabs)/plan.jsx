import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Button, Alert, Modal, SafeAreaView,
    TextInput, Pressable, Platform
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function PlanningScreen() {
    const { token, user, refreshUserProfile } = useAuth();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [selectedPlanDate, setSelectedPlanDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [currentView, setCurrentView] = useState('My Plans');
    const [plannedWorkout, setPlannedWorkout] = useState(null);
    const [coachWorkouts, setCoachWorkouts] = useState([]);
    const [settingsModalVisible, setSettingsModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingPrefs, setIsSavingPrefs] = useState(false);
    const [isMarkingComplete, setIsMarkingComplete] = useState(false);
    const [error, setError] = useState('');

    const [prefWorkoutType, setPrefWorkoutType] = useState(user?.preferences?.workoutType || 'Any');
    const [prefMuscleFocus, setPrefMuscleFocus] = useState(user?.preferences?.muscleFocus || 'Auto');
    const [prefNumExercises, setPrefNumExercises] = useState(user?.preferences?.numExercises || 5);
    const [prefRepRange, setPrefRepRange] = useState(user?.preferences?.repRange || '8-12');

    const fetchLatestPlan = useCallback(async () => {
        if (!token || currentView !== 'My Plans') return;
        setIsLoading(true); setError('');
        try {
            const response = await axios.get(`${API_BASE_URL}/api/workouts/latestPlanned`, { headers: { Authorization: `Bearer ${token}` } });
            setPlannedWorkout(response.data);
        } catch (err) {
            console.error("Failed fetch plan:", err.message);
            setError("Could not load your plan.");
            setPlannedWorkout(null);
        } finally {
            setIsLoading(false);
        }
    }, [token, currentView]);

    const fetchCoachPlans = useCallback(async () => {
        if (!token || currentView !== 'Coach Plans') return;
        setIsLoading(true); setError(''); setCoachWorkouts([]);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/workouts`, {
                headers: { Authorization: `Bearer ${token}` },
                params: { status: 'planned', isCoachAssigned: true }
            });
            setCoachWorkouts(response.data || []);
        } catch (err) {
            setError("Could not load coach plans.");
            setCoachWorkouts([]);
        } finally {
            setIsLoading(false);
        }
    }, [token, currentView]);

    useFocusEffect(
        useCallback(() => {
            if (currentView === 'My Plans') {
                fetchLatestPlan();
            } else if (currentView === 'Coach Plans') {
                fetchCoachPlans();
            }
        }, [currentView, fetchLatestPlan, fetchCoachPlans])
    );

    useEffect(() => {
        if (user?.preferences) {
            setPrefWorkoutType(user.preferences.workoutType || 'Any');
            setPrefMuscleFocus(user.preferences.muscleFocus || 'Auto');
            setPrefNumExercises(user.preferences.numExercises || 5);
            setPrefRepRange(user.preferences.repRange || '8-12');
        }
    }, [user]);

    const handleGenerateWorkout = async (useAI = false) => {
        if (!token) return;
        const url = useAI ? `${API_BASE_URL}/api/workouts/generateAI` : `${API_BASE_URL}/api/workouts/generate`;
        setIsGenerating(true); setError('');
        const planDateString = selectedPlanDate.toISOString().split('T')[0];

        try {
            const response = await axios.post(url,
                { planDate: planDateString },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPlannedWorkout(response.data);
            setCurrentView('My Plans');
            Toast.show({ type: 'success', text1: 'New Plan Generated!' });
        } catch (err) {
            Alert.alert('Error', err.response?.data?.msg || `Failed to generate workout.`);
        } finally { setIsGenerating(false); }
    };

    const handleSavePlan = async () => {
        if (!plannedWorkout?._id || !token) { Alert.alert("No Plan", "No plan to save."); return; }
        setIsSaving(true); setError('');
        try {
            const url = `${API_BASE_URL}/api/workouts/${plannedWorkout._id}`;
            await axios.put(url, { exercises: plannedWorkout.exercises }, { headers: { Authorization: `Bearer ${token}` } });
            Toast.show({ type: 'success', text1: 'Plan Saved!' });
        } catch (err) {
            Alert.alert('Error', err.response?.data?.msg || 'Failed to save plan.');
        } finally { setIsSaving(false); }
    };

    const handleSavePreferences = async () => {
        if (!token) return;
        setIsSavingPrefs(true);
        const preferencesToSave = {
            workoutType: prefWorkoutType,
            muscleFocus: prefMuscleFocus,
            numExercises: prefNumExercises,
            repRange: prefRepRange
        };
        try {
            await axios.put(`${API_BASE_URL}/api/profile/me`, { preferences: preferencesToSave }, { headers: { Authorization: `Bearer ${token}` } });
            if (refreshUserProfile) await refreshUserProfile();
            Toast.show({ type: 'success', text1: 'Preferences Saved!' });
            setSettingsModalVisible(false);
        } catch (err) {
            Alert.alert('Error', 'Could not save preferences.');
        } finally { setIsSavingPrefs(false); }
    };

    const handleMarkComplete = useCallback(async (workoutId, sourceView = 'Coach Plans') => {
        if (!workoutId || !token) return;
        Alert.alert(
            "Complete Workout?",
            "Mark this plan as completed?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Mark Done",
                    onPress: async () => {
                        setError('');
                        setIsMarkingComplete(true);
                        try {
                            await axios.put(`${API_BASE_URL}/api/workouts/${workoutId}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            Toast.show({ type: 'success', text1: 'Workout Marked Complete!' });
                            if (sourceView === 'My Plans') {
                                setPlannedWorkout(null);
                            } else {
                                fetchCoachPlans();
                            }
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.msg || 'Could not mark workout complete.');
                        } finally {
                            setIsMarkingComplete(false);
                        }
                    }
                }
            ]
        );
    }, [token, fetchCoachPlans, fetchLatestPlan]);

    const handleRemovePlan = useCallback((workoutId) => {
        if (!workoutId || !token) return;
        Alert.alert(
            "Remove Plan",
            "Are you sure you want to remove this assigned plan?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove", style: "destructive",
                    onPress: async () => {
                        setError('');
                        try {
                            await axios.delete(`${API_BASE_URL}/api/workouts/${workoutId}`, { headers: { Authorization: `Bearer ${token}` } });
                            Toast.show({ type: 'success', text1: 'Plan Removed' });
                            fetchCoachPlans();
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.msg || 'Could not remove plan.');
                        }
                    }
                }
            ]
        );
    }, [token, fetchCoachPlans]);

    const renderMyPlans = () => (
        <View style={styles.viewContainer}>
            <Pressable
                style={({ pressed }) => [styles.datePickerButton, (isGenerating || isLoading || pressed) && styles.buttonDisabled]}
                onPress={() => setShowDatePicker(true)}
                disabled={isGenerating || isLoading}
            >
                <MaterialIcons name="calendar-today" size={20} color="#333" />
                <Text style={styles.datePickerButtonText}>
                    Plan Date: {selectedPlanDate.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
            </Pressable>

            {showDatePicker && (
                <DateTimePicker
                    value={selectedPlanDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (date) {
                            setSelectedPlanDate(date);
                        }
                    }}
                    minimumDate={new Date()}
                />
            )}

            <View style={styles.actionButtons}>
                <Pressable
                    style={({ pressed }) => [styles.button, styles.generateButton, (isGenerating || isLoading || pressed) && styles.buttonDisabled]}
                    onPress={() => handleGenerateWorkout(false)}
                    disabled={isGenerating || isLoading}
                >
                    <MaterialIcons name="autorenew" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Generate New</Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [styles.button, styles.generateAiButton, (isGenerating || isLoading || pressed) && styles.buttonDisabled]}
                    onPress={() => handleGenerateWorkout(true)}
                    disabled={isGenerating || isLoading}
                >
                    <MaterialIcons name="auto-awesome" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Generate AI</Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [styles.button, styles.saveButton, (!plannedWorkout || isSaving || isGenerating || isLoading || pressed) && styles.buttonDisabled]}
                    onPress={handleSavePlan}
                    disabled={!plannedWorkout || isSaving || isGenerating || isLoading}
                >
                    <MaterialIcons name="save" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Save Plan</Text>
                </Pressable>
                <Pressable
                    style={[styles.button, styles.settingsButton]}
                    onPress={() => setSettingsModalVisible(true)}
                    disabled={isLoading}
                >
                    <MaterialIcons name="settings" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Settings</Text>
                </Pressable>
            </View>
            {isGenerating && <ActivityIndicator style={styles.loader} />}

            <Text style={styles.listTitle}>Latest Planned Workout</Text>
            {isLoading && !isGenerating && <ActivityIndicator style={styles.loader} />}
            {!isLoading && !plannedWorkout && <Text style={styles.infoText}>No planned workout found. Try generating one!</Text>}
            {plannedWorkout && (
                <View style={styles.workoutItem}>
                    <Text style={styles.workoutDate}>Plan for: {plannedWorkout.date} (Type: {plannedWorkout.workoutType})</Text>
                    <Text style={styles.listSubtitle}>Exercises ({plannedWorkout.exercises?.length || 0}):</Text>
                    {plannedWorkout.exercises?.map((ex, index) => (
                        <View key={ex._id || index} style={styles.exerciseItem}>
                            <Text style={styles.exerciseName}>{index + 1}. {ex.exerciseName}</Text>
                            {ex.repetitions !== undefined && <Text style={styles.exerciseAttribute}> Target Reps: {ex.repetitions}</Text>}
                            {ex.weight !== undefined && <Text style={styles.exerciseAttribute}> Target Weight: {ex.weight} {ex.weightUnit || 'kg'}</Text>}
                            {ex.exerciseType && <Text style={styles.exerciseAttribute}> Type: {ex.exerciseType}</Text>}
                            {ex.trainedMuscle && <Text style={styles.exerciseAttribute}> Muscle: {ex.trainedMuscle}</Text>}
                        </View>
                    ))}
                    {(!plannedWorkout.exercises || plannedWorkout.exercises.length === 0) && <Text style={styles.infoTextSmall}>No exercises in this plan yet.</Text>}

                    <View style={styles.myPlanActions}>
                        <Pressable
                            style={({ pressed }) => [styles.actionButton, styles.completeButton, (isMarkingComplete || pressed) && styles.buttonPressed]}
                            onPress={() => handleMarkComplete(plannedWorkout._id, 'My Plans')} 
                            disabled={isMarkingComplete}
                        >
                            {isMarkingComplete ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <MaterialIcons name="check-circle-outline" size={18} color="#fff" />
                            )}
                            <Text style={styles.actionButtonText}>Mark Done</Text>
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    );

    const renderCoachPlans = () => (
        <View style={styles.viewContainer}>
            <Text style={styles.listTitle}>Workouts Assigned by Coach</Text>
            {isLoading && <ActivityIndicator style={styles.loader} />}
            {error && !isLoading && <Text style={styles.errorText}>{error}</Text>}
            {!isLoading && coachWorkouts.length === 0 && (
                <Text style={styles.infoText}>No workout plans currently assigned by your coach.</Text>
            )}
            {coachWorkouts.map((workout) => (
                <View key={workout._id} style={styles.coachWorkoutItem}>
                    <View style={styles.coachWorkoutInfo}>
                        <Text style={styles.workoutDate}>Plan for: {workout.date} (Type: {workout.workoutType})</Text>
                        <Text style={styles.listSubtitleSmall}>Exercises ({workout.exercises?.length || 0}):</Text>
                        {workout.exercises?.slice(0, 3).map((ex, index) => (
                            <View key={ex._id || index} style={styles.exerciseItemMinimal}>
                                <Text style={styles.exerciseNameSmall}>{index + 1}. {ex.exerciseName}</Text>
                                {ex.repetitions !== undefined && <Text style={styles.exerciseAttributeSmall}> Reps: {ex.repetitions}</Text>}
                                {ex.weight !== undefined && <Text style={styles.exerciseAttributeSmall}> Weight: {ex.weight} {ex.weightUnit || 'kg'}</Text>}
                            </View>
                        ))}
                        {workout.exercises?.length > 3 && <Text style={styles.infoTextSmall}>...and more</Text>}
                        {(!workout.exercises || workout.exercises.length === 0) && <Text style={styles.infoTextSmall}>No specific exercises listed.</Text>}
                    </View>
                    <View style={styles.coachActionButtons}>
                        <Pressable
                            style={({ pressed }) => [styles.actionButton, styles.completeButton, pressed && styles.buttonPressed]}
                            onPress={() => handleMarkComplete(workout._id, 'Coach Plans')}
                        >
                            <MaterialIcons name="check-circle-outline" size={18} color="#fff" />
                            <Text style={styles.actionButtonText}>Mark Done</Text>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.actionButton, styles.removePlanButton, pressed && styles.buttonPressed]}
                            onPress={() => handleRemovePlan(workout._id)}
                        >
                            <MaterialIcons name="delete-forever" size={18} color="#fff" />
                            <Text style={styles.actionButtonText}>Remove</Text>
                        </Pressable>
                    </View>
                </View>
            ))}
        </View>
    );

    return (
        <View style={styles.outerContainer}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 70 }]}
            >
                <Stack.Screen options={{ title: 'Plan' }} />
                <Text style={styles.title}>Workout Planning</Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {currentView === 'My Plans' ? renderMyPlans() : renderCoachPlans()}

            </ScrollView>

            <View style={[styles.segmentedControlContainer, { paddingBottom: insets.bottom || 10 }]}>
                <SegmentedControl
                    values={['My Plans', 'Coach Plans']}
                    selectedIndex={currentView === 'My Plans' ? 0 : 1}
                    onChange={(event) => {
                        const selectedIndex = event.nativeEvent.selectedSegmentIndex;
                        const values = ['My Plans', 'Coach Plans'];
                        if (typeof selectedIndex === 'number') setCurrentView(values[selectedIndex]);
                    }}
                    enabled={!isLoading && !isGenerating && !isSaving && !isSavingPrefs}
                    style={{ opacity: (!isLoading && !isGenerating && !isSaving && !isSavingPrefs) ? 1 : 0.6 }}
                />
            </View>

            <Modal
                animationType="slide"
                visible={settingsModalVisible}
                onRequestClose={() => setSettingsModalVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <ScrollView contentContainerStyle={styles.modalContent}>
                        <Text style={styles.modalTitle}>Generation Preferences</Text>

                        <Text style={styles.label}>Preferred Workout Type:</Text>
                        <View style={styles.pickerContainerModal}>
                            <Picker selectedValue={prefWorkoutType} onValueChange={setPrefWorkoutType} style={styles.picker}>
                                <Picker.Item label="Any" value="Any" />
                                <Picker.Item label="Strength" value="Strength" />
                                <Picker.Item label="Cardio" value="Cardio" />
                                <Picker.Item label="Mixed" value="Mixed" />
                            </Picker>
                        </View>

                        <Text style={styles.label}>Muscle Focus:</Text>
                        <View style={styles.pickerContainerModal}>
                            <Picker selectedValue={prefMuscleFocus} onValueChange={setPrefMuscleFocus} style={styles.picker}>
                                <Picker.Item label="Auto (Based on History)" value="Auto" />
                                <Picker.Item label="Full Body" value="Full Body" />
                                <Picker.Item label="Legs" value="Legs" />
                                <Picker.Item label="Chest" value="Chest" />
                                <Picker.Item label="Back" value="Back" />
                                <Picker.Item label="Shoulders" value="Shoulders" />
                                <Picker.Item label="Biceps" value="Biceps" />
                                <Picker.Item label="Triceps" value="Triceps" />
                                <Picker.Item label="Abs" value="Abs" />
                            </Picker>
                        </View>

                        <Text style={styles.label}>Target Exercises per Workout:</Text>
                        <TextInput
                            style={styles.input}
                            value={prefNumExercises === null || prefNumExercises === 0 ? '' : String(prefNumExercises)}
                            onChangeText={(text) => {
                                const parsedNum = parseInt(text, 10);
                                if (text === '') {
                                    setPrefNumExercises(null);
                                } else if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 20) {
                                    setPrefNumExercises(parsedNum);
                                }
                            }}
                            placeholder="e.g., 5"
                            keyboardType="numeric"
                            maxLength={2}
                        />

                        {(prefWorkoutType === 'Strength' || prefWorkoutType === 'Any' || prefWorkoutType === 'Mixed') && (
                            <>
                                <Text style={styles.label}>Preferred Rep Range (Strength):</Text>
                                <View style={styles.pickerContainerModal}>
                                    <Picker selectedValue={prefRepRange} onValueChange={setPrefRepRange} style={styles.picker}>
                                        <Picker.Item label="Hypertrophy (8-12)" value="8-12" />
                                        <Picker.Item label="Strength (5-8)" value="5-8" />
                                        <Picker.Item label="Endurance (12-15+)" value="12-15" />
                                    </Picker>
                                </View>
                            </>
                        )}

                        <View style={styles.modalButtonContainer}>
                            {isSavingPrefs ? <ActivityIndicator /> : <Button title="Save Preferences" onPress={handleSavePreferences} />}
                            <View style={{ marginTop: 10 }} />
                            <Button title="Cancel" onPress={() => setSettingsModalVisible(false)} color="grey" />
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            <Toast />
        </View>
    );
}

const styles = StyleSheet.create({
    outerContainer: { flex: 1 },
    scrollView: { flex: 1 },
    container: { paddingHorizontal: 10, paddingBottom: 90 },
    viewContainer: { paddingHorizontal: 5 },
    title: { fontSize: 24, fontWeight: 'bold', marginVertical: 15, textAlign: 'center', color: '#333' },
    loader: { marginVertical: 20 },
    errorText: { color: 'red', textAlign: 'center', marginVertical: 10, fontSize: 14 },
    infoText: { textAlign: 'center', marginTop: 20, color: 'grey', fontSize: 15 },
    infoTextSmall: { textAlign: 'center', marginTop: 5, color: 'grey', fontSize: 13 },
    segmentedControlContainer: { padding: 15, backgroundColor: '#f0f0f0', borderTopWidth: 1, borderTopColor: '#ccc' },
    actionButtons: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: 10, paddingHorizontal: 5, flexWrap: 'wrap', gap: 10 },
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, elevation: 2, marginHorizontal: 5, marginVertical: 5 },
    buttonText: { color: 'white', fontSize: 14, fontWeight: '500', marginLeft: 8, textAlign: 'center' },
    generateButton: { backgroundColor: '#007AFF' },
    generateAiButton: { backgroundColor: '#5856D6' },
    saveButton: { backgroundColor: '#34C759' },
    settingsButton: { backgroundColor: '#8E8E93' },
    buttonDisabled: { opacity: 0.6 },
    listTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 10, paddingHorizontal: 5 },
    listSubtitle: { fontSize: 16, fontWeight: '600', marginTop: 10, marginBottom: 5 },
    workoutItem: { padding: 15, marginBottom: 10, backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
    workoutDate: { fontWeight: 'bold', marginBottom: 5, fontSize: 15, color: '#333' },
    exerciseItem: { marginLeft: 0, marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingLeft: 8 },
    exerciseName: { fontSize: 15, fontWeight: '500' },
    exerciseAttribute: { fontSize: 13, color: '#555', marginLeft: 5 },
    coachWorkoutItem: { padding: 15, marginBottom: 10, backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
    coachWorkoutInfo: { marginBottom: 10 },
    listSubtitleSmall: { fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 4 },
    exerciseItemMinimal: { paddingLeft: 8, marginBottom: 3 },
    exerciseNameSmall: { fontSize: 13, fontWeight: 'normal' },
    exerciseAttributeSmall: { fontSize: 12, color: '#555', marginLeft: 5 },
    coachActionButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 5, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
    actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 5, marginLeft: 10, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 1 },
    actionButtonText: { color: '#fff', marginLeft: 5, fontSize: 13, fontWeight: '500' },
    completeButton: { backgroundColor: '#5cb85c' },
    removePlanButton: { backgroundColor: '#d9534f' },
    buttonPressed: { opacity: 0.8 },
    modalContainer: { flex: 1, backgroundColor: '#fff' },
    modalContent: { padding: 20, paddingBottom: 40 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    modalButtonContainer: { marginTop: 25, marginBottom: 50 },
    label: { fontSize: 16, fontWeight: '500', marginTop: 15, marginBottom: 5 },
    input: { height: 45, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 15, backgroundColor: '#fff', fontSize: 16 },
    pickerContainerModal: { height: 50, justifyContent: 'center', borderColor: '#ccc', borderWidth: 1, borderRadius: 8, backgroundColor: '#fff', marginBottom: 15 },
    picker: { height: 50 },
    datePickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#e0e0e0', borderRadius: 8, marginVertical: 15, alignSelf: 'center' },
    datePickerButtonText: { color: '#333', fontSize: 16, fontWeight: '500', marginLeft: 10 },
});
