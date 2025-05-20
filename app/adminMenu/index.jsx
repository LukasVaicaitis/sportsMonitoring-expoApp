import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

export default function AdminMenuScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const navigateToRegisterMachine = () => router.push('/adminMenu/RegisterMachine');
    const navigateToCheckStatus = () => router.push('/adminMenu/CheckMachineStatus');
    const navigateToAddGym = () => router.push('/adminMenu/AddGym');
    const navigateToCreateWorkout = () => { router.push('/adminMenu/CreateWorkout') };

    return (
        <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        >
            <Stack.Screen options={{ title: 'Admin Menu', headerBackTitle: 'Back' }} />

            <Text style={styles.title}>Admin/Trainer Menu</Text>

            <Pressable style={styles.button} onPress={navigateToRegisterMachine}>
                <MaterialIcons name="add-to-photos" size={22} color="#fff" />
                <Text style={styles.buttonText}>Register a New Machine</Text>
            </Pressable>

            <Pressable style={styles.button} onPress={navigateToCheckStatus}>
                <MaterialIcons name="checklist" size={22} color="#fff" />
                <Text style={styles.buttonText}>Check Machine Status</Text>
            </Pressable>

            <Pressable style={styles.button} onPress={navigateToCreateWorkout}>
                <MaterialIcons name="assignment-ind" size={22} color="#fff" />
                <Text style={styles.buttonText}>Create a workout for user</Text>
            </Pressable>

            <Pressable style={styles.button} onPress={navigateToAddGym}>
                <MaterialIcons name="add-business" size={22} color="#fff" />
                <Text style={styles.buttonText}>Add New Gym</Text>
            </Pressable>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollView: { flex: 1},
    container: { alignItems: 'center', paddingHorizontal: 16 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#333', marginBottom: 30, textAlign: 'center' },
    button: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#343a40', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 8, marginBottom: 15, width: '90%', elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, justifyContent: 'center' },
    buttonText: { color: 'white', fontSize: 16, fontWeight: '500', marginLeft: 12 },
});