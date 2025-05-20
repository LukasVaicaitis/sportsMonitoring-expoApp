import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, ActivityIndicator, Modal, Pressable, Platform, Button, SafeAreaView,
    RefreshControl, TextInput, Alert } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Calendar, CalendarUtils } from 'react-native-calendars';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

const WORKOUT_COLORS = {
    Strength: '#d9534f', Cardio: '#0275d8', Flexibility: '#5cb85c',
    Mixed: '#f0ad4e', Other: '#6c757d', default: '#5bc0de'
};

const checkMuscleFilterMatch = (exercises = [], muscleFilter) => {
    if (!exercises || exercises.length === 0 || muscleFilter === 'All') return true;
    const upper = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'];
    const lower = ['Legs', 'Glutes', 'Quads', 'Hamstrings', 'Calves'];
    const core = ['Abs', 'Core'];
    const full = ['Full Body'];
    const muscles = exercises.map(ex => ex.trainedMuscle).filter(Boolean);
    if (muscles.some(m => full.includes(m))) { if (['Full Body', 'Upper Body', 'Lower Body'].includes(muscleFilter)) return true; }
    const hasUpper = muscles.some(m => upper.includes(m));
    const hasLower = muscles.some(m => lower.includes(m));
    const hasCore = muscles.some(m => core.includes(m));
    switch (muscleFilter) {
        case 'Upper Body': return hasUpper;
        case 'Lower Body': return hasLower;
        case 'Full Body': return hasUpper && hasLower;
        case 'Abs': return hasCore;
        default: return false;
    }
};

const formatDisplayTime = (dateString) => {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return 'Invalid Date'; }
};

export default function HistoryScreen() {
    const { token, user, refreshUserProfile } = useAuth();
    const insets = useSafeAreaInsets();

    const [currentMonthDate, setCurrentMonthDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
    const [workoutsInMonth, setWorkoutsInMonth] = useState([]);
    const [markedDates, setMarkedDates] = useState({});
    const [workoutTypeFilter, setWorkoutTypeFilter] = useState('All');
    const [muscleFilter, setMuscleFilter] = useState('All');

    const [modalVisible, setModalVisible] = useState(false);
    const [selectedWorkoutData, setSelectedWorkoutData] = useState(null);
    const [addExerciseModalVisible, setAddExerciseModalVisible] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [editingExerciseId, setEditingExerciseId] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSavingExercise, setIsSavingExercise] = useState(false);
    const [error, setError] = useState('');

    const [newExerciseName, setNewExerciseName] = useState('');
    const [newExerciseType, setNewExerciseType] = useState('');
    const [newTrainedMuscle, setNewTrainedMuscle] = useState('');
    const [newStartTime, setNewStartTime] = useState(new Date());
    const [newEndTime, setNewEndTime] = useState(new Date());
    const [newReps, setNewReps] = useState('');
    const [newWeight, setNewWeight] = useState('');
    const [newWeightUnit, setNewWeightUnit] = useState('kg');
    const [showNewStartTimePicker, setShowNewStartTimePicker] = useState(false);
    const [showNewEndTimePicker, setShowNewEndTimePicker] = useState(false);

    const fetchWorkoutsForMonth = useCallback(async (isManualRefresh = false) => {
        if (!token) return;
        if (!isManualRefresh) setIsLoading(true);
        setError('');
        const year = currentMonthDate.getFullYear();
        const month = currentMonthDate.getMonth() + 1;
        try {
            const response = await axios.get(`${API_BASE_URL}/api/workouts`, {
                headers: { Authorization: `Bearer ${token}` }, params: { year, month }
            });
            setWorkoutsInMonth(response.data || []);
        } catch (err) {
            setError("Could not load workout history.");
            setWorkoutsInMonth([]);
        } finally {
            if (!isManualRefresh) setIsLoading(false);
        }
    }, [currentMonthDate, token]);

    
    useFocusEffect(
        useCallback(() => {
            fetchWorkoutsForMonth();
        }, [fetchWorkoutsForMonth])
    );

    const filteredWorkouts = useMemo(() => {
        return workoutsInMonth.filter(workout => {
            const typeMatch = workoutTypeFilter === 'All' || workout.workoutType === workoutTypeFilter;
            const muscleMatch = checkMuscleFilterMatch(workout.exercises, muscleFilter);
            return typeMatch && muscleMatch;
        });
    }, [workoutsInMonth, workoutTypeFilter, muscleFilter]);

    useEffect(() => {
        const newMarkedDates = {};
        filteredWorkouts.forEach(workout => {
            const dateString = workout.date;
            if (!dateString || newMarkedDates[dateString]) return;
            const workoutType = workout.workoutType || 'default';
            const bgColor = WORKOUT_COLORS[workoutType] || WORKOUT_COLORS.default;
            newMarkedDates[dateString] = {
                customStyles: {
                    container: { backgroundColor: bgColor, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
                    text: { color: 'white', fontWeight: 'bold' },
                },
            };
        });
        setMarkedDates(newMarkedDates);
    }, [filteredWorkouts]);

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        setError('');
        await fetchWorkoutsForMonth(true);
        setIsRefreshing(false);
    }, [fetchWorkoutsForMonth]);

    const handleMonthChange = (month) => {
        const newMonthDate = new Date(month.timestamp);
        newMonthDate.setDate(1);
        newMonthDate.setHours(12, 0, 0, 0);
        setCurrentMonthDate(newMonthDate);
    };

    const handleDayPress = (day) => {
        setError('');
        const workoutForDay = workoutsInMonth.find(workout => workout.date === day.dateString);
        if (workoutForDay) {
            setSelectedWorkoutData(workoutForDay);
            setModalVisible(true);
        } else {
            setSelectedWorkoutData(null);
            Toast.show({ type: 'info', text1: 'No Workout', text2: `No workout recorded for ${day.dateString}.` });
        }
    };

    const handleAddExercisePress = () => {
        if (!selectedWorkoutData) return;
        setModalMode('add');
        setEditingExerciseId(null);
        setNewExerciseName(''); setNewExerciseType(''); setNewTrainedMuscle('');
        const now = new Date();
        setNewStartTime(now); setNewEndTime(new Date(now.getTime() + 15 * 60000));
        setNewReps(''); setNewWeight(''); setNewWeightUnit('kg');
        setError('');
        setAddExerciseModalVisible(true);
    };

    const handleEditExercisePress = (exercise) => {
        if (!exercise) return;
        setModalMode('edit');
        setEditingExerciseId(exercise._id);
        setNewExerciseName(exercise.exerciseName || '');
        setNewExerciseType(exercise.exerciseType || '');
        setNewTrainedMuscle(exercise.trainedMuscle || '');
        setNewStartTime(exercise.startTime ? new Date(exercise.startTime) : new Date());
        setNewEndTime(exercise.endTime ? new Date(exercise.endTime) : new Date());
        setNewReps(exercise.repetitions?.toString() || '');
        setNewWeight(exercise.weight?.toString() || '');
        setNewWeightUnit(exercise.weightUnit || 'kg');
        setError('');
        setAddExerciseModalVisible(true);
    };

    const handleRemoveExercisePress = (exerciseId) => {
        if (!selectedWorkoutData?._id || !exerciseId || !token) return;
        Alert.alert("Confirm Delete", "Are you sure?",
            [{ text: "Cancel", style: "cancel" }, {
                text: "Remove", style: "destructive",
                onPress: async () => {
                    try {
                        const url = `${API_BASE_URL}/api/workouts/${selectedWorkoutData._id}/exercises/${exerciseId}`;
                        const response = await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
                        if (response.data?.workout) {
                            setSelectedWorkoutData(response.data.workout);
                        } else {
                            await fetchWorkoutsForMonth(true);
                            const refreshed = workoutsInMonth.find(w => w._id === selectedWorkoutData._id);
                            setSelectedWorkoutData(refreshed || null);
                            if (!refreshed) setModalVisible(false);
                        }
                        Toast.show({ type: 'success', text1: 'Exercise Removed' });
                    } catch (err) {
                        Alert.alert('Failed to remove exercise.' + err?.message);
                    }
                }
            }]
        );
    };

    const handleSaveExercise = async () => {
        if (!selectedWorkoutData?._id || !token) return;
        if (!newExerciseName || !newExerciseType || !newTrainedMuscle || !newStartTime || !newEndTime) {
            Alert.alert('Missing Info', 'Please fill in Name, Type, Muscle, Start, and End Time.'); return;
        }
        if (newEndTime <= newStartTime) { Alert.alert('Invalid Time', 'End time must be after start time.'); return; }

        setIsSavingExercise(true); setError('');
        const durationSeconds = Math.max(0, Math.floor((newEndTime.getTime() - newStartTime.getTime()) / 1000));
        const parsedReps = newReps ? parseInt(newReps, 10) : undefined;
        const parsedWeight = newWeight ? parseFloat(newWeight) : undefined;

        const exerciseData = {
            exerciseName: newExerciseName, exerciseType: newExerciseType, trainedMuscle: newTrainedMuscle,
            startTime: newStartTime.toISOString(), endTime: newEndTime.toISOString(), durationSeconds,
            ...(Number.isInteger(parsedReps) && parsedReps >= 0 && { repetitions: parsedReps }),
            ...(Number.isFinite(parsedWeight) && parsedWeight >= 0 && { weight: parsedWeight }),
            weightUnit: newWeightUnit,
        };
        Object.keys(exerciseData).forEach(key => exerciseData[key] === undefined && delete exerciseData[key]);

        try {
            let response; let successMessage = ''; let url = '';
            if (modalMode === 'edit' && editingExerciseId) {
                url = `${API_BASE_URL}/api/workouts/${selectedWorkoutData._id}/exercises/${editingExerciseId}`;
                response = await axios.put(url, exerciseData, { headers: { Authorization: `Bearer ${token}` } });
                successMessage = 'Exercise Updated!';
            } else {
                url = `${API_BASE_URL}/api/workouts/${selectedWorkoutData._id}/exercises`;
                response = await axios.post(url, exerciseData, { headers: { Authorization: `Bearer ${token}` } });
                successMessage = 'Exercise Added!';
            }
            Toast.show({ type: 'success', text1: successMessage });
            setAddExerciseModalVisible(false);
            if (response.data?.workout) { setSelectedWorkoutData(response.data.workout); }
            else { await fetchWorkoutsForMonth(true); }
            setModalMode('add'); setEditingExerciseId(null);
        } catch (err) {
            Alert.alert(`Failed to ${modalMode} exercise.`);
        } finally { setIsSavingExercise(false); }
    };

    return (
        <View style={styles.outerContainer}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.container, { paddingTop: insets.top + 10 }]}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#007AFF"]} tintColor="#007AFF" />}
            >
                <Stack.Screen options={{ title: 'History' }} />
                <Text style={styles.title}>History</Text>

                <Calendar
                    current={CalendarUtils.getCalendarDateString(currentMonthDate)}
                    onMonthChange={handleMonthChange}
                    markingType={'custom'}
                    markedDates={markedDates}
                    onDayPress={handleDayPress}
                    firstDay={1}
                    enableSwipeMonths={true}
                    theme={styles.calendarTheme}
                />

                {isLoading && !isRefreshing && <ActivityIndicator size="large" style={styles.loader} />}
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={styles.filters}>
                    <View style={styles.filterRow}>
                        <Text style={styles.filterLabel}>Type:</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={workoutTypeFilter} onValueChange={setWorkoutTypeFilter} style={styles.picker} enabled={!isLoading}>
                                <Picker.Item label="All Types" value="All" />
                                <Picker.Item label="Strength" value="Strength" />
                                <Picker.Item label="Cardio" value="Cardio" />
                                <Picker.Item label="Flexibility" value="Flexibility" />
                                <Picker.Item label="Mixed" value="Mixed" />
                                <Picker.Item label="Other" value="Other" />
                            </Picker>
                        </View>
                    </View>
                    <View style={styles.filterRow}>
                        <Text style={styles.filterLabel}>Muscle:</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={muscleFilter} onValueChange={setMuscleFilter} style={styles.picker} enabled={!isLoading}>
                                <Picker.Item label="All Muscles" value="All" />
                                <Picker.Item label="Upper Body" value="Upper Body" />
                                <Picker.Item label="Lower Body" value="Lower Body" />
                                <Picker.Item label="Full Body" value="Full Body" />
                                <Picker.Item label="Abs" value="Abs" />
                            </Picker>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <Modal
                animationType="slide" visible={modalVisible}
                onRequestClose={() => { setModalVisible(false); setSelectedWorkoutData(null); }}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <ScrollView>
                        {selectedWorkoutData ? (
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Workout Details</Text>
                                <Text style={styles.modalDate}>Date: {selectedWorkoutData.date}</Text>
                                <Text style={styles.modalDetail}>Type: {selectedWorkoutData.workoutType || 'N/A'}</Text>
                                <Text style={styles.modalDetail}>Status: {selectedWorkoutData.status}</Text>
                                <Text style={styles.modalDetail}>Started: {formatDisplayTime(selectedWorkoutData.startTime)}</Text>
                                <Text style={styles.modalDetail}>Ended: {formatDisplayTime(selectedWorkoutData.endTime) || 'N/A'}</Text>

                                <View style={styles.exercisesHeader}>
                                    <Text style={styles.modalSubtitle}>Exercises ({selectedWorkoutData.exercises?.length || 0})</Text>
                                    <Button title="Add Exercise" onPress={handleAddExercisePress} />
                                </View>

                                {selectedWorkoutData.exercises?.map((exercise, index) => (
                                    <View key={exercise._id || index} style={styles.exerciseItem}>
                                        <View style={styles.exerciseDetails}>
                                            <Text style={styles.exerciseName}>{index + 1}. {exercise.exerciseName}</Text>
                                            <Text style={styles.exerciseAttribute}> Duration: {exercise.durationSeconds ?? 'N/A'}s</Text>
                                            {exercise.repetitions !== undefined && <Text style={styles.exerciseAttribute}> Reps: {exercise.repetitions}</Text>}
                                            {exercise.weight !== undefined && <Text style={styles.exerciseAttribute}> Weight: {exercise.weight} {exercise.weightUnit || ''}</Text>}
                                            <Text style={styles.exerciseAttribute}> Time: {formatDisplayTime(exercise.startTime)} - {formatDisplayTime(exercise.endTime) || 'Now'}</Text>
                                            {exercise.trainedMuscle && <Text style={styles.exerciseAttribute}> Muscle: {exercise.trainedMuscle}</Text>}
                                            {exercise.exerciseType && <Text style={styles.exerciseAttribute}> Type: {exercise.exerciseType}</Text>}
                                        </View>
                                        <View style={styles.exerciseActions}>
                                            <Pressable onPress={() => handleEditExercisePress(exercise)} style={styles.editButton}>
                                                <Text style={styles.editButtonText}>Edit</Text>
                                            </Pressable>
                                            <Pressable onPress={() => handleRemoveExercisePress(exercise._id)} style={styles.removeButton}>
                                                <Text style={styles.removeButtonText}>✕</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                ))}
                                {(!selectedWorkoutData.exercises || selectedWorkoutData.exercises.length === 0) && (
                                    <Text style={styles.infoTextSmall}>No exercises recorded.</Text>
                                )}
                            </View>
                        ) : <Text style={styles.loadingText}>Loading details...</Text>}
                    </ScrollView>
                    <View style={styles.modalCloseButtonContainer}>
                        <Button title="Close" onPress={() => { setModalVisible(false); setSelectedWorkoutData(null); }} color="grey" />
                    </View>
                </SafeAreaView>
            </Modal>

            <Modal
                animationType="slide" visible={addExerciseModalVisible}
                onRequestClose={() => { setAddExerciseModalVisible(false); setModalMode('add'); setEditingExerciseId(null); }}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <ScrollView contentContainerStyle={styles.modalContent}>
                        <Text style={styles.modalTitle}>{modalMode === 'edit' ? 'Edit Exercise' : 'Add Manual Exercise'}</Text>
                        <Text style={styles.modalDate}>Workout Date: {selectedWorkoutData?.date}</Text>

                        <Text style={styles.label}>Exercise Name*:</Text>
                        <TextInput style={styles.input} value={newExerciseName} onChangeText={setNewExerciseName} placeholder="e.g., Dumbbell Curl" />

                        <Text style={styles.label}>Exercise Type*:</Text>
                        <View style={styles.pickerContainerModal}>
                            <Picker selectedValue={newExerciseType} onValueChange={setNewExerciseType} style={styles.picker}>
                                <Picker.Item label="Select Type..." value="" /><Picker.Item label="Strength" value="Strength" /><Picker.Item label="Cardio" value="Cardio" /><Picker.Item label="Flexibility" value="Flexibility" /><Picker.Item label="Other" value="Other" />
                            </Picker>
                        </View>

                        <Text style={styles.label}>Trained Muscle*:</Text>
                        <TextInput style={styles.input} value={newTrainedMuscle} onChangeText={setNewTrainedMuscle} placeholder="e.g., Biceps" />

                        <Text style={styles.label}>Start Time*:</Text>
                        <Pressable onPress={() => setShowNewStartTimePicker(true)}><Text style={styles.dateTimeButtonText}>{newStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "Select"}</Text></Pressable>
                        {showNewStartTimePicker && <DateTimePicker value={newStartTime} mode="time" is24Hour={true} display="default" onChange={(e, d) => { setShowNewStartTimePicker(Platform.OS === 'ios'); if (d) setNewStartTime(d); }} />}

                        <Text style={styles.label}>End Time*:</Text>
                        <Pressable onPress={() => setShowNewEndTimePicker(true)}><Text style={styles.dateTimeButtonText}>{newEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "Select"}</Text></Pressable>
                        {showNewEndTimePicker && <DateTimePicker value={newEndTime} mode="time" is24Hour={true} display="default" onChange={(e, d) => { setShowNewEndTimePicker(Platform.OS === 'ios'); if (d) setNewEndTime(d); }} />}

                        <Text style={styles.label}>Reps:</Text>
                        <TextInput style={styles.input} value={newReps} onChangeText={setNewReps} keyboardType="numeric" placeholder="e.g., 10" />

                        <Text style={styles.label}>Weight:</Text>
                        <TextInput style={[styles.input, { flex: 1, marginRight: 5 }]} value={newWeight} onChangeText={setNewWeight} keyboardType="numeric" placeholder="e.g., 25" />


                        <View style={styles.buttonContainer}>
                            {isSavingExercise ? <ActivityIndicator /> : <Button title={modalMode === 'edit' ? 'Save Changes' : 'Save Exercise'} onPress={handleSaveExercise} />}
                            <View style={{ marginTop: 10 }} />
                            <Button title="Cancel" onPress={() => { setAddExerciseModalVisible(false); setModalMode('add'); setEditingExerciseId(null); }} color="grey" />
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
    container: { paddingBottom: 90, paddingHorizontal: 10 },
    viewContainer: { paddingHorizontal: 5 },
    title: { fontSize: 24, fontWeight: 'bold', marginVertical: 15, textAlign: 'center', color: '#333' },
    loader: { marginVertical: 20 },
    errorText: { color: 'red', textAlign: 'center', marginVertical: 10, fontSize: 14, paddingHorizontal: 20 },
    infoText: { textAlign: 'center', marginTop: 20, color: 'grey', fontSize: 15 },
    infoTextSmall: { textAlign: 'center', marginTop: 5, color: 'grey', fontSize: 13 },
    segmentedControlContainer: { padding: 15, backgroundColor: '#f0f0f0', borderTopWidth: 1, borderTopColor: '#ccc' },
    actionButtons: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20, marginTop: 10, paddingHorizontal: 5, flexWrap: 'wrap', gap: 10 },
    settingsButtonContainer: { width: '100%', marginTop: 10 },
    listTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
    listSubtitle: { fontSize: 16, fontWeight: '600', marginTop: 10, marginBottom: 5 },
    workoutItem: { padding: 15, marginBottom: 10, backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
    workoutDate: { fontWeight: 'bold', marginBottom: 5, fontSize: 15, color: '#333' },
    exerciseItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15, paddingVertical: 10, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: '#007AFF', borderBottomWidth: 1, borderBottomColor: '#eee' },
    exerciseDetails: { flex: 1, marginRight: 10 },
    exerciseName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    exerciseAttribute: { marginLeft: 5, fontSize: 14, color: '#444', marginBottom: 2, lineHeight: 20 },
    exerciseActions: { flexDirection: 'column', marginLeft: 5 },
    editButton: { paddingVertical: 5, paddingHorizontal: 8, marginBottom: 5 },
    editButtonText: { color: '#007AFF', fontWeight: 'bold' },
    removeButton: { paddingVertical: 5, paddingHorizontal: 8 },
    removeButtonText: { color: 'red', fontWeight: 'bold', fontSize: 18 },
    modalContainer: { flex: 1, backgroundColor: '#fff' },
    modalContent: { padding: 20, paddingBottom: 40 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    modalDate: { fontSize: 16, color: '#555', marginBottom: 15, textAlign: 'center' },
    modalDetail: { fontSize: 16, marginBottom: 5, paddingLeft: 5 },
    modalSubtitle: { fontSize: 18, fontWeight: 'bold' },
    exercisesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
    modalCloseButtonContainer: { padding: 15, paddingBottom: 25, borderTopWidth: 1, borderTopColor: '#ccc', backgroundColor: '#f8f8f8' },
    loadingText: { padding: 20, textAlign: 'center', fontSize: 16, color: 'grey' },
    label: { fontSize: 16, fontWeight: '500', marginTop: 15, marginBottom: 5 },
    input: { height: 45, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, marginBottom: 15, backgroundColor: '#fff', fontSize: 16 },
    pickerContainerModal: { height: 50, justifyContent: 'center', borderColor: '#ccc', borderWidth: 1, borderRadius: 8, backgroundColor: '#fff', marginBottom: 15 },
    dateTimeButtonText: { fontSize: 16, color: '#007AFF', paddingVertical: 12, textDecorationLine: 'underline' },
    weightUnitPickerContainer: { width: 80, height: 45, justifyContent: 'center', borderColor: '#ccc', borderWidth: 1, borderRadius: 8, backgroundColor: '#fff', marginLeft: 5 },
    weightUnitPicker: { height: 45 },
    buttonContainer: { marginTop: 25, marginBottom: 50 },
    calendarTheme: { arrowColor: '#007AFF', monthTextColor: '#2d4150', textMonthFontWeight: 'bold', textDayHeaderFontWeight: 'bold', textDayFontSize: 15, textMonthFontSize: 18, textDayHeaderFontSize: 14, todayTextColor: '#007AFF', dayTextColor: '#2d4150', textDisabledColor: '#d9e1e8' }
});