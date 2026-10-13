// Caleb Connect
// Academic Programme & Course Foundation

export type Programme =
  | 'Computer Science'
  | 'Software Engineering'
  | 'Cybersecurity';

export type Level = '100 Level' | '200 Level';

export type Course = {
  code: string;
  title: string;
  unit: number;
};

export type AcademicProfile = {
  fullName: string;
  matricNumber: string;
  programme: Programme;
  level: Level;
};

// ----------------------------------------------------
// PROGRAMMES
// ----------------------------------------------------

export const PROGRAMMES: Programme[] = [
  'Computer Science',
  'Software Engineering',
  'Cybersecurity',
];

// ----------------------------------------------------
// LEVELS
// ----------------------------------------------------

export const LEVELS: Level[] = [
  '100 Level',
  '200 Level',
];

// ----------------------------------------------------
// COMPUTER SCIENCE
// ----------------------------------------------------

export const COMPUTER_SCIENCE: Record<Level, Course[]> = {
  '100 Level': [
    {
      code: 'CSC101',
      title: 'Introduction to Computer Science',
      unit: 3,
    },
    {
      code: 'MTH101',
      title: 'Elementary Mathematics',
      unit: 3,
    },
    {
      code: 'PHY101',
      title: 'General Physics',
      unit: 3,
    },
    {
      code: 'GST101',
      title: 'Use of English',
      unit: 2,
    },
  ],

  '200 Level': [
    {
      code: 'COS102',
      title: 'Problem Solving',
      unit: 3,
    },
    {
      code: 'CSC172',
      title: 'Data Mining & Warehousing',
      unit: 3,
    },
    {
      code: 'CSC176',
      title: 'Introduction to Web Design',
      unit: 3,
    },
    {
      code: 'CSC178',
      title: 'Basic Electronics',
      unit: 3,
    },
  ],
};

// ----------------------------------------------------
// SOFTWARE ENGINEERING
// ----------------------------------------------------

export const SOFTWARE_ENGINEERING: Record<Level, Course[]> = {
  '100 Level': [
    {
      code: 'SEN101',
      title: 'Introduction to Software Engineering',
      unit: 3,
    },
    {
      code: 'CSC101',
      title: 'Introduction to Computer Science',
      unit: 3,
    },
    {
      code: 'MTH101',
      title: 'Elementary Mathematics',
      unit: 3,
    },
    {
      code: 'GST101',
      title: 'Use of English',
      unit: 2,
    },
  ],

  '200 Level': [
    {
      code: 'SEN201',
      title: 'Software Engineering Principles',
      unit: 3,
    },
    {
      code: 'SEN202',
      title: 'Object-Oriented Programming',
      unit: 3,
    },
    {
      code: 'SEN203',
      title: 'Data Structures',
      unit: 3,
    },
    {
      code: 'SEN204',
      title: 'Database Systems',
      unit: 3,
    },
  ],
};

// ----------------------------------------------------
// CYBERSECURITY
// ----------------------------------------------------

export const CYBERSECURITY: Record<Level, Course[]> = {
  '100 Level': [
    {
      code: 'CYB101',
      title: 'Introduction to Cybersecurity',
      unit: 3,
    },
    {
      code: 'CSC101',
      title: 'Introduction to Computer Science',
      unit: 3,
    },
    {
      code: 'MTH101',
      title: 'Elementary Mathematics',
      unit: 3,
    },
    {
      code: 'GST101',
      title: 'Use of English',
      unit: 2,
    },
  ],

  '200 Level': [
    {
      code: 'CYB201',
      title: 'Cybersecurity Fundamentals',
      unit: 3,
    },
    {
      code: 'CYB202',
      title: 'Network Security',
      unit: 3,
    },
    {
      code: 'CYB203',
      title: 'Operating Systems Security',
      unit: 3,
    },
    {
      code: 'CYB204',
      title: 'Introduction to Cryptography',
      unit: 3,
    },
  ],
};

// ----------------------------------------------------
// ALL COURSES
// ----------------------------------------------------

export const COURSES: Record<Programme, Record<Level, Course[]>> = {
  'Computer Science': COMPUTER_SCIENCE,
  'Software Engineering': SOFTWARE_ENGINEERING,
  Cybersecurity: CYBERSECURITY,
};

// ----------------------------------------------------
// GET COURSES FOR A STUDENT
// ----------------------------------------------------

export function getCourses(
  programme: Programme,
  level: Level
): Course[] {
  return COURSES[programme][level];
}

// ----------------------------------------------------
// GET PROGRAMME DISPLAY NAME
// ----------------------------------------------------

export function getProgrammeShortName(
  programme: Programme
): string {
  switch (programme) {
    case 'Computer Science':
      return 'Computer Science';

    case 'Software Engineering':
      return 'Software Engineering';

    case 'Cybersecurity':
      return 'Cybersecurity';

    default:
      return programme;
  }
}