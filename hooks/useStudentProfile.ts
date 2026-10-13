import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type {
    AcademicProfile,
    Level,
    Programme,
} from '../constants/academic-data';

const PROFILE_KEY = '@caleb_connect_student_profile';

export function useStudentProfile() {
  const [profile, setProfile] = useState<AcademicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem(PROFILE_KEY);

      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }
    } catch (error) {
      console.log('Error loading student profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (
    fullName: string,
    matricNumber: string,
    programme: Programme,
    level: Level
  ) => {
    const newProfile: AcademicProfile = {
      fullName: fullName.trim(),
      matricNumber: matricNumber.trim(),
      programme,
      level,
    };

    try {
      await AsyncStorage.setItem(
        PROFILE_KEY,
        JSON.stringify(newProfile)
      );

      setProfile(newProfile);

      return true;
    } catch (error) {
      console.log('Error saving student profile:', error);
      return false;
    }
  };

  const clearProfile = async () => {
    try {
      await AsyncStorage.removeItem(PROFILE_KEY);
      setProfile(null);
    } catch (error) {
      console.log('Error clearing student profile:', error);
    }
  };

  return {
    profile,
    loading,
    saveProfile,
    clearProfile,
    reloadProfile: loadProfile,
  };
}