
import { useCallback } from 'react';
import {
    deleteRapatGuruAttendance,
    deleteRapatGuruSchedule,
    fetchRapatGuruAttendance,
    fetchRapatGuruSchedules,
    getRapatGuruErrorMessage,
    saveRapatGuruAttendance,
    saveRapatGuruSchedule,
} from '@/lib/rapatGuruAdapters';

export const useRapatGuruAttendance = () => {
    const fetchRapatGuruSchedule = useCallback(async () => {
        try {
            return await fetchRapatGuruSchedules();
        } catch (err) {
            return [];
        }
    }, []);

    const fetchRapatGuruAttendance = useCallback(async ({ date }) => {
        try {
            return await fetchRapatGuruAttendance({ date });
        } catch (err) {
            return [];
        }
    }, []);

    const saveRapatGuruAttendance = useCallback(async (payload) => {
        try {
            const data = await saveRapatGuruAttendance(payload);
            return { success: true, data };
        } catch (err) {
            return { success: false, error: getRapatGuruErrorMessage(err) };
        }
    }, []);

    const deleteRapatGuruAttendance = useCallback(async (id) => {
        try {
            await deleteRapatGuruAttendance(id);
            return { success: true };
        } catch (err) {
            return { success: false, error: getRapatGuruErrorMessage(err) };
        }
    }, []);

    const updateRapatGuruSchedule = useCallback(async (payload) => {
        try {
            const data = await saveRapatGuruSchedule(payload);
            return { success: true, data };
        } catch (err) {
            return { success: false, error: getRapatGuruErrorMessage(err) };
        }
    }, []);

    const deleteRapatGuruSchedule = useCallback(async (id) => {
        try {
            await deleteRapatGuruSchedule(id);
            return { success: true };
        } catch (err) {
            return { success: false, error: getRapatGuruErrorMessage(err) };
        }
    }, []);

    return {
        fetchRapatGuruSchedule,
        fetchRapatGuruAttendance,
        saveRapatGuruAttendance,
        deleteRapatGuruAttendance,
        updateRapatGuruSchedule,
        deleteRapatGuruSchedule
    };
};
